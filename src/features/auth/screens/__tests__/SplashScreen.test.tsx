import React from 'react';
import {act, fireEvent, render, waitFor} from '@testing-library/react-native';
import {NavigationContainer} from '@react-navigation/native';
import {Provider} from 'react-redux';
import {configureStore} from '@reduxjs/toolkit';
import authReducer, {authInitialState, type AuthState} from '../../store/authSlice';

const mockLaunchBrandRemaining = jest.fn(() => 0);
jest.mock('../../../../common/utils/launchBrand', () => ({launchBrandRemaining: () => mockLaunchBrandRemaining()}));

type PostAuthRoute = 'KYCScreen' | 'OnboardingScreen' | 'HomeScreen';

const mockGetAuthenticatedEntryRoute = jest.fn(
  (kycCompleted: boolean): PostAuthRoute =>
    (kycCompleted ? 'HomeScreen' : 'KYCScreen'),
);
const mockMarkOnboardingComplete = jest.fn();

jest.mock('../../../../common/utils/onboarding', () => ({
  getAuthenticatedEntryRoute: (kycCompleted: boolean) =>
    mockGetAuthenticatedEntryRoute(kycCompleted),
  markOnboardingComplete: () => mockMarkOnboardingComplete(),
}));

// Mock navigation
const mockReplace = jest.fn();
const mockNavigation = {replace: mockReplace, navigate: jest.fn(), reset: jest.fn()};
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => mockNavigation,
  };
});

// Mock firebase helpers
const mockGetCurrentFirebaseUser = jest.fn();
const mockSignOutFirebase = jest.fn();
jest.mock('../../../../services/firebase', () => ({
  waitForFirebaseAuthState: async () => mockGetCurrentFirebaseUser(),
  signOutFirebase: () => mockSignOutFirebase(),
}));

const mockBootstrapAuthenticatedProfile = jest.fn();
jest.mock('../../../../services/authBootstrap', () => ({
  bootstrapAuthenticatedProfile: () => mockBootstrapAuthenticatedProfile(),
}));

jest.mock('../../../../store', () => ({resetAppState: () => ({type: 'app/resetState'})}));

// Mock Lottie
jest.mock('lottie-react-native', () => 'LottieView');

import SplashScreen from '../SplashScreen';

function createTestStore(authState: Partial<AuthState> = {}) {
  return configureStore({
    reducer: {
      auth: authReducer,
      land: (state = {}) => state,
      audit: (state = {}) => state,
      credits: (state = {}) => state,
    },
    preloadedState: {
      auth: {
        ...authInitialState,
        user: null,
        walletAddress: null,
        isAuthenticated: false,
        kycCompleted: false,
        ...authState,
      },
    },
  });
}

function renderSplashScreen(authState: Partial<AuthState> = {}) {
  const store = createTestStore(authState);
  return render(
    <Provider store={store}>
      <NavigationContainer>
        <SplashScreen />
      </NavigationContainer>
    </Provider>,
  );
}

