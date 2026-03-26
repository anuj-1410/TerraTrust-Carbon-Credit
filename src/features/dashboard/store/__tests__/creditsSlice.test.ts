import {configureStore} from '@reduxjs/toolkit';
import creditsReducer, {
  creditsInitialState,
  fetchCreditsThunk,
} from '../creditsSlice';
import type {CreditsState} from '../creditsSlice';
import api from '../../../../services/api';
import {getCTTBalance} from '../../../../services/blockchain';

jest.mock('react-native-config', () => ({API_BASE_URL: 'http://test'}));
jest.mock('../../../../services/supabase', () => ({
  supabase: {auth: {getSession: jest.fn().mockResolvedValue({data: {session: null}})}},
}));
jest.mock('../../../../store/mmkvStorage', () => ({
  mmkvStorage: {getItem: jest.fn(), setItem: jest.fn()},
}));
jest.mock('../../../../services/api');
jest.mock('../../../../services/blockchain');

const mockedApi = api as jest.Mocked<typeof api>;
const mockedGetCTTBalance = getCTTBalance as jest.MockedFunction<
  typeof getCTTBalance
>;

const mockHistory = [
  {
    audit_id: 'a1',
    audit_year: 2025,
    land_id: 'l1',
    land_name: 'North Field',
    credits_issued: 12.4,
    total_biomass_tonnes: 14.8,
    tx_hash: '0xabc123',
    ipfs_certificate_url: 'https://ipfs.io/ipfs/bafytest',
    minted_at: '2025-11-15T14:23:00Z',
  },
];

function createTestStore(overrides: Partial<CreditsState> = {}) {
  const store = configureStore({
    reducer: {
      credits: creditsReducer,
      auth: () => ({walletAddress: '0xWALLET', isAuthenticated: true}),
      land: () => ({parcels: []}),
      audit: () => ({}),
    },
  });
  // Apply overrides by dispatching actions if needed
  if (overrides.pendingMint !== undefined) {
    store.dispatch({type: 'credits/setPendingMint', payload: overrides.pendingMint});
  }
  return store;
}

describe('fetchCreditsThunk', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date.prototype, 'toISOString').mockReturnValue('2026-03-26T10:00:00.000Z');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('fetches balance from blockchain as primary source and populates history', async () => {
    mockedApi.get.mockResolvedValue({
      data: {balance_ctt: 40.0, history: mockHistory},
    });
    mockedGetCTTBalance.mockResolvedValue(47.3);

    const store = createTestStore();
    await (store.dispatch as any)(fetchCreditsThunk('0xWALLET'));

    const state = store.getState().credits;
    expect(state.balance).toBe(47.3);
    expect(state.history).toEqual(mockHistory);
    expect(state.lastFetchedAt).toBe('2026-03-26T10:00:00.000Z');
  });

  it('falls back to API balance_ctt when getCTTBalance throws', async () => {
    mockedApi.get.mockResolvedValue({
      data: {balance_ctt: 40.0, history: mockHistory},
    });
    mockedGetCTTBalance.mockRejectedValue(new Error('RPC timeout'));

    const store = createTestStore();
    await (store.dispatch as any)(fetchCreditsThunk('0xWALLET'));

    const state = store.getState().credits;
    expect(state.balance).toBe(40.0);
    expect(state.history).toEqual(mockHistory);
  });

  it('sets pendingMint to false when it was true', async () => {
    mockedApi.get.mockResolvedValue({
      data: {balance_ctt: 50.0, history: []},
    });
    mockedGetCTTBalance.mockResolvedValue(50.0);

    const store = createTestStore({pendingMint: true});
    await (store.dispatch as any)(fetchCreditsThunk('0xWALLET'));

    expect(store.getState().credits.pendingMint).toBe(false);
  });

  it('does not change pendingMint when it was already false', async () => {
    mockedApi.get.mockResolvedValue({
      data: {balance_ctt: 50.0, history: []},
    });
    mockedGetCTTBalance.mockResolvedValue(50.0);

    const store = createTestStore({pendingMint: false});
    await (store.dispatch as any)(fetchCreditsThunk('0xWALLET'));

    expect(store.getState().credits.pendingMint).toBe(false);
  });

  it('stamps lastFetchedAt with ISO timestamp', async () => {
    mockedApi.get.mockResolvedValue({
      data: {balance_ctt: 10.0, history: []},
    });
    mockedGetCTTBalance.mockResolvedValue(10.0);

    const store = createTestStore();
    expect(store.getState().credits.lastFetchedAt).toBeNull();

    await (store.dispatch as any)(fetchCreditsThunk('0xWALLET'));

    expect(store.getState().credits.lastFetchedAt).toBe(
      '2026-03-26T10:00:00.000Z',
    );
  });
});
