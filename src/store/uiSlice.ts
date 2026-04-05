import {createSlice, type PayloadAction} from '@reduxjs/toolkit';

export interface UIState {
  bannerMessage: string | null;
  bannerType: 'error' | 'offline' | 'info' | null;
  maintenanceMode: boolean;
  maintenanceMessage: string | null;
}

const initialState: UIState = {
  bannerMessage: null,
  bannerType: null,
  maintenanceMode: false,
  maintenanceMessage: null,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    showBanner(
      state,
      action: PayloadAction<{message: string; type: 'error' | 'offline' | 'info'}>,
    ) {
      state.bannerMessage = action.payload.message;
      state.bannerType = action.payload.type;
    },
    hideBanner(state) {
      state.bannerMessage = null;
      state.bannerType = null;
    },
    setMaintenance(
      state,
      action: PayloadAction<{message?: string | null} | undefined>,
    ) {
      state.maintenanceMode = true;
      state.maintenanceMessage = action.payload?.message ?? null;
    },
    clearMaintenance(state) {
      state.maintenanceMode = false;
      state.maintenanceMessage = null;
    },
  },
});

export const {showBanner, hideBanner, setMaintenance, clearMaintenance} =
  uiSlice.actions;
export default uiSlice.reducer;
