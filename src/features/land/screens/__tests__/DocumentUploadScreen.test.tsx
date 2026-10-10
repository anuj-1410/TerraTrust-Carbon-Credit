import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import authReducer, { authInitialState } from '../../../auth/store/authSlice';
import landReducer from '../../store/landSlice';
import DocumentUploadScreen from '../DocumentUploadScreen';
const mockPost = jest.fn();
const mockReset = jest.fn();
const mockNavigate = jest.fn();
const mockGet = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ reset: mockReset, navigate: mockNavigate }),
  useFocusEffect: (callback: () => void) =>
    require('react').useEffect(callback, [callback]),
}));
jest.mock('../../../../services/api', () => ({
  __esModule: true,
  default: {
    post: (...args: unknown[]) => mockPost(...args),
    get: (...args: unknown[]) => mockGet(...args),
  },
}));
jest.mock('react-native-vision-camera', () => ({
  Camera: Object.assign(() => null, {
    requestCameraPermission: () => Promise.resolve('granted'),
  }),
  useCameraDevice: () => ({ id: 'back' }),
}));
jest.mock('@react-native-documents/picker', () => ({
  pick: () =>
    Promise.resolve([
      {
        uri: 'file:///document.jpg',
        size: 100,
        name: 'document.jpg',
        nativeType: 'image/jpeg',
      },
    ]),
  types: { images: 'image/*' },
  isErrorWithCode: () => false,
  errorCodes: { OPERATION_CANCELED: 'cancel' },
}));
jest.mock('@react-native-community/netinfo', () => ({
  fetch: () => Promise.resolve({ isConnected: true }),
}));
jest.mock('react-native-geolocation-service', () => ({
  getCurrentPosition: (_success: unknown, failure: () => void) => failure(),
}));
jest.mock('lottie-react-native', () => 'LottieView');
const record = {
  survey_number: '47',
  owner_name: 'Farmer',
  village: 'Village',
  district: 'Pune',
  taluka: 'Haveli',
  state: 'Maharashtra',
  extraction_confidence: 1,
};
function setup() {
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
    },
  });
  const screen = render(
    <SafeAreaInsetsContext.Provider
      value={{ top: 0, bottom: 0, left: 0, right: 0 }}
    >
      <Provider store={store}>
        <DocumentUploadScreen />
      </Provider>
    </SafeAreaInsetsContext.Provider>,
  );
  return { store, screen };
}
beforeEach(() => jest.clearAllMocks());
async function select(screen: ReturnType<typeof render>) {
  await act(async () =>
    fireEvent.press(screen.getByText('Choose from gallery')),
  );
}
it('prevents duplicate OCR submissions and discards results after Cancel', async () => {
  let finish!: (value: unknown) => void;
  mockPost.mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  const { screen, store } = setup();
  await select(screen);
  fireEvent.press(screen.getByText('Use this photo'));
  fireEvent.press(screen.getByText('Use this photo'));
  await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
  fireEvent.press(screen.getByText('Cancel'));
  await act(async () => finish({ data: record }));
  expect(store.getState().land.currentDraft.ocrResult).toBeNull();
  expect(mockReset).toHaveBeenCalledTimes(1);
  expect(mockNavigate).not.toHaveBeenCalled();
});
it('keeps incomplete OCR responses out of the registration draft', async () => {
  mockPost.mockResolvedValue({ data: { survey_number: '47' } });
  const { screen, store } = setup();
  await select(screen);
  fireEvent.press(screen.getByText('Use this photo'));
  await waitFor(() =>
    expect(
      screen.getByText(
        'The document did not contain complete land details. Enter the record fields manually to continue.',
      ),
    ).toBeTruthy(),
  );
  expect(store.getState().land.currentDraft.ocrResult).toBeNull();
});
it('returns from an unexpected boundary response with actionable feedback instead of a stuck loader', async () => {
  mockPost.mockResolvedValue({ data: record });
  mockGet.mockResolvedValue({ data: { status: 'unknown' } });
  const { screen } = setup();
  await select(screen);
  fireEvent.press(screen.getByText('Use this photo'));
  await waitFor(() =>
    expect(screen.getByText('Continue to boundary check')).toBeTruthy(),
  );
  fireEvent.press(screen.getByText('Continue to boundary check'));
  await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1));
  expect(mockNavigate).not.toHaveBeenCalled();
  await waitFor(() =>
    expect(
      screen.getByText(
        'Could not fetch a valid land boundary. Please retry or upload your map manually.',
      ),
    ).toBeTruthy(),
  );
  expect(screen.getByText('Upload map manually')).toBeTruthy();
  expect(
    screen.queryByText('Fetching your official land boundary...'),
  ).toBeNull();
});
