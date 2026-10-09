import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import LoginScreen from '../LoginScreen';

const mockNavigate = jest.fn();
const mockSend = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, replace: jest.fn() }),
}));
jest.mock('../../../../services/firebase', () => ({
  sendPhoneOtp: (phone: string) => mockSend(phone),
  getCurrentFirebaseUser: () => null,
}));

it('opens OTP as soon as Firebase supplies the verification ID, without a logo timer or duplicate SMS request', async () => {
  jest.useFakeTimers();
  let finish!: (session: { verificationId: string }) => void;
  mockSend.mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  try {
    const screen = render(<LoginScreen />);
    fireEvent.changeText(
      screen.getByPlaceholderText('Enter 10-digit number'),
      '9999999999',
    );
    fireEvent.press(screen.getByText('Send OTP'));
    fireEvent.press(screen.getByText('Sending OTP...'));
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockNavigate).not.toHaveBeenCalled();
    await act(async () => finish({ verificationId: 'verification-1' }));
    expect(mockNavigate).toHaveBeenCalledWith('OTPScreen', {
      phone: '+919999999999',
      verificationId: 'verification-1',
    });
  } finally {
    jest.useRealTimers();
  }
});
