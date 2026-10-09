import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../../store/authSlice';
import profileReducer from '../../../profile/store/profileSlice';
import uiReducer from '../../../../store/uiSlice';
const mockConfirm = jest.fn();
const mockBootstrap = jest.fn();
let mockUser: { uid: string; phoneNumber?: string } | null = null;
jest.mock('../../../../services/firebase', () => ({
  confirmPhoneOtp: (...args: unknown[]) => mockConfirm(...args),
  getCurrentFirebaseUser: () => mockUser,
  sendPhoneOtp: jest.fn(),
}));
jest.mock('../../../../services/authBootstrap', () => ({
  bootstrapAuthenticatedProfile: () => mockBootstrap(),
}));
jest.mock('../../../../common/utils/onboarding', () => ({
  getAuthenticatedEntryRoute: () => 'HomeScreen',
  markOnboardingComplete: jest.fn(),
}));
import OTPScreen from '../OTPScreen';
const profile = {
  user_id: 'user-1',
  firebase_uid: 'farmer-1',
  full_name: 'Farmer',
  phone_number: '+919999999999',
  wallet_address: null,
  kyc_completed: true,
  wallet_recovery_status: null,
  wallet_recovery_requested_at: null,
};
function setup() {
  const store = configureStore({
    reducer: { auth: authReducer, profile: profileReducer, ui: uiReducer },
  });
  const navigation = { replace: jest.fn(), reset: jest.fn() };
  const screen = render(
    <Provider store={store}>
      <OTPScreen
        route={{
          key: 'otp',
          name: 'OTPScreen',
          params: { phone: '+919999999999', verificationId: 'verification-1' },
        }}
        navigation={navigation as never}
      />
    </Provider>,
  );
  return { screen, store, navigation };
}
beforeEach(() => {
  jest.clearAllMocks();
  mockUser = null;
  mockConfirm.mockReset().mockImplementation(async () => {
    mockUser = { uid: 'farmer-1', phoneNumber: '+919999999999' };
    return { user: mockUser };
  });
  mockBootstrap.mockReset().mockResolvedValue({ profile });
});
it('releases loading after an incorrect OTP so the farmer can retry', async () => {
  mockConfirm.mockRejectedValueOnce({ code: 'auth/invalid-verification-code' });
  const { screen, navigation } = setup();
  fireEvent.changeText(screen.getByLabelText('OTP digit 1'), '123456');
  fireEvent.press(screen.getByText('Verify OTP'));
  await waitFor(() =>
    expect(screen.getByText('Incorrect code. Please try again.')).toBeTruthy(),
  );
  fireEvent.changeText(screen.getByLabelText('OTP digit 1'), '654321');
  fireEvent.press(screen.getByText('Verify OTP'));
  await waitFor(() => expect(navigation.reset).toHaveBeenCalledTimes(1));
  expect(mockConfirm).toHaveBeenCalledTimes(2);
});
it('retries profile loading without asking Firebase to verify an already accepted OTP again', async () => {
  mockBootstrap.mockRejectedValueOnce(new Error('Network Error'));
  const { screen, navigation } = setup();
  fireEvent.changeText(screen.getByLabelText('OTP digit 1'), '123456');
  fireEvent.press(screen.getByText('Verify OTP'));
  await waitFor(() => expect(screen.getByText('Continue')).toBeTruthy());
  fireEvent.press(screen.getByText('Continue'));
  await waitFor(() => expect(navigation.reset).toHaveBeenCalledTimes(1));
  expect(mockConfirm).toHaveBeenCalledTimes(1);
  expect(mockBootstrap).toHaveBeenCalledTimes(2);
});
it('accepts full-code autofill and commits the account once despite repeated taps', async () => {
  let finish!: () => void;
  mockConfirm.mockImplementation(
    () =>
      new Promise(resolve => {
        finish = () => {
          mockUser = { uid: 'farmer-1', phoneNumber: '+919999999999' };
          resolve({ user: mockUser });
        };
      }),
  );
  const { screen, store, navigation } = setup();
  fireEvent.changeText(screen.getByLabelText('OTP digit 1'), '123456');
  const button = screen.getByText('Verify OTP');
  fireEvent.press(button);
  fireEvent.press(button);
  await act(async () => finish());
  await waitFor(() => expect(navigation.reset).toHaveBeenCalledTimes(1));
  expect(mockConfirm).toHaveBeenCalledTimes(1);
  expect(mockConfirm).toHaveBeenCalledWith('123456', 'verification-1');
  expect(store.getState().auth).toMatchObject({
    isAuthenticated: true,
    sessionReady: true,
    kycCompleted: true,
    walletAddress: null,
  });
});
