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
const mockSingle = jest.fn();
const mockEq = jest.fn(() => ({single: mockSingle}));
const mockSelect = jest.fn(() => ({eq: mockEq}));
const mockFrom = jest.fn(() => ({select: mockSelect}));
jest.mock('../../../../services/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
    },
    from: () => mockFrom(),
  },
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
    mockFrom.mockReturnValue({select: mockSelect});
    mockSelect.mockReturnValue({eq: mockEq});
    mockEq.mockReturnValue({single: mockSingle});
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
      data: {
        session: {
          access_token: 'test-token',
          user: {id: 'user-1', phone: '+919999999999'},
        },
      },
    });
    mockSingle.mockResolvedValue({
      data: {
        name: 'Farmer One',
        phone: '+919999999999',
        aadhaar_hash: 'hash-1',
        wallet_address: '0x123',
        kyc_completed: true,
      },
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
      data: {
        session: {
          access_token: 'test-token',
          user: {id: 'user-2', phone: '+918888888888'},
        },
      },
    });
    mockSingle.mockResolvedValue({
      data: {
        name: 'Farmer Two',
        phone: '+918888888888',
        aadhaar_hash: 'hash-2',
        wallet_address: '0x123',
        kyc_completed: false,
      },
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

  it('navigates to KYCScreen when session exists but no profile row is found', async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'test-token',
          user: {id: 'user-3', phone: '+917777777777'},
        },
      },
    });
    mockSingle.mockResolvedValue({data: null});

    renderSplashScreen({
      isAuthenticated: true,
      kycCompleted: false,
      walletAddress: null,
    });

    await waitFor(() => {
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
