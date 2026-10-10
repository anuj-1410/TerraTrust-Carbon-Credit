import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../../store/authSlice';
import profileReducer from '../../../profile/store/profileSlice';
import LoginScreen from '../LoginScreen';
const mockReset = jest.fn();
const mockSend = jest.fn();
const mockCancel = jest.fn();
const mockConfirm = jest.fn();
const mockBootstrap = jest.fn();
let mockUser: { uid: string; phoneNumber: string } | null = null;
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ reset: mockReset }),
}));
jest.mock('../../../../services/firebase', () => ({
  sendPhoneOtp: (...args: unknown[]) => mockSend(...args),
  cancelPendingPhoneOtp: (...args: unknown[]) => mockCancel(...args),
  getCurrentFirebaseUser: () => mockUser,
  confirmPhoneOtp: (...args: unknown[]) => mockConfirm(...args),
  observePhoneAuthentication: () => jest.fn(),
}));
jest.mock('../../../../services/authBootstrap', () => ({
  bootstrapAuthenticatedProfile: () => mockBootstrap(),
}));
jest.mock('../../../../common/utils/onboarding', () => ({
  getAuthenticatedEntryRoute: (kyc: boolean) =>
    kyc ? 'HomeScreen' : 'KYCScreen',
  markOnboardingComplete: jest.fn(),
}));
const profile = {
  user_id: 'user-1',
  firebase_uid: 'farmer-1',
  phone_number: '+919999999999',
  full_name: 'Farmer',
  kyc_completed: true,
  wallet_address: null,
};
afterEach(() => jest.useRealTimers());
function setup() {
  const store = configureStore({
    reducer: { auth: authReducer, profile: profileReducer },
  });
  const screen = render(
    <Provider store={store}>
      <LoginScreen />
    </Provider>,
  );
  fireEvent.changeText(
    screen.getByPlaceholderText('Enter 10-digit number'),
    '9999999999',
  );
  return { store, screen };
}
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockUser = null;
  mockSend.mockReset().mockResolvedValue({ verificationId: 'verification-1' });
  mockCancel.mockReset().mockResolvedValue(undefined);
  mockConfirm.mockReset().mockImplementation(async () => {
    mockUser = { uid: 'farmer-1', phoneNumber: '+919999999999' };
  });
  mockBootstrap.mockReset().mockResolvedValue({ profile });
});
it('opens OTP in the same phone screen as soon as Firebase sends the code and avoids duplicate SMS requests', async () => {
  let finish!: (session: { verificationId: string }) => void;
  mockSend.mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  const { screen } = setup();
  expect(screen.queryByTestId('screen-header')).toBeNull();
  fireEvent.press(screen.getByText('Send OTP'));
  fireEvent.press(screen.getByText('Sending OTP...'));
  expect(mockSend).toHaveBeenCalledTimes(1);
  await act(async () => finish({ verificationId: 'verification-1' }));
  expect(screen.getByTestId('otp-drawer')).toBeTruthy();
  expect(mockReset).not.toHaveBeenCalled();
});
it('dismisses the drawer to change the phone and creates a fresh verification attempt', async () => {
  const { screen, store } = setup();
  await act(async () => fireEvent.press(screen.getByText('Send OTP')));
  fireEvent.changeText(screen.getByLabelText('Verification code'), '123');
  fireEvent.press(screen.getByLabelText('Close verification drawer'));
  await waitFor(() => expect(screen.queryByTestId('otp-drawer')).toBeNull());
  expect(mockCancel).toHaveBeenCalledWith('+919999999999');
  fireEvent.changeText(
    screen.getByPlaceholderText('Enter 10-digit number'),
    '8888888888',
  );
  await act(async () => fireEvent.press(screen.getByText('Send OTP')));
  expect(mockSend).toHaveBeenLastCalledWith('+918888888888');
  expect(screen.getByLabelText('Verification code').props.value).toBe('');
  expect(store.getState().auth.isAuthenticated).toBe(false);
});
it('commits the profile and enters Home after the drawer automatically accepts a complete code', async () => {
  const { screen, store } = setup();
  await act(async () => fireEvent.press(screen.getByText('Send OTP')));
  fireEvent.changeText(screen.getByLabelText('Verification code'), '123456');
  await waitFor(() =>
    expect(mockReset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: 'HomeScreen' }],
    }),
  );
  expect(store.getState().auth).toMatchObject({
    isAuthenticated: true,
    sessionReady: true,
    kycCompleted: true,
  });
  expect(screen.queryByTestId('otp-drawer')).toBeNull();
});
it('handles Firebase instant verification without navigating to another OTP or splash screen', async () => {
  mockSend.mockImplementation(async () => {
    mockUser = { uid: 'farmer-1', phoneNumber: '+919999999999' };
    return { verificationId: null };
  });
  const { screen } = setup();
  await act(async () => fireEvent.press(screen.getByText('Send OTP')));
  await waitFor(() => expect(mockReset).toHaveBeenCalledTimes(1));
  expect(mockConfirm).not.toHaveBeenCalled();
});

it('routes the fresh demo checkpoint to KYC after verification without requiring a wallet first', async () => {
  mockBootstrap.mockResolvedValue({
    profile: { ...profile, full_name: null, kyc_completed: false },
  });
  const { screen } = setup();
  await act(async () => fireEvent.press(screen.getByText('Send OTP')));
  await act(async () =>
    fireEvent.changeText(screen.getByLabelText('Verification code'), '111111'),
  );
  await waitFor(() => expect(mockReset).toHaveBeenCalledWith({
    index: 0,
    routes: [{ name: 'KYCScreen' }],
  }));
});
