import {createSlice, type PayloadAction} from '@reduxjs/toolkit';

export type BoundarySource = 'WMS_AUTO' | 'SCRAPE' | 'MANUAL';
export type LandStatus = 'verified' | 'pending' | 'rejected';

export interface GeoJSONPolygon {
  type: 'Polygon';
  coordinates: number[][][];
}

export interface LandParcel {
  id: string;
  farm_name: string;
  survey_number: string;
  district: string;
  taluka: string;
  village: string;
  state: string;
  area_hectares: number;
  boundary_geojson: GeoJSONPolygon | null;
  boundary_source: BoundarySource;
  is_verified: boolean;
  status: LandStatus;
  last_audit_year: number | null;
  last_audit_date?: string | null;
  thumbnail_url: string | null;
  created_at: string;
}

export interface OCRResult {
  survey_number: string;
  owner_name: string;
  village: string;
  taluka: string;
  district: string;
  state: string;
  extraction_confidence: number;
}

export interface LandDraft {
  ocrResult: OCRResult | null;
  boundary: GeoJSONPolygon | null;
  boundarySource: BoundarySource | null;
  satelliteThumbnailUrl: string | null;
  fetchStatus: 'idle' | 'fetching' | 'success' | 'manual_required' | 'error';
}

export interface LandState {
  parcels: LandParcel[];
  currentDraft: LandDraft;
  lastSyncedAt: string | null;
}

export const landInitialState: LandState = {
  parcels: [],
  currentDraft: {
    ocrResult: null,
    boundary: null,
    boundarySource: null,
    satelliteThumbnailUrl: null,
    fetchStatus: 'idle',
  },
  lastSyncedAt: null,
};

const landSlice = createSlice({
  name: 'land',
  initialState: landInitialState,
  reducers: {
    setParcels(state, action: PayloadAction<LandParcel[]>) {
      state.parcels = action.payload;
    },
    addParcel(state, action: PayloadAction<LandParcel>) {
      state.parcels.push(action.payload);
    },
    setCurrentDraft(state, action: PayloadAction<Partial<LandDraft>>) {
      state.currentDraft = {...state.currentDraft, ...action.payload};
    },
    clearCurrentDraft(state) {
      state.currentDraft = landInitialState.currentDraft;
    },
    setLastSynced(state, action: PayloadAction<string>) {
      state.lastSyncedAt = action.payload;
    },
  },
});

export const {setParcels, addParcel, setCurrentDraft, clearCurrentDraft, setLastSynced} =
  landSlice.actions;
export default landSlice.reducer;
