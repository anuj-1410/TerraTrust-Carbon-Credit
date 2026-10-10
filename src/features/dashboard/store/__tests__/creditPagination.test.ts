import { configureStore } from '@reduxjs/toolkit';
import authReducer, {
  authInitialState,
  logout,
} from '../../../auth/store/authSlice';
import creditsReducer, { fetchCreditsThunk } from '../creditsSlice';
const mockGet = jest.fn();
jest.mock('../../../../services/api', () => ({
  __esModule: true,
  default: { get: (...args: unknown[]) => mockGet(...args) },
}));
const record = (id: string, year = 2024) => ({
  audit_id: id,
  audit_year: year,
  credits_issued: 10,
  land_name: 'Farm',
  minted_at: '',
  tx_hash: '',
  ipfs_certificate_url: '',
});
function setup() {
  return configureStore({
    reducer: { auth: authReducer, credits: creditsReducer },
    preloadedState: {
      auth: {
        ...authInitialState,
        sessionReady: true,
        isAuthenticated: true,
        user: {
          id: 'user-1',
          firebaseUid: 'farmer-1',
          name: 'Farmer',
          phone: '+919999999999',
        },
      },
    },
  });
}
beforeEach(() => mockGet.mockReset());
it('loads every history page and deduplicates overlaps before the final year totals', async () => {
  mockGet
    .mockResolvedValueOnce({
      data: {
        balance_ctt: 30,
        history: [record('1'), record('2', 2025)],
        has_more: true,
        page: 1,
        total: 3,
      },
    })
    .mockResolvedValueOnce({
      data: {
        balance_ctt: 30,
        history: [record('2', 2025), record('3', 2026)],
        has_more: false,
        page: 2,
        total: 3,
      },
    });
  const store = setup();
  await (store.dispatch as any)(
    fetchCreditsThunk({ allHistory: true }),
  ).unwrap();
  expect(mockGet.mock.calls.map(call => call[1].params.page)).toEqual([1, 2]);
  expect(store.getState().credits.history.map(item => item.audit_id)).toEqual([
    '1',
    '2',
    '3',
  ]);
  expect(store.getState().credits.historyHasMore).toBe(false);
});
it('stops a server that repeats a page rather than loading forever', async () => {
  mockGet.mockResolvedValue({
    data: { history: [record('1')], page: 1, has_more: true },
  });
  const store = setup();
  await expect(
    (store.dispatch as any)(fetchCreditsThunk({ allHistory: true })).unwrap(),
  ).rejects.toMatchObject({ message: 'CREDITS_PAGINATION_STALLED' });
  expect(mockGet).toHaveBeenCalledTimes(2);
  expect(store.getState().credits.historyHasMore).toBe(true);
});
it('rejects an old response after a newer refresh and after logout', async () => {
  let finish!: (value: unknown) => void;
  mockGet
    .mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    )
    .mockResolvedValueOnce({
      data: { history: [record('fresh')], has_more: false },
    });
  const store = setup();
  const old = (store.dispatch as any)(fetchCreditsThunk());
  await (store.dispatch as any)(fetchCreditsThunk()).unwrap();
  finish({ data: { history: [record('stale')], balance_ctt: 999 } });
  await old;
  expect(store.getState().credits.history[0].audit_id).toBe('fresh');
  mockGet.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  const abandoned = (store.dispatch as any)(fetchCreditsThunk());
  store.dispatch(logout());
  finish({ data: { history: [record('private')], balance_ctt: 999 } });
  await abandoned;
  expect(store.getState().credits.history[0].audit_id).toBe('fresh');
});
