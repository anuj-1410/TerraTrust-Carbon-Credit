import {createSlice, type PayloadAction} from '@reduxjs/toolkit';

export interface AuthUser {
  id: string;
  name: string;
  phone: string;
  aadhaar_hash: string;
}

export interface AuthState {
  user: AuthUser | null;
  walletAddress: string | null;
  isAuthenticated: boolean;
  kycCompleted: boolean;
}

export const authInitialState: AuthState = {
  user: null,
  walletAddress: null,
  isAuthenticated: false,
  kycCompleted: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState: authInitialState,
  reducers: {
    setUser(state, action: PayloadAction<AuthUser>) {
      state.user = action.payload;
      state.isAuthenticated = true;
    },
    setWalletAddress(state, action: PayloadAction<string>) {
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
    },
  },
});

export const {setUser, setWalletAddress, setKycCompleted, logout} =
  authSlice.actions;
export default authSlice.reducer;
