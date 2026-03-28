import {createSlice, type PayloadAction} from '@reduxjs/toolkit';

export interface UIState {
  bannerMessage: string | null;
  bannerType: 'error' | 'offline' | 'info' | null;
}

const initialState: UIState = {
  bannerMessage: null,
  bannerType: null,
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
  },
});

export const {showBanner, hideBanner} = uiSlice.actions;
export default uiSlice.reducer;
