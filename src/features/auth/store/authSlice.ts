import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { AuthBootstrapResponse } from '../../../services/firebase';

export interface AuthUser {
  id: string;
  firebaseUid: string;
  name: string;
  phone: string;
}

export interface AuthState {
  user: AuthUser | null;
  walletAddress: string | null;
  isAuthenticated: boolean;
  kycCompleted: boolean;
  /** Only true after Firebase has restored the identity for this launch. */
  sessionReady: boolean;
  profileFresh: boolean;
  walletSetupStatus: 'idle' | 'pending' | 'ready' | 'error';
  walletSetupMessage: string | null;
  walletSetupAttempt: number;
}

export const authInitialState: AuthState = {
  user: null,
  walletAddress: null,
  isAuthenticated: false,
  kycCompleted: false,
  sessionReady: false,
  profileFresh: false,
  walletSetupStatus: 'idle',
  walletSetupMessage: null,
  walletSetupAttempt: 0,
};

const authSlice = createSlice({
  name: 'auth',
  initialState: authInitialState,
  reducers: {
    setAuthenticatedProfile(
      state,
      action: PayloadAction<AuthBootstrapResponse>,
    ) {
      const profile = action.payload;
      state.user = {
        id: profile.user_id,
        firebaseUid: profile.firebase_uid,
        name: profile.full_name ?? '',
        phone: profile.phone_number,
      };
      state.walletAddress = profile.wallet_address;
      state.kycCompleted = profile.kyc_completed;
      state.isAuthenticated = true;
      state.sessionReady = true;
      state.profileFresh = true;
    },
    setWalletSetup(
      state,
      action: PayloadAction<{
        status: AuthState['walletSetupStatus'];
        message?: string;
      }>,
    ) {
      state.walletSetupStatus = action.payload.status;
      state.walletSetupMessage = action.payload.message ?? null;
    },
    retryWalletSetup(state) {
      state.walletSetupAttempt++;
    },
    setSessionReady(state, action: PayloadAction<boolean>) {
      state.sessionReady = action.payload;
    },
    setUser(state, action: PayloadAction<AuthUser>) {
      state.user = action.payload;
      state.isAuthenticated = true;
    },
    setWalletAddress(state, action: PayloadAction<string | null>) {
      state.walletAddress = action.payload;
    },
    setKycCompleted(state, action: PayloadAction<boolean>) {
      state.kycCompleted = action.payload;
    },
    logout(state) {
      state.user = null;
      state.walletAddress = null;
      state.isAuthenticated = false;
      state.kycCompleted = false;
      state.sessionReady = false;
      state.profileFresh = false;
      state.walletSetupStatus = 'idle';
      state.walletSetupMessage = null;
      state.walletSetupAttempt = 0;
    },
  },
});

export const {
  setWalletSetup,
  retryWalletSetup,
  setAuthenticatedProfile,
  setSessionReady,
  setUser,
  setWalletAddress,
  setKycCompleted,
  logout,
} = authSlice.actions;
export default authSlice.reducer;
