import {createSlice, type PayloadAction} from '@reduxjs/toolkit';

export interface ProfileState {
  notificationsEnabled: boolean;
  gpsHighAccuracy: boolean;
  walletRecoveryPending: boolean;
  pendingWalletAddress: string | null;
}

export const profileInitialState: ProfileState = {
  notificationsEnabled: true,
  gpsHighAccuracy: true,
  walletRecoveryPending: false,
  pendingWalletAddress: null,
};

const profileSlice = createSlice({
  name: 'profile',
  initialState: profileInitialState,
  reducers: {
    setNotificationsEnabled(state, action: PayloadAction<boolean>) {
      state.notificationsEnabled = action.payload;
    },
    setGpsHighAccuracy(state, action: PayloadAction<boolean>) {
      state.gpsHighAccuracy = action.payload;
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
  setWalletRecoveryPending,
  setPendingWalletAddress,
} = profileSlice.actions;
export default profileSlice.reducer;