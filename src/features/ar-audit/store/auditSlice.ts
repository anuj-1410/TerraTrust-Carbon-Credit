import {createSlice, createAsyncThunk, type PayloadAction} from '@reduxjs/toolkit';
import api from '../../../services/api';
import {detectARTier as detectARTierBridge} from '../../../services/ar-bridge';
import {deleteFile, readFileAsBase64} from '../../../common/utils/hash';
import type {RootState} from '../../../store/index';
import type {MainAppOriginTab} from '../../../types/navigation';
import {mmkv} from '../../../store/mmkvStorage';

export type ARTier = 1 | 2 | 3;
export type SpeciesSource =
  | 'MODEL_AUTO'
  | 'MODEL_CONFIRMED'
  | 'MANUAL_SELECTED';
export type HeightCaptureMethod = 'GEDI' | 'AR' | 'MANUAL';
export type UploadStatus =
  | 'idle'
  | 'uploading'
  | 'processing'
  | 'success'
  | 'error'
  | 'offline';

export interface AuditResultResponse {
  status:
    | 'PROCESSING'
    | 'CALCULATING'
    | 'READY_TO_MINT'
    | 'MINTED'
    | 'COMPLETE_NO_CREDITS'
    | 'FAILED';
  credits_issued?: number;
  audit_year?: number;
  total_biomass_tonnes?: number;
  tx_hash?: string;
  ipfs_certificate_url?: string;
  reason?: string;
  error?: string;
}

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
  species_source: SpeciesSource;
  dbh_cm: number;
  wood_density: number;
  ar_height_m: number | null;
  height_capture_method: HeightCaptureMethod;
  measurement_tier: ARTier;
  confidence_score: number | null;
  gps_lat: number;
  gps_lng: number;
  gps_accuracy_m: number;
  evidence_photo_uri: string | null;
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

export interface FetchZonesError {
  message: string;
  existingAuditId?: string;
}

export interface AuditState {
  activeAuditId: string | null;
  activeLandId: string | null;
  originTab: MainAppOriginTab | null;
  zones: SamplingZone[];
  currentZoneIndex: number;
  scannedTrees: TreeSample[];
  arTier: ARTier;
  arTierResolved: boolean;
  sessionComplete: boolean;
  uploadStatus: UploadStatus;
  walkingPathMetres: number;
  minTreesRequired: number;
  errorMessage: string | null;
  auditResult: AuditResultResponse | null;
  lastPolledAt: string | null;
}

type TreeSampleWithLegacyEvidence = TreeSample & {
  evidence_photo_base64?: string | null;
};

export const auditInitialState: AuditState = {
  activeAuditId: null,
  activeLandId: null,
  originTab: null,
  zones: [],
  currentZoneIndex: 0,
  scannedTrees: [],
  arTier: 3,
  arTierResolved: false,
  sessionComplete: false,
  uploadStatus: 'idle',
  walkingPathMetres: 0,
  minTreesRequired: 9,
  errorMessage: null,
  auditResult: null,
  lastPolledAt: null,
};

// --- Async Thunks ---

export const fetchZones = createAsyncThunk<
  AuditZonesResponse,
  string,
  {rejectValue: FetchZonesError}
