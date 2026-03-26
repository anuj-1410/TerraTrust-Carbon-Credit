import {createSlice, createAsyncThunk, type PayloadAction} from '@reduxjs/toolkit';
import type {RootState} from '../../../store';
import api from '../../../services/api';
import {getCTTBalance} from '../../../services/blockchain';

export interface AuditRecord {
  audit_id: string;
  audit_year: number;
  land_id: string;
  land_name: string;
  credits_issued: number;
  total_biomass_tonnes: number;
  tx_hash: string;
  ipfs_certificate_url: string;
  minted_at: string;
}

export interface CreditsState {
  balance: number;
  history: AuditRecord[];
  pendingMint: boolean;
  lastFetchedAt: string | null;
}

export const creditsInitialState: CreditsState = {
  balance: 0,
  history: [],
  pendingMint: false,
  lastFetchedAt: null,
};

export const fetchCreditsThunk = createAsyncThunk<
  void,
  string,
  {state: RootState}
>('credits/fetchCredits', async (walletAddress, {dispatch, getState}) => {
  const response = await api.get(
    `/api/v1/credits/balance?wallet_address=${encodeURIComponent(walletAddress)}`,
  );
  dispatch(setHistory(response.data.history));

  try {
    const blockchainBalance = await getCTTBalance(walletAddress);
    dispatch(setBalance(blockchainBalance));
  } catch {
    dispatch(setBalance(response.data.balance_ctt));
  }

  const state = getState();
  if (state.credits.pendingMint) {
    dispatch(setPendingMint(false));
  }

  dispatch(setLastFetchedAt(new Date().toISOString()));
});

const creditsSlice = createSlice({
  name: 'credits',
  initialState: creditsInitialState,
  reducers: {
    setBalance(state, action: PayloadAction<number>) {
      state.balance = action.payload;
    },
    setHistory(state, action: PayloadAction<AuditRecord[]>) {
      state.history = action.payload;
    },
    setPendingMint(state, action: PayloadAction<boolean>) {
      state.pendingMint = action.payload;
    },
    setLastFetchedAt(state, action: PayloadAction<string>) {
      state.lastFetchedAt = action.payload;
    },
  },
});

export const {setBalance, setHistory, setPendingMint, setLastFetchedAt} =
  creditsSlice.actions;
export default creditsSlice.reducer;
