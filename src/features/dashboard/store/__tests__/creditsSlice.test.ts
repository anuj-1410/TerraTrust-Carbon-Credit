jest.mock('../../../../services/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
  },
}));

jest.mock('../../../../services/blockchain', () => ({
  getCTTBalance: jest.fn(),
}));

import {configureStore} from '@reduxjs/toolkit';
import creditsReducer, {
  fetchCreditsThunk,
  setPendingMint,
} from '../creditsSlice';
import type {CreditsState} from '../creditsSlice';

const mockedApi = jest.requireMock('../../../../services/api').default as {
  get: jest.Mock;
};
const mockedBlockchain = jest.requireMock('../../../../services/blockchain') as {
  getCTTBalance: jest.Mock;
};

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
  if (overrides.pendingMint !== undefined) {
    store.dispatch(setPendingMint(overrides.pendingMint));
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
    mockedBlockchain.getCTTBalance.mockResolvedValue(47.3);

    const store = createTestStore();
  await (store.dispatch as any)(fetchCreditsThunk());

    const state = store.getState().credits;
    expect(state.balance).toBe(47.3);
    expect(state.history).toEqual(mockHistory);
    expect(state.lastFetchedAt).toBe('2026-03-26T10:00:00.000Z');
  });

  it('falls back to API balance_ctt when getCTTBalance throws', async () => {
    mockedApi.get.mockResolvedValue({
      data: {balance_ctt: 40.0, history: mockHistory},
    });
    mockedBlockchain.getCTTBalance.mockRejectedValue(new Error('RPC timeout'));

    const store = createTestStore();
  await (store.dispatch as any)(fetchCreditsThunk());

    const state = store.getState().credits;
    expect(state.balance).toBe(40.0);
    expect(state.history).toEqual(mockHistory);
  });

  it('preserves pendingMint when it was true', async () => {
    mockedApi.get.mockResolvedValue({
      data: {balance_ctt: 50.0, history: []},
    });
    mockedBlockchain.getCTTBalance.mockResolvedValue(50.0);

    const store = createTestStore({pendingMint: true});
  await (store.dispatch as any)(fetchCreditsThunk());

    expect(store.getState().credits.pendingMint).toBe(true);
  });

  it('does not change pendingMint when it was already false', async () => {
    mockedApi.get.mockResolvedValue({
      data: {balance_ctt: 50.0, history: []},
    });
    mockedBlockchain.getCTTBalance.mockResolvedValue(50.0);

    const store = createTestStore({pendingMint: false});
  await (store.dispatch as any)(fetchCreditsThunk());

    expect(store.getState().credits.pendingMint).toBe(false);
  });

  it('stamps lastFetchedAt with ISO timestamp', async () => {
    mockedApi.get.mockResolvedValue({
      data: {balance_ctt: 10.0, history: []},
    });
    mockedBlockchain.getCTTBalance.mockResolvedValue(10.0);

    const store = createTestStore();
    expect(store.getState().credits.lastFetchedAt).toBeNull();

  await (store.dispatch as any)(fetchCreditsThunk());

    expect(store.getState().credits.lastFetchedAt).toBe(
      '2026-03-26T10:00:00.000Z',
    );
  });
});
