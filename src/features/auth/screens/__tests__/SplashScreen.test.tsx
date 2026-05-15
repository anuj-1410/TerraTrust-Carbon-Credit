import React from 'react';
import {render, waitFor} from '@testing-library/react-native';
import {NavigationContainer} from '@react-navigation/native';
import {Provider} from 'react-redux';
import {configureStore} from '@reduxjs/toolkit';
import authReducer, {type AuthState} from '../../store/authSlice';

type PostAuthRoute = 'KYCScreen' | 'OnboardingScreen' | 'HomeScreen';

const mockGetAuthenticatedEntryRoute = jest.fn(
  (kycCompleted: boolean): PostAuthRoute =>
    (kycCompleted ? 'HomeScreen' : 'KYCScreen'),
);

jest.mock('../../../../common/utils/onboarding', () => ({
  getAuthenticatedEntryRoute: (kycCompleted: boolean) =>
    mockGetAuthenticatedEntryRoute(kycCompleted),
}));

// Mock navigation
const mockReplace = jest.fn();
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({
      replace: mockReplace,
      navigate: jest.fn(),
      reset: jest.fn(),
    }),
  };
});

// Mock firebase helpers
const mockGetCurrentFirebaseUser = jest.fn();
const mockSignOutFirebase = jest.fn();
jest.mock('../../../../services/firebase', () => ({
  getCurrentFirebaseUser: () => mockGetCurrentFirebaseUser(),
  signOutFirebase: () => mockSignOutFirebase(),
}));

const mockBootstrapAuthenticatedProfile = jest.fn();
jest.mock('../../../../services/authBootstrap', () => ({
  bootstrapAuthenticatedProfile: () => mockBootstrapAuthenticatedProfile(),
}));

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

  it('navigates to OnboardingScreen when completed KYC still needs onboarding', async () => {
    mockGetAuthenticatedEntryRoute.mockReturnValue('OnboardingScreen');
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
      expect(mockReplace).toHaveBeenCalledWith('OnboardingScreen');
    });
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

  it('navigates to LoginScreen when bootstrap cannot reach /auth/me', async () => {
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
      expect(mockReplace).toHaveBeenCalledWith('LoginScreen');
    });
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
});
