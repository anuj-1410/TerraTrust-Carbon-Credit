import {createSlice, createAsyncThunk, type PayloadAction} from '@reduxjs/toolkit';
import api from '../../../services/api';
import {detectARTier as detectARTierBridge} from '../../../services/ar-bridge';
import {hashPhoto} from '../../../common/utils/hash';
import type {RootState} from '../../../store/index';

export type ARTier = 1 | 2 | 3;
export type UploadStatus =
  | 'idle'
  | 'uploading'
  | 'processing'
  | 'success'
  | 'error'
  | 'offline';

export interface GPS {
  lat: number;
  lng: number;
}

export interface SamplingZone {
  zone_id: string;
  label: string;
  centre_gps: GPS;
  radius_metres: number;
  zone_type: 'high_density' | 'medium_density' | 'low_density';
  sequence_order: number;
  gedi_available: boolean;
  trees_scanned: number;
  is_complete: boolean;
}

export interface TreeSample {
  tree_id: string;
  zone_id: string;
  species: string;
  species_confidence: number;
  dbh_cm: number;
  wood_density: number;
  ar_height_m: number | null;
  measurement_tier: ARTier;
  confidence_score: number | null;
  gps_lat: number;
  gps_lng: number;
  gps_accuracy_m: number;
  evidence_photo_base64: string;
  evidence_photo_hash: string;
  scan_timestamp: string;
}

export interface AuditZonesResponse {
  audit_id: string;
  zones: Array<{
    zone_id: string;
    label: string;
    centre_gps: GPS;
    radius_metres: 7 | 9 | 11;
    zone_type: 'high_density' | 'medium_density' | 'low_density';
    sequence_order: number;
    gedi_available: boolean;
  }>;
  walking_path_metres: number;
  min_trees_required: number;
}

export interface AuditState {
  activeAuditId: string | null;
  activeLandId: string | null;
  zones: SamplingZone[];
  currentZoneIndex: number;
  scannedTrees: TreeSample[];
  arTier: ARTier;
  sessionComplete: boolean;
  uploadStatus: UploadStatus;
  walkingPathMetres: number;
  minTreesRequired: number;
  errorMessage: string | null;
}

export const auditInitialState: AuditState = {
  activeAuditId: null,
  activeLandId: null,
  zones: [],
  currentZoneIndex: 0,
  scannedTrees: [],
  arTier: 3,
  sessionComplete: false,
  uploadStatus: 'idle',
  walkingPathMetres: 0,
  minTreesRequired: 9,
  errorMessage: null,
};

// --- Async Thunks ---

export const fetchZones = createAsyncThunk<
  AuditZonesResponse,
  string,
  {rejectValue: string}
>('audit/fetchZones', async (landId, {rejectWithValue}) => {
  try {
    const response = await api.get<AuditZonesResponse>(
      `/api/v1/audit/zones?land_id=${encodeURIComponent(landId)}`,
    );
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 401) {
      return rejectWithValue('Your session has expired. Please log in again.');
    }
    if (error.response?.status === 404) {
      return rejectWithValue('Land parcel not found.');
    }
    if (error.response?.data?.error) {
      return rejectWithValue(error.response.data.error);
    }
    return rejectWithValue(
      'Unable to generate sampling zones. Please check your connection and try again.',
    );
  }
});

export const detectAndSetARTier = createAsyncThunk<ARTier>(
  'audit/detectAndSetARTier',
  async () => {
    return await detectARTierBridge();
  },
);

export const submitAudit = createAsyncThunk<
  {audit_id: string},
  void,
  {state: RootState; rejectValue: string}
>('audit/submitAudit', async (_, {getState, rejectWithValue}) => {
  const state = getState();
  const audit = state.audit as unknown as AuditState;
  const {activeAuditId, activeLandId, scannedTrees} = audit;

  if (!activeAuditId || !activeLandId) {
    return rejectWithValue('No active audit session.');
  }

  const payload = {
    land_id: activeLandId,
    audit_id: activeAuditId,
    trees: scannedTrees.map(tree => ({
      zone_id: tree.zone_id,
      species: tree.species,
      dbh_cm: tree.dbh_cm,
      height_m: tree.ar_height_m,
      gps: {lat: tree.gps_lat, lng: tree.gps_lng},
      ar_tier_used: tree.measurement_tier,
      confidence_score: tree.confidence_score,
      evidence_photo_base64: tree.evidence_photo_base64,
      evidence_photo_hash: hashPhoto(tree.evidence_photo_base64),
    })),
  };

  try {
    await api.post('/api/v1/audit/submit-samples', payload);
    return {audit_id: activeAuditId};
  } catch (error: any) {
    if (!error.response) {
      return rejectWithValue('__OFFLINE__');
    }
    if (error.response?.data?.error) {
      return rejectWithValue(error.response.data.error);
    }
    return rejectWithValue('Submission failed. Please try again.');
  }
});

