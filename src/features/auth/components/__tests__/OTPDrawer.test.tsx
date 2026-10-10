import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import OTPDrawer from '../OTPDrawer';

const mockConfirm = jest.fn();
const mockBootstrap = jest.fn();
const mockSend = jest.fn();
let mockUser: { uid: string; phoneNumber: string } | null = null;
let mockObserver: (user: typeof mockUser) => void;
const mockUnsubscribe = jest.fn();
jest.mock('../../../../services/firebase', () => ({
  confirmPhoneOtp: (...args: unknown[]) => mockConfirm(...args),
  sendPhoneOtp: (...args: unknown[]) => mockSend(...args),
  getCurrentFirebaseUser: () => mockUser,
  observePhoneAuthentication: (callback: typeof mockObserver) => {
    mockObserver = callback;
    return mockUnsubscribe;
  },
}));
jest.mock('../../../../services/authBootstrap', () => ({
  bootstrapAuthenticatedProfile: () => mockBootstrap(),
}));
const phone = '+919999999999';
const profile = {
  user_id: 'user-1',
  firebase_uid: 'farmer-1',
  full_name: 'Farmer',
  phone_number: phone,
  wallet_address: null,
  kyc_completed: true,
  wallet_recovery_status: null,
  wallet_recovery_requested_at: null,
};
afterEach(() => jest.useRealTimers());

function setup() {
  const onClose = jest.fn();
  const onVerified = jest.fn();
  const screen = render(
    <OTPDrawer
      phone={phone}
      verificationId="verification-1"
      onClose={onClose}
      onVerified={onVerified}
    />,
  );
  return { screen, onClose, onVerified };
}
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockUser = null;
  mockConfirm.mockReset().mockImplementation(async () => {
    mockUser = { uid: 'farmer-1', phoneNumber: phone };
    return { user: mockUser };
  });
  mockBootstrap.mockReset().mockResolvedValue({ profile });
  mockSend.mockReset().mockResolvedValue({ verificationId: 'verification-2' });
});

it('automatically verifies a six-digit paste/autofill and completes once despite repeated submission', async () => {
  let finish!: () => void;
  mockConfirm.mockImplementation(
    () =>
      new Promise(resolve => {
        finish = () => {
          mockUser = { uid: 'farmer-1', phoneNumber: phone };
          resolve({ user: mockUser });
        };
      }),
  );
  const { screen, onVerified } = setup();
  fireEvent.changeText(screen.getByLabelText('Verification code'), '123456');
  fireEvent.changeText(screen.getByLabelText('Verification code'), '123456');
  expect(mockConfirm).toHaveBeenCalledTimes(1);
  await act(async () => finish());
  await waitFor(() => expect(onVerified).toHaveBeenCalledWith(profile));
  expect(onVerified).toHaveBeenCalledTimes(1);
  expect(mockConfirm).toHaveBeenCalledWith('123456', 'verification-1');
});

it('releases loading and clears a rejected code so the farmer can retry', async () => {
  mockConfirm.mockRejectedValueOnce({ code: 'auth/invalid-verification-code' });
  const { screen, onVerified } = setup();
  fireEvent.changeText(screen.getByLabelText('Verification code'), '123456');
  await waitFor(() =>
    expect(screen.getByText('Incorrect code. Please try again.')).toBeTruthy(),
  );
  expect(screen.getByLabelText('Verification code').props.value).toBe('');
  fireEvent.changeText(screen.getByLabelText('Verification code'), '654321');
  await waitFor(() => expect(onVerified).toHaveBeenCalledTimes(1));
  expect(mockConfirm).toHaveBeenCalledTimes(2);
});

it('handles Firebase auto-verification after SMS is sent without requiring any OTP entry', async () => {
  const { onVerified } = setup();
  await act(async () => {
    mockUser = { uid: 'farmer-1', phoneNumber: phone };
    mockObserver(mockUser);
  });
  await waitFor(() => expect(onVerified).toHaveBeenCalledTimes(1));
  expect(mockConfirm).not.toHaveBeenCalled();
});

it('ignores authentication for a different phone and accepts instant verification before mounting', async () => {
  mockUser = { uid: 'other-user', phoneNumber: '+918888888888' };
  const first = setup();
  await act(async () => {
    mockObserver(mockUser);
  });
  expect(first.onVerified).not.toHaveBeenCalled();
  first.screen.unmount();
  mockUser = { uid: 'farmer-1', phoneNumber: phone };
  const second = setup();
  await waitFor(() => expect(second.onVerified).toHaveBeenCalledTimes(1));
  expect(mockConfirm).not.toHaveBeenCalled();
});

it('retries account loading after accepted OTP without confirming the code again', async () => {
  mockBootstrap.mockRejectedValueOnce(new Error('Network Error'));
  const { screen, onVerified } = setup();
  fireEvent.changeText(screen.getByLabelText('Verification code'), '123456');
  await waitFor(() => expect(screen.getByText('Continue')).toBeTruthy());
  fireEvent.press(screen.getByText('Continue'));
  await waitFor(() => expect(onVerified).toHaveBeenCalledTimes(1));
  expect(mockConfirm).toHaveBeenCalledTimes(1);
});

it('lets the farmer dismiss the drawer while verifying and discards the late result', async () => {
  let finish!: () => void;
  mockConfirm.mockImplementation(
    () =>
      new Promise(resolve => {
        finish = () => {
          mockUser = { uid: 'farmer-1', phoneNumber: phone };
          resolve({ user: mockUser });
        };
      }),
  );
  const { screen, onVerified, onClose } = setup();
  fireEvent.changeText(screen.getByLabelText('Verification code'), '123456');
  fireEvent.press(screen.getByLabelText('Close verification drawer'));
  expect(onClose).toHaveBeenCalledTimes(1);
  screen.unmount();
  await act(async () => finish());
  expect(onVerified).not.toHaveBeenCalled();
  expect(mockBootstrap).not.toHaveBeenCalled();
  expect(mockUnsubscribe).toHaveBeenCalled();
});

it('resends with a new verification ID after the cooldown and uses it for the next code', async () => {
  jest.useFakeTimers();
  try {
    const { screen, onVerified } = setup();
    act(() => jest.advanceTimersByTime(30000));
    await act(async () => fireEvent.press(screen.getByText('Resend code')));
    expect(mockSend).toHaveBeenCalledWith(phone);
    await act(async () =>
      fireEvent.changeText(
        screen.getByLabelText('Verification code'),
        '654321',
      ),
    );
    expect(mockConfirm).toHaveBeenCalledWith('654321', 'verification-2');
    expect(onVerified).toHaveBeenCalledTimes(1);
  } finally {
    jest.useRealTimers();
  }
});
