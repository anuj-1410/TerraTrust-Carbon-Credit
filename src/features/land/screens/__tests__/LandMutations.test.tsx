import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import authReducer, {
  authInitialState,
  logout,
} from '../../../auth/store/authSlice';
import landReducer, {
  landInitialState,
  normalizeLandParcelRecord,
  setParcels,
} from '../../store/landSlice';
import EditLandNameScreen from '../EditLandNameScreen';
import BoundaryConfirmScreen from '../BoundaryConfirmScreen';
const mockPatch = jest.fn();
const mockPost = jest.fn();
const mockGet = jest.fn();
const mockNavigate = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    replace: mockReplace,
    goBack: mockBack,
  }),
  useRoute: () => ({ params: { landId: 'land-1' } }),
  useFocusEffect: (callback: () => void) =>
    require('react').useEffect(callback, [callback]),
}));
jest.mock('../../../../services/api', () => ({
  __esModule: true,
  default: {
    patch: (...args: unknown[]) => mockPatch(...args),
    post: (...args: unknown[]) => mockPost(...args),
    get: (...args: unknown[]) => mockGet(...args),
  },
}));
jest.mock('@react-native-community/netinfo', () => ({
  fetch: () => Promise.resolve({ isConnected: true }),
}));
jest.mock('react-native-geolocation-service', () => ({
  getCurrentPosition: jest.fn(),
}));
jest.mock('react-native-maps', () => ({
  __esModule: true,
  default: 'MapView',
  Polygon: 'Polygon',
}));
jest.mock('lottie-react-native', () => 'LottieView');
const boundary = {
  type: 'Polygon' as const,
  coordinates: [
    [
      [73, 20],
      [73.001, 20],
      [73.001, 20.001],
      [73, 20.001],
      [73, 20],
    ],
  ],
};
const parcel = normalizeLandParcelRecord({
  id: 'land-1',
  farm_name: 'Old Name',
  survey_number: '47',
  is_verified: true,
});
function setup(
  Screen: typeof EditLandNameScreen | typeof BoundaryConfirmScreen,
) {
  const store = configureStore({
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
        parcels: [parcel],
        currentDraft: {
          ...landInitialState.currentDraft,
          boundary,
          boundarySource: 'WMS_AUTO' as const,
          ocrResult: {
            survey_number: '47',
            owner_name: 'Farmer',
            village: 'Village',
            district: 'Pune',
            taluka: 'Haveli',
            state: 'Maharashtra',
            extraction_confidence: 1,
          },
        },
      },
    },
  });
  return {
    store,
    screen: render(
      <SafeAreaInsetsContext.Provider
        value={{ top: 0, bottom: 0, left: 0, right: 0 }}
      >
        <Provider store={store}>
          <Screen />
        </Provider>
      </SafeAreaInsetsContext.Provider>,
    ),
  };
}
beforeEach(() => jest.clearAllMocks());
it('prevents duplicate name saves and preserves the open parcel across a page-one refresh', async () => {
  let finish!: (value: unknown) => void;
  mockPatch.mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  const { store, screen } = setup(EditLandNameScreen);
  fireEvent.changeText(
    screen.getByPlaceholderText('Enter farm name'),
    'New Name',
  );
  fireEvent.press(screen.getByText('Save'));
  fireEvent.press(screen.getByText('Saving...'));
  expect(mockPatch).toHaveBeenCalledTimes(1);
  act(() => {
    store.dispatch(setParcels([]));
  });
  expect(screen.queryByText('Land parcel not found.')).toBeNull();
  await act(async () => finish({ data: { farm_name: 'New Name' } }));
  expect(store.getState().land.parcels[0].farm_name).toBe('New Name');
  expect(mockBack).toHaveBeenCalledTimes(1);
});
it('discards a late registration result after the farmer leaves the screen', async () => {
  let finish!: (value: unknown) => void;
  mockPost.mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  const { store, screen } = setup(BoundaryConfirmScreen);
  fireEvent.press(screen.getByText('Yes, this is my land'));
  await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
  screen.unmount();
  await act(async () =>
    finish({
      data: { land_id: 'new-land', area_hectares: 1, status: 'verified' },
    }),
  );
  expect(store.getState().land.parcels.map(item => item.id)).toEqual([
    'land-1',
  ]);
  expect(mockReplace).not.toHaveBeenCalled();
});
it('rejects malformed registration responses instead of inventing a verified parcel', async () => {
  mockPost.mockResolvedValue({ data: { status: 'pending' } });
  const { screen, store } = setup(BoundaryConfirmScreen);
  fireEvent.press(screen.getByText('Yes, this is my land'));
  await waitFor(() =>
    expect(
      screen.getByText(
        'The server did not confirm a valid registration. Refresh My Lands before retrying.',
      ),
    ).toBeTruthy(),
  );
  expect(store.getState().land.parcels).toHaveLength(1);
  expect(mockReplace).not.toHaveBeenCalled();
});
it('prevents a saved name from an abandoned identity being committed after logout', async () => {
  let finish!: (value: unknown) => void;
  mockPatch.mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  const { store, screen } = setup(EditLandNameScreen);
  fireEvent.changeText(
    screen.getByPlaceholderText('Enter farm name'),
    'Private Name',
  );
  fireEvent.press(screen.getByText('Save'));
  act(() => {
    store.dispatch(logout());
  });
  await act(async () => finish({ data: { farm_name: 'Private Name' } }));
  expect(store.getState().land.parcels[0].farm_name).toBe('Old Name');
  expect(mockBack).not.toHaveBeenCalled();
});
