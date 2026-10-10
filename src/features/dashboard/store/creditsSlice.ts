import {
  createSlice,
  createAsyncThunk,
  type PayloadAction,
} from '@reduxjs/toolkit';
import type { RootState } from '../../../store';
import api from '../../../services/api';

export interface AuditRecord {
  audit_id?: string;
  land_id?: string;
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
  historyPreview: AuditRecord[];
  pendingMint: boolean;
  lastFetchedAt: string | null;
  historyPage: number;
  historyLimit: number;
  historyTotal: number;
  historyHasMore: boolean;
  historyRequestId: string | null;
  previewRequestId: string | null;
  balanceRequestId: string | null;
}

export const creditsInitialState: CreditsState = {
  balance: 0,
  history: [],
  historyPreview: [],
  pendingMint: false,
  lastFetchedAt: null,
  historyPage: 1,
  historyLimit: 20,
  historyTotal: 0,
  historyHasMore: false,
  historyRequestId: null,
  previewRequestId: null,
  balanceRequestId: null,
};

interface FetchCreditsArgs {
  page?: number;
  limit?: number;
  append?: boolean;
  previewOnly?: boolean;
  allHistory?: boolean;
}

export function getAuditRecordKey(record: AuditRecord): string {
  return (
    record.audit_id ??
    `${record.minted_at}|${record.audit_year}|${
      record.land_id ?? record.land_name
    }|${record.tx_hash}`
  );
}

function mergeHistory(
  existingHistory: AuditRecord[],
  incomingHistory: AuditRecord[],
): AuditRecord[] {
  const mergedHistory = [...existingHistory];
  const existingKeys = new Set(existingHistory.map(getAuditRecordKey));

  incomingHistory.forEach(record => {
    const key = getAuditRecordKey(record);
    if (!existingKeys.has(key)) {
      existingKeys.add(key);
      mergedHistory.push(record);
    }
  });

  return mergedHistory;
}

export const fetchCreditsThunk = createAsyncThunk<
  void,
  FetchCreditsArgs | void,
  { state: RootState }
>(
  'credits/fetchCredits',
  async (args, { dispatch, getState, requestId, signal }) => {
    let page = args?.page ?? 1;
    const limit = args?.limit ?? 20;
    const append = args?.append ?? page > 1;
    const previewOnly = args?.previewOnly ?? false;
    const owner = getState().auth.user?.firebaseUid;
    let collected = append ? getState().credits.history : [];
    const assertCurrent = () => {
      const state = getState();
      if (
        signal.aborted ||
        !state.auth.sessionReady ||
        state.auth.user?.firebaseUid !== owner ||
        (previewOnly
          ? state.credits.previewRequestId
          : state.credits.historyRequestId) !== requestId
      ) {
        throw new Error('CREDITS_REQUEST_SUPERSEDED');
      }
    };

    do {
      assertCurrent();
      const response = await api.get('/api/v1/credits/balance', {
        params: { page, limit },
        signal,
      });
      assertCurrent();
      const responseData = response.data as {
        balance_ctt?: number;
        history?: AuditRecord[];
        items?: AuditRecord[];
        page?: number;
        limit?: number;
        total?: number;
        has_more?: boolean;
      };
      const history = Array.isArray(responseData.history)
        ? responseData.history
        : Array.isArray(responseData.items)
        ? responseData.items
        : [];
      const apiBalance = Number(responseData.balance_ctt ?? 0);
      const total = Number(responseData.total ?? history.length);
      const nextPage = Number(responseData.page ?? page);
      const nextLimit = Number(responseData.limit ?? limit);
      const hasMore =
        typeof responseData.has_more === 'boolean'
          ? responseData.has_more
          : nextPage * nextLimit < total;

      if (previewOnly) {
        dispatch(setHistoryPreview(history.slice(0, 2)));
      } else {
        const nextHistory = mergeHistory(collected, history);
        if (
          args?.allHistory &&
          hasMore &&
          (nextPage !== page || nextHistory.length === collected.length)
        ) {
          throw new Error('CREDITS_PAGINATION_STALLED');
        }
        collected = nextHistory;

        dispatch(setHistory(nextHistory));
        dispatch(
          setHistoryPagination({
            page: nextPage,
            limit: nextLimit,
            total,
            hasMore,
          }),
        );
        dispatch(setHistoryPreview(nextHistory.slice(0, 2)));
      }

      if (getState().credits.balanceRequestId === requestId) {
        dispatch(setBalance(apiBalance));
      }
      dispatch(setLastFetchedAt(new Date().toISOString()));
      if (!args?.allHistory || previewOnly || !hasMore) {
        break;
      }
      page = nextPage + 1;
    } while (true);
  },
  {
    condition: (_, { getState }) =>
      Boolean(getState().auth.sessionReady && getState().auth.user),
  },
);

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
    setHistoryPreview(state, action: PayloadAction<AuditRecord[]>) {
      state.historyPreview = action.payload;
    },
    setHistoryPagination(
      state,
      action: PayloadAction<{
        page: number;
        limit: number;
        total: number;
        hasMore: boolean;
      }>,
    ) {
      state.historyPage = action.payload.page;
      state.historyLimit = action.payload.limit;
      state.historyTotal = action.payload.total;
      state.historyHasMore = action.payload.hasMore;
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
  extraReducers: builder => {
    builder.addCase(fetchCreditsThunk.pending, (state, action) => {
      if (action.meta.arg?.previewOnly) {
        state.previewRequestId = action.meta.requestId;
      } else {
        state.historyRequestId = action.meta.requestId;
      }
      state.balanceRequestId = action.meta.requestId;
    });
  },
});

export const {
  setBalance,
  setHistory,
  setHistoryPreview,
  setHistoryPagination,
  setPendingMint,
  mintConfirmed,
  setLastFetchedAt,
} = creditsSlice.actions;
export default creditsSlice.reducer;
