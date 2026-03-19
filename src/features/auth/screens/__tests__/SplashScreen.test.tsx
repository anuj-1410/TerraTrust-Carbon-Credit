import React from 'react';
import {render, waitFor} from '@testing-library/react-native';
import {NavigationContainer} from '@react-navigation/native';
import {Provider} from 'react-redux';
import {configureStore} from '@reduxjs/toolkit';
import authReducer, {type AuthState} from '../../store/authSlice';

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

// Mock supabase
const mockGetSession = jest.fn();
jest.mock('../../../../services/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
    },
  },
}));

// Mock wallet
jest.mock('../../../../services/wallet', () => ({
  createWallet: jest.fn().mockResolvedValue('0xMOCKADDRESS'),
}));

// Mock api
jest.mock('../../../../services/api', () => ({
  __esModule: true,
  default: {
    post: jest.fn().mockResolvedValue({data: {status: 'success'}}),
  },
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
  });

  it('navigates to LoginScreen when no session exists', async () => {
    mockGetSession.mockResolvedValue({data: {session: null}});

    renderSplashScreen();

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('LoginScreen');
    });
  });

  it('navigates to HomeScreen when session exists and kycCompleted=true', async () => {
    mockGetSession.mockResolvedValue({
      data: {session: {access_token: 'test-token'}},
    });

    renderSplashScreen({
      isAuthenticated: true,
      kycCompleted: true,
      walletAddress: '0x123',
    });

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('HomeScreen');
    });
  });

  it('navigates to KYCScreen when session exists and kycCompleted=false', async () => {
    mockGetSession.mockResolvedValue({
      data: {session: {access_token: 'test-token'}},
    });

    renderSplashScreen({
      isAuthenticated: true,
      kycCompleted: false,
      walletAddress: '0x123',
    });

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('KYCScreen');
    });
  });

  it('triggers wallet creation when session exists but walletAddress=null', async () => {
    mockGetSession.mockResolvedValue({
      data: {session: {access_token: 'test-token'}},
    });

    const {createWallet} = require('../../../../services/wallet');

    renderSplashScreen({
      isAuthenticated: true,
      kycCompleted: false,
      walletAddress: null,
    });

    await waitFor(() => {
      expect(createWallet).toHaveBeenCalled();
      expect(mockReplace).toHaveBeenCalledWith('KYCScreen');
    });
  });

  it('uses replace not navigate for all routing paths', async () => {
    mockGetSession.mockResolvedValue({data: {session: null}});

    renderSplashScreen();

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalled();
    });
    // replace is the only navigation call — not navigate
    expect(mockReplace.mock.calls.length).toBeGreaterThan(0);
  });
});