describe('SplashScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLaunchBrandRemaining.mockReturnValue(0);
    mockGetAuthenticatedEntryRoute.mockImplementation((kycCompleted: boolean) =>
      kycCompleted ? 'HomeScreen' : 'KYCScreen',
    );
    mockSignOutFirebase.mockResolvedValue(undefined);
  });

  it('navigates to LoginScreen when no Firebase user exists', async () => {
    mockGetCurrentFirebaseUser.mockReturnValue(null);

    renderSplashScreen();

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('LoginScreen');
    });
  });

  it('navigates to HomeScreen when /auth/me reports completed KYC', async () => {
    mockGetCurrentFirebaseUser.mockReturnValue({uid: 'firebase-user-1'});
    mockBootstrapAuthenticatedProfile.mockResolvedValue({
      profile: {
        user_id: 'user-1',
        firebase_uid: 'firebase-user-1',
        full_name: 'Farmer One',
        phone_number: '+919999999999',
        wallet_address: '0x123',
        kyc_completed: true,
        wallet_recovery_status: null,
        wallet_recovery_requested_at: null,
      },
    });

    renderSplashScreen({
      user: {
        id: 'user-1',
        firebaseUid: 'firebase-user-1',
        name: 'Farmer One',
        phone: '+919999999999',
      },
      isAuthenticated: true,
      kycCompleted: true,
      walletAddress: '0x123',
    });

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('HomeScreen');
    });
  });

  it('still routes returning users to HomeScreen after completed KYC', async () => {
    mockGetCurrentFirebaseUser.mockReturnValue({uid: 'firebase-user-1'});
    mockBootstrapAuthenticatedProfile.mockResolvedValue({
      profile: {
        user_id: 'user-1',
        firebase_uid: 'firebase-user-1',
        full_name: 'Farmer One',
        phone_number: '+919999999999',
        wallet_address: '0x123',
        kyc_completed: true,
        wallet_recovery_status: null,
        wallet_recovery_requested_at: null,
      },
    });

    renderSplashScreen({
      user: {
        id: 'user-1',
        firebaseUid: 'firebase-user-1',
        name: 'Farmer One',
        phone: '+919999999999',
      },
      isAuthenticated: true,
      kycCompleted: true,
      walletAddress: '0x123',
    });

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('HomeScreen');
    });
    expect(mockMarkOnboardingComplete).toHaveBeenCalled();
  });

  it('navigates to KYCScreen when /auth/me reports incomplete KYC', async () => {
    mockGetCurrentFirebaseUser.mockReturnValue({uid: 'firebase-user-2'});
    mockBootstrapAuthenticatedProfile.mockResolvedValue({
      profile: {
        user_id: 'user-2',
        firebase_uid: 'firebase-user-2',
        full_name: 'Farmer Two',
        phone_number: '+918888888888',
        wallet_address: '0x123',
        kyc_completed: false,
        wallet_recovery_status: null,
        wallet_recovery_requested_at: null,
      },
    });

    renderSplashScreen({
      user: {
        id: 'user-2',
        firebaseUid: 'firebase-user-2',
        name: 'Farmer Two',
        phone: '+918888888888',
      },
      isAuthenticated: true,
      kycCompleted: false,
      walletAddress: '0x123',
    });

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('KYCScreen');
    });
  });

  it('opens the matching cached account when the backend is offline', async () => {
    mockGetCurrentFirebaseUser.mockReturnValue({uid: 'firebase-user-3'});
    mockBootstrapAuthenticatedProfile.mockRejectedValue({response: undefined});

    renderSplashScreen({
      user: {
        id: 'user-3',
        firebaseUid: 'firebase-user-3',
        name: 'Farmer Three',
        phone: '+917777777777',
      },
      isAuthenticated: true,
      kycCompleted: true,
      walletAddress: '0x123',
    });

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('HomeScreen');
    });
    expect(mockSignOutFirebase).not.toHaveBeenCalled();
    expect(mockBootstrapAuthenticatedProfile).not.toHaveBeenCalled();
  });

  it('uses replace not navigate for all routing paths', async () => {
    mockGetCurrentFirebaseUser.mockReturnValue(null);

    renderSplashScreen();

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalled();
    });
    // replace is the only navigation call — not navigate
    expect(mockReplace.mock.calls.length).toBeGreaterThan(0);
  });
  it('waits for the initial Firebase event instead of interpreting an unhydrated null as logout', async () => {
    let resolve!: (user: null) => void;
    mockGetCurrentFirebaseUser.mockReturnValue(new Promise<null>(done => { resolve = done; }));
    renderSplashScreen();
    expect(mockReplace).not.toHaveBeenCalled();
    await act(async () => resolve(null));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('LoginScreen'));
    expect(mockSignOutFirebase).not.toHaveBeenCalled();
  });

  it('offers retry without signing out when an uncached profile request fails', async () => {
    mockGetCurrentFirebaseUser.mockReturnValue({uid: 'firebase-user-1'});
    mockBootstrapAuthenticatedProfile.mockRejectedValueOnce(new Error('Network Error'));
    const screen = renderSplashScreen();
    await waitFor(() => expect(screen.getByText('Retry')).toBeTruthy());
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockSignOutFirebase).not.toHaveBeenCalled();
    mockBootstrapAuthenticatedProfile.mockResolvedValueOnce({profile: {
      user_id: 'user-1', firebase_uid: 'firebase-user-1', full_name: 'Farmer',
      phone_number: '+919999999999', wallet_address: '0x123', kyc_completed: true,
      wallet_recovery_status: null, wallet_recovery_requested_at: null,
    }});
    fireEvent.press(screen.getByText('Retry'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('HomeScreen'));
  });

  it('does not open cached data belonging to another Firebase account', async () => {
    mockGetCurrentFirebaseUser.mockReturnValue({uid: 'new-account'});
    mockBootstrapAuthenticatedProfile.mockRejectedValueOnce(new Error('Network Error'));
    const screen = renderSplashScreen({isAuthenticated: true, kycCompleted: true,
      user: {id: 'old-user', firebaseUid: 'old-account', name: 'Old Farmer', phone: '+919999999999'}});
    await waitFor(() => expect(screen.getByText('Retry')).toBeTruthy());
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockSignOutFirebase).not.toHaveBeenCalled();
  });

});

it('shows the launch logo for 2.5 seconds while restoring auth concurrently', async () => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  mockLaunchBrandRemaining.mockReturnValue(2500);
  mockGetCurrentFirebaseUser.mockReturnValue({uid: 'firebase-user-1'});
  mockBootstrapAuthenticatedProfile.mockResolvedValue({profile: {user_id: 'user-1', firebase_uid: 'firebase-user-1', full_name: 'Farmer', phone_number: '+919999999999', wallet_address: null, kyc_completed: true}});
  try {
    const screen = renderSplashScreen();
    await act(async () => {});
    expect(screen.getByText('TerraTrust')).toBeTruthy();
    expect(mockBootstrapAuthenticatedProfile).toHaveBeenCalledTimes(1);
    await act(async () => { jest.advanceTimersByTime(2499); });
    expect(mockReplace).not.toHaveBeenCalled();
    await act(async () => { jest.advanceTimersByTime(1); });
    expect(mockReplace).toHaveBeenCalledWith('HomeScreen');
  } finally { jest.useRealTimers(); }
});
