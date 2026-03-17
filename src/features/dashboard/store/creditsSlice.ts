import {createSlice, type PayloadAction} from '@reduxjs/toolkit';

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
}

export const creditsInitialState: CreditsState = {
  balance: 0,
  history: [],
  pendingMint: false,
};

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
  },
});

export const {setBalance, setHistory, setPendingMint} = creditsSlice.actions;
export default creditsSlice.reducer;
