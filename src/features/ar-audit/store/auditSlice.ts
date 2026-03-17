import {createSlice, type PayloadAction} from '@reduxjs/toolkit';

export type ARTier = 1 | 2 | 3;
export type UploadStatus =
  | 'idle'
  | 'uploading'
  | 'processing'
  | 'success'
  | 'error';

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

export interface AuditState {
  activeAuditId: string | null;
  activeLandId: string | null;
  zones: SamplingZone[];
  currentZoneIndex: number;
  scannedTrees: TreeSample[];
  arTier: ARTier;
  sessionComplete: boolean;
  uploadStatus: UploadStatus;
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
};

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
    resetAudit(state) {
      Object.assign(state, auditInitialState);
    },
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
  resetAudit,
} = auditSlice.actions;
export default auditSlice.reducer;
