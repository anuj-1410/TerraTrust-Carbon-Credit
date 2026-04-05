import {createSlice, createAsyncThunk, type PayloadAction} from '@reduxjs/toolkit';
import type {RootState} from '../../../store';
import api from '../../../services/api';
import {getCTTBalance} from '../../../services/blockchain';

export interface AuditRecord {
  audit_year: number;
  credits_issued: number;
  land_name: string;
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
  void,
  {state: RootState}
>('credits/fetchCredits', async (_, {dispatch, getState}) => {
  const response = await api.get('/api/v1/credits/balance');
  const walletAddress = getState().auth.walletAddress;
  const responseData = response.data as {
    balance_ctt?: number;
    history?: AuditRecord[];
    items?: AuditRecord[];
  };
  const history = Array.isArray(responseData.history)
    ? responseData.history
    : Array.isArray(responseData.items)
      ? responseData.items
      : [];
  const apiBalance = Number(responseData.balance_ctt ?? 0);

  dispatch(setHistory(history));

  if (!walletAddress) {
    dispatch(setBalance(apiBalance));
    dispatch(setLastFetchedAt(new Date().toISOString()));
    return;
  }

  try {
    const blockchainBalance = await getCTTBalance(walletAddress);
    dispatch(setBalance(blockchainBalance));
  } catch {
    dispatch(setBalance(apiBalance));
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
    mintConfirmed(state) {
      state.pendingMint = false;
    },
    setLastFetchedAt(state, action: PayloadAction<string>) {
      state.lastFetchedAt = action.payload;
    },
  },
});

export const {setBalance, setHistory, setPendingMint, mintConfirmed, setLastFetchedAt} =
  creditsSlice.actions;
export default creditsSlice.reducer;
