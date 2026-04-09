import {createSlice, type PayloadAction} from '@reduxjs/toolkit';

export interface ProfileState {
  settingsNotificationsEnabled: boolean;
  settingsHighAccuracyGPS: boolean;
  onboardingComplete: boolean;
  walletRecoveryPending: boolean;
  pendingWalletAddress: string | null;
}

export const profileInitialState: ProfileState = {
  settingsNotificationsEnabled: true,
  settingsHighAccuracyGPS: true,
  onboardingComplete: false,
  walletRecoveryPending: false,
  pendingWalletAddress: null,
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
    setWalletRecoveryPending(state, action: PayloadAction<boolean>) {
      state.walletRecoveryPending = action.payload;
    },
    setPendingWalletAddress(state, action: PayloadAction<string | null>) {
      state.pendingWalletAddress = action.payload;
    },
  },
});

export const {
  setNotificationsEnabled,
  setGpsHighAccuracy,
  setOnboardingComplete,
  setWalletRecoveryPending,
  setPendingWalletAddress,
} = profileSlice.actions;
export default profileSlice.reducer;