import { configureStore } from '@reduxjs/toolkit';
import authReducer, {
  authInitialState,
  logout,
} from '../../../auth/store/authSlice';
import landReducer, {
  landInitialState,
  normalizeLandParcelRecord,
  fetchLandPage,
  addParcel,
} from '../landSlice';
const mockGet = jest.fn();
jest.mock('../../../../services/api', () => ({
  __esModule: true,
  default: { get: (...args: unknown[]) => mockGet(...args) },
}));
function testStore() {
  return configureStore({
    reducer: { auth: authReducer, land: landReducer },
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
      land: {
        ...landInitialState,
        parcels: [
          normalizeLandParcelRecord({
            id: 'stale-id',
            farm_name: 'Old duplicate',
          }),
        ],
      },
    },
  });
}
beforeEach(() => mockGet.mockReset());
it('shares startup/Home requests and replaces stale cached entries with the authoritative page', async () => {
  let finish!: (data: unknown) => void;
  mockGet.mockReturnValue(
    new Promise(resolve => {
      finish = data => resolve({ data });
    }),
  );
  const store = testStore();
  const first = store.dispatch(fetchLandPage(1));
  const second = store.dispatch(fetchLandPage(1));
  finish({
    items: [
      { id: 'land-1', farm_name: 'My Land' },
      { id: 'land-1', farm_name: 'My Land' },
    ],
    has_more: false,
  });
  await Promise.all([first, second]);
  expect(mockGet).toHaveBeenCalledTimes(1);
  expect(store.getState().land.parcels.map(parcel => parcel.id)).toEqual([
    'land-1',
  ]);
});
it('ignores a page-two response arriving after a newer refresh', async () => {
  let finishPageTwo!: (data: unknown) => void;
  mockGet.mockImplementation((_url, { params }) =>
    params.page === 2
      ? new Promise(resolve => {
          finishPageTwo = data => resolve({ data });
        })
      : Promise.resolve({
          data: { items: [{ id: 'fresh-land' }], has_more: false },
        }),
  );
  const store = testStore();
  const oldPage = store.dispatch(fetchLandPage(2));
  await store.dispatch(fetchLandPage(1));
  finishPageTwo({ items: [{ id: 'stale-page-two' }], has_more: false });
  await oldPage;
  expect(store.getState().land.parcels.map(parcel => parcel.id)).toEqual([
    'fresh-land',
  ]);
});
it('does not write an old land request into a logged-out store', async () => {
  let finish!: (data: unknown) => void;
  mockGet.mockReturnValue(
    new Promise(resolve => {
      finish = data => resolve({ data });
    }),
  );
  const store = testStore();
  const request = store.dispatch(fetchLandPage(1));
  store.dispatch(logout());
  finish({ items: [{ id: 'private-land' }], has_more: false });
  await request;
  expect(store.getState().land.parcels.map(parcel => parcel.id)).toEqual([
    'stale-id',
  ]);
});
it('normalizes registration aliases, whitespace, and UUID casing without merging distinct plots', () => {
  const upper = 'AABBCCDD-1122-3344-5566-778899AABBCC';
  expect(normalizeLandParcelRecord({ land_id: ` ${upper} ` }).id).toBe(
    upper.toLowerCase(),
  );
});

it('keeps a newly registered parcel when an older list response finishes late', async () => {
  let finish!: (data: unknown) => void;
  mockGet.mockReturnValue(new Promise(resolve => { finish = data => resolve({data}); }));
  const store = testStore();
  const request = store.dispatch(fetchLandPage(1));
  store.dispatch(addParcel(normalizeLandParcelRecord({id: 'newly-registered'})));
  finish({items: [{id: 'stale-id'}], has_more: false});
  await request;
  expect(store.getState().land.parcels.map(parcel => parcel.id)).toContain('newly-registered');
});

it('clears explicit null audit fields and maps the documented registration date', () => {
  const existing = normalizeLandParcelRecord({id:'land-1',current_audit_id:'audit-1',current_audit_status:'PROCESSING',last_audit_year:2025,thumbnail_url:'https://old.example/image'});
  const refreshed = normalizeLandParcelRecord({id:'land-1',current_audit_id:null,current_audit_status:null,last_audit_year:null,thumbnail_url:null,registered_at:'2026-10-10T00:00:00Z'},existing);
  expect(refreshed.current_audit_id).toBeNull();
  expect(refreshed.current_audit_status).toBeNull();
  expect(refreshed.last_audit_year).toBeNull();
  expect(refreshed.thumbnail_url).toBeNull();
  expect(refreshed.created_at).toBe('2026-10-10T00:00:00Z');
});
it('shares pagination metadata with background refreshes and cannot skip a page', async () => {
  mockGet.mockImplementation((_url,{params})=>Promise.resolve({data:{items:[{id:`page-${params.page}`}],has_more:true}}));
  const store = testStore();
  await store.dispatch(fetchLandPage(1));
  await store.dispatch(fetchLandPage(2));
  expect(store.getState().land.currentPage).toBe(2);
  await store.dispatch(fetchLandPage(1));
  expect(store.getState().land.currentPage).toBe(1);
  await store.dispatch(fetchLandPage(3));
  expect(mockGet.mock.calls.map(call=>call[1].params.page)).toEqual([1,2,1]);
});
it('does not share an old page-two HTTP request with a new snapshot', async () => {
  const finish: Array<(value:unknown)=>void> = [];
  mockGet.mockImplementation((_url,{params})=>params.page===2
    ? new Promise(resolve=>{finish.push(resolve);})
    : Promise.resolve({data:{items:[{id:'fresh-page-one'}],has_more:true}}));
  const store=testStore();
  await store.dispatch(fetchLandPage(1));
  const old=store.dispatch(fetchLandPage(2));
  await store.dispatch(fetchLandPage(1));
  const fresh=store.dispatch(fetchLandPage(2));
  expect(finish).toHaveLength(2);
  finish[1]({data:{items:[{id:'fresh-page-two'}],has_more:false}});
  await fresh;
  finish[0]({data:{items:[{id:'stale-page-two'}],has_more:false}});
  await old;
  expect(store.getState().land.parcels.map(item=>item.id)).toEqual(['fresh-page-one','fresh-page-two']);
});