export const pollAuditResult = createAsyncThunk<
  {status: string; [key: string]: any},
  string,
  {rejectValue: string}
>('audit/pollAuditResult', async (auditId, {rejectWithValue}) => {
  const maxAttempts = 60; // 5 min max (60 * 5s)
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await api.get(`/api/v1/audit/result/${encodeURIComponent(auditId)}`);
      if (res.data.status !== 'CALCULATING') {
        return res.data;
      }
    } catch (error: any) {
      return rejectWithValue('Failed to check audit status. Please try again.');
    }
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  return rejectWithValue('Audit processing timed out. Please check back later.');
});

const auditSlice = createSlice({
  name: 'audit',
  initialState: auditInitialState,
  reducers: {
    startAudit(
      state,
      action: PayloadAction<{auditId: string; landId: string}>,
    ) {
      state.activeAuditId = action.payload.auditId;
      state.activeLandId = action.payload.landId;
      state.sessionComplete = false;
      state.uploadStatus = 'idle';
      state.errorMessage = null;
    },
    setZones(state, action: PayloadAction<SamplingZone[]>) {
      state.zones = action.payload;
    },
    setCurrentZoneIndex(state, action: PayloadAction<number>) {
      state.currentZoneIndex = action.payload;
    },
    addScannedTree(state, action: PayloadAction<TreeSample>) {
      state.scannedTrees.push(action.payload);
    },
    setArTier(state, action: PayloadAction<ARTier>) {
      state.arTier = action.payload;
    },
    setUploadStatus(state, action: PayloadAction<UploadStatus>) {
      state.uploadStatus = action.payload;
    },
    setSessionComplete(state, action: PayloadAction<boolean>) {
      state.sessionComplete = action.payload;
    },
    setErrorMessage(state, action: PayloadAction<string | null>) {
      state.errorMessage = action.payload;
    },
    resetAudit(state) {
      Object.assign(state, auditInitialState);
    },
  },
  extraReducers: builder => {
    builder
      // fetchZones
      .addCase(fetchZones.fulfilled, (state, action) => {
        const {audit_id, zones, walking_path_metres, min_trees_required} =
          action.payload;
        state.activeAuditId = audit_id;
        state.activeLandId = action.meta.arg;
        state.zones = zones.map(z => ({
          ...z,
          trees_scanned: 0,
          is_complete: false,
        }));
        state.walkingPathMetres = walking_path_metres;
        state.minTreesRequired = min_trees_required;
        state.errorMessage = null;
      })
      .addCase(fetchZones.rejected, (state, action) => {
        state.errorMessage = action.payload ?? 'Failed to load zones.';
      })
      // detectAndSetARTier
      .addCase(detectAndSetARTier.fulfilled, (state, action) => {
        state.arTier = action.payload;
      })
      // submitAudit
      .addCase(submitAudit.pending, state => {
        state.uploadStatus = 'uploading';
        state.errorMessage = null;
      })
      .addCase(submitAudit.fulfilled, state => {
        state.uploadStatus = 'processing';
      })
      .addCase(submitAudit.rejected, (state, action) => {
        if (action.payload === '__OFFLINE__') {
          state.uploadStatus = 'offline';
          state.errorMessage = 'Saved for upload when you\'re back online.';
        } else {
          state.uploadStatus = 'error';
          state.errorMessage = action.payload ?? 'Submission failed.';
        }
      })
      // pollAuditResult
      .addCase(pollAuditResult.fulfilled, (state, action) => {
        if (action.payload.status === 'MINTED') {
          state.uploadStatus = 'success';
        } else if (action.payload.status === 'FAILED') {
          state.uploadStatus = 'error';
          state.errorMessage =
            action.payload.error ?? 'Satellite verification failed.';
        }
      })
      .addCase(pollAuditResult.rejected, (state, action) => {
        state.uploadStatus = 'error';
        state.errorMessage = action.payload ?? 'Polling failed.';
      });
  },
});

export const {
  startAudit,
  setZones,
  setCurrentZoneIndex,
  addScannedTree,
  setArTier,
  setUploadStatus,
  setSessionComplete,
  setErrorMessage,
  resetAudit,
} = auditSlice.actions;
export default auditSlice.reducer;
