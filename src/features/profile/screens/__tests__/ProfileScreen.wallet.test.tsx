import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import ProfileScreen from '../ProfileScreen';
import { retryWalletSetup } from '../../../auth/store/authSlice';

const mockDispatch = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), reset: jest.fn() }),
}));
jest.mock('react-native-device-info', () => ({
  getVersion: () => '1',
  getBuildNumber: () => '1',
}));
jest.mock('../../../../store', () => ({ resetAppState: jest.fn() }));
jest.mock('../../../../store/mmkvStorage', () => ({
  clearPersistedAppStatePreserveOnboarding: jest.fn(),
}));
jest.mock('../../../../services/firebase', () => ({
  signOutFirebase: jest.fn(),
}));
jest.mock('../../../../common/components/BottomSheet', () => () => null);
jest.mock('../../../../store/hooks', () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: (select: (state: unknown) => unknown) =>
    select({
      auth: {
        user: { name: 'Farmer', phone: '+919999999999' },
        walletAddress: null,
        kycCompleted: true,
        walletSetupStatus: 'error',
        walletSetupMessage: 'Wallet setup needs another attempt.',
      },
      credits: { balance: 0 },
      notifications: { unreadCount: 0 },
      profile: { walletRecoveryPending: false },
    }),
}));

it('offers recovery in the wallet card without turning setup errors into a global banner', () => {
  const screen = render(<ProfileScreen />);
  expect(screen.getByText('Wallet setup needs another attempt.')).toBeTruthy();
  fireEvent.press(screen.getByText('Retry wallet setup'));
  expect(mockDispatch).toHaveBeenCalledWith(retryWalletSetup());
  expect(
    mockDispatch.mock.calls.some(([action]) => action.type === 'ui/showBanner'),
  ).toBe(false);
});