>('audit/fetchZones', async (landId, {rejectWithValue}) => {
  try {
    const response = await api.get<AuditZonesResponse>(
      `/api/v1/audit/zones?land_id=${encodeURIComponent(landId)}`,
    );
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 401) {
      return rejectWithValue({
        message: 'Your session has expired. Please log in again.',
      });
    }
    if (error.response?.status === 404) {
      return rejectWithValue({message: 'Land parcel not found.'});
    }
    if (error.response?.status === 409) {
      return rejectWithValue({
        message:
          error.response.data?.error ??
          'An audit for this land is already in progress.',
        existingAuditId:
          error.response.data?.audit_id ??
          error.response.data?.existing_audit_id ??
          undefined,
      });
    }
    if (error.response?.data?.error) {
      return rejectWithValue({message: error.response.data.error});
    }
    return rejectWithValue({
      message:
        'Unable to generate sampling zones. Please check your connection and try again.',
    });
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
  const {activeAuditId, activeLandId, scannedTrees} = getState().audit;

  if (!activeAuditId || !activeLandId) {
    return rejectWithValue('No active audit session.');
  }

  const trees = await Promise.all(scannedTrees.map(async tree => {
      const treeWithLegacyEvidence = tree as TreeSampleWithLegacyEvidence;
      let evidencePhotoBase64 = treeWithLegacyEvidence.evidence_photo_base64 ?? '';

      if (!evidencePhotoBase64 && tree.evidence_photo_uri) {
        try {
          evidencePhotoBase64 = await readFileAsBase64(tree.evidence_photo_uri);
        } catch {
          evidencePhotoBase64 = '';
        }
      }

      return {
      zone_id: tree.zone_id,
      species: tree.species,
      species_confidence: tree.species_confidence,
      species_source: tree.species_source,
      dbh_cm: tree.dbh_cm,
      height_m: tree.ar_height_m,
      gps: {lat: tree.gps_lat, lng: tree.gps_lng},
      gps_accuracy_m: tree.gps_accuracy_m,
      ar_tier_used: tree.measurement_tier,
      confidence_score: tree.confidence_score,
      evidence_photo_base64: evidencePhotoBase64,
      evidence_photo_hash: tree.evidence_photo_hash,
      scan_timestamp: tree.scan_timestamp,
    };
  }));

  const payload = {
    land_id: activeLandId,
    audit_id: activeAuditId,
    trees,
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

export const cleanupAuditSession = createAsyncThunk<
  void,
  void,
  {state: RootState}
>('audit/cleanupAuditSession', async (_, {getState, dispatch}) => {
  const evidenceUris = Array.from(
    new Set(
      getState()
        .audit.scannedTrees.map(tree => tree.evidence_photo_uri)
        .filter((uri): uri is string => typeof uri === 'string' && uri.length > 0),
    ),
  );

  await Promise.all(
    evidenceUris.map(uri => deleteFile(uri).catch(() => false)),
  );

  mmkv.delete('pending_upload');
  dispatch(resetAudit());
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
      state.currentZoneIndex = 0;
      state.scannedTrees = [];
      state.auditResult = null;
      state.lastPolledAt = null;
    },
    setZones(state, action: PayloadAction<SamplingZone[]>) {
      state.zones = action.payload;
    },
    setOriginTab(state, action: PayloadAction<MainAppOriginTab | null>) {
      state.originTab = action.payload;
    },
    setCurrentZoneIndex(state, action: PayloadAction<number>) {
      state.currentZoneIndex = action.payload;
    },
    addScannedTree(state, action: PayloadAction<TreeSample>) {
      state.scannedTrees.push(action.payload);

      const treesPerZone = Math.max(
        3,
        Math.floor(state.minTreesRequired / Math.max(state.zones.length, 1)),
      );
      const zone = state.zones.find(item => item.zone_id === action.payload.zone_id);

      if (zone) {
        zone.trees_scanned += 1;
        zone.is_complete = zone.trees_scanned >= treesPerZone;
      }

      state.sessionComplete = state.zones.every(zoneItem => zoneItem.is_complete);
    },
    setArTier(state, action: PayloadAction<ARTier>) {
      state.arTier = action.payload;
      state.arTierResolved = true;
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
    setAuditResult(state, action: PayloadAction<AuditResultResponse | null>) {
      state.auditResult = action.payload;
    },
    setLastPolledAt(state, action: PayloadAction<string | null>) {
      state.lastPolledAt = action.payload;
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
        state.currentZoneIndex = 0;
        state.scannedTrees = [];
        state.zones = zones.map(z => ({
          ...z,
          trees_scanned: 0,
          is_complete: false,
        }));
        state.walkingPathMetres = walking_path_metres;
        state.minTreesRequired = min_trees_required;
        state.sessionComplete = false;
        state.uploadStatus = 'idle';
        state.errorMessage = null;
        state.auditResult = null;
        state.lastPolledAt = null;
      })
      .addCase(fetchZones.rejected, (state, action) => {
        state.errorMessage = action.payload?.message ?? 'Failed to load zones.';

        if (action.payload?.existingAuditId) {
          state.activeAuditId = action.payload.existingAuditId;
          state.activeLandId = action.meta.arg;
        }
      })
      // detectAndSetARTier
      .addCase(detectAndSetARTier.pending, state => {
        state.arTierResolved = false;
      })
      .addCase(detectAndSetARTier.fulfilled, (state, action) => {
        state.arTier = action.payload;
        state.arTierResolved = true;
      })
      .addCase(detectAndSetARTier.rejected, state => {
        state.arTier = 3;
        state.arTierResolved = true;
      })
      // submitAudit
      .addCase(submitAudit.pending, state => {
        state.uploadStatus = 'uploading';
        state.errorMessage = null;
      })
      .addCase(submitAudit.fulfilled, state => {
        state.uploadStatus = 'processing';
        state.errorMessage = null;
        state.auditResult = {status: 'PROCESSING'};
      })
      .addCase(submitAudit.rejected, (state, action) => {
        if (action.payload === '__OFFLINE__') {
          state.uploadStatus = 'offline';
          state.errorMessage = 'Saved for upload when you\'re back online.';
        } else {
          state.uploadStatus = 'error';
          state.errorMessage = action.payload ?? 'Submission failed.';
        }
      });
  },
});

export const {
  startAudit,
  setZones,
  setOriginTab,
  setCurrentZoneIndex,
  addScannedTree,
  setArTier,
  setUploadStatus,
  setSessionComplete,
  setErrorMessage,
  setAuditResult,
  setLastPolledAt,
  resetAudit,
} = auditSlice.actions;
export default auditSlice.reducer;
