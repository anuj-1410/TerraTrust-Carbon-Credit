import {createSlice, type PayloadAction} from '@reduxjs/toolkit';

export type WalletRecoveryStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'COMPLETED'
  | null;

export interface ProfileState {
  settingsNotificationsEnabled: boolean;
  settingsHighAccuracyGPS: boolean;
  onboardingComplete: boolean;
  walletRecoveryPending: boolean;
  walletRecoveryStatus: WalletRecoveryStatus;
  walletRecoveryRequestedAt: string | null;
}

export const profileInitialState: ProfileState = {
  settingsNotificationsEnabled: true,
  settingsHighAccuracyGPS: true,
  onboardingComplete: false,
  walletRecoveryPending: false,
  walletRecoveryStatus: null,
  walletRecoveryRequestedAt: null,
};

const profileSlice = createSlice({
  name: 'profile',
  initialState: profileInitialState,
  reducers: {
    setNotificationsEnabled(state, action: PayloadAction<boolean>) {
      state.settingsNotificationsEnabled = action.payload;
    },
    setGpsHighAccuracy(state, action: PayloadAction<boolean>) {
      state.settingsHighAccuracyGPS = action.payload;
    },
    setOnboardingComplete(state, action: PayloadAction<boolean>) {
      state.onboardingComplete = action.payload;
    },
    setWalletRecoveryState(
      state,
      action: PayloadAction<{
        status: WalletRecoveryStatus;
        requestedAt?: string | null;
      }>,
    ) {
      state.walletRecoveryStatus = action.payload.status;
      state.walletRecoveryPending = action.payload.status === 'PENDING';
      state.walletRecoveryRequestedAt = action.payload.requestedAt ?? null;
    },
  },
});

export const {
  setNotificationsEnabled,
  setGpsHighAccuracy,
  setOnboardingComplete,
  setWalletRecoveryState,
} = profileSlice.actions;
export default profileSlice.reducer;