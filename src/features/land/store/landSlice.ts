import {createSlice, type PayloadAction} from '@reduxjs/toolkit';

export type BoundarySource = 'WMS_AUTO' | 'SCRAPE' | 'MANUAL';
export type LandStatus = 'verified' | 'pending' | 'rejected';
export const CURRENT_AUDIT_STATUSES = [
  'PROCESSING',
  'CALCULATING',
  'READY_TO_MINT',
  'MINTED',
  'COMPLETE_NO_CREDITS',
  'FAILED',
] as const;
export type CurrentAuditStatus = (typeof CURRENT_AUDIT_STATUSES)[number];

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
  current_audit_id?: string | null;
  current_audit_status?: CurrentAuditStatus | null;
  latest_certificate_url?: string | null;
  latest_tx_hash?: string | null;
  latest_credits_issued?: number | null;
  thumbnail_url: string | null;
  created_at: string;
}

export interface LandListResponse {
  items: Array<Record<string, unknown>>;
  page: number;
  limit: number;
  total: number;
  has_more: boolean;
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

function isCurrentAuditStatus(value: unknown): value is CurrentAuditStatus {
  return CURRENT_AUDIT_STATUSES.includes(value as CurrentAuditStatus);
}

function isLandStatus(value: unknown): value is LandStatus {
  return value === 'verified' || value === 'pending' || value === 'rejected';
}

function toNullableString(value: unknown): string | null {
  if (typeof value === 'string') {
    return value;
  }

  return value == null ? null : String(value);
}

export function normalizeLandParcelRecord(
  item: Record<string, unknown>,
  existing?: LandParcel | null,
): LandParcel {
  const id = String(item.id ?? existing?.id ?? '');
  const isVerified =
    typeof item.is_verified === 'boolean'
      ? item.is_verified
      : existing?.is_verified ?? false;

  return {
    id,
    farm_name: String(item.farm_name ?? existing?.farm_name ?? ''),
    survey_number: String(item.survey_number ?? existing?.survey_number ?? ''),
    district: String(item.district ?? existing?.district ?? ''),
    taluka: String(item.taluka ?? existing?.taluka ?? ''),
    village: String(item.village ?? existing?.village ?? ''),
    state: String(item.state ?? existing?.state ?? ''),
    area_hectares: Number(item.area_hectares ?? existing?.area_hectares ?? 0),
    boundary_geojson:
      (item.boundary_geojson as GeoJSONPolygon | null | undefined) ??
      existing?.boundary_geojson ??
      null,
    boundary_source:
      (item.boundary_source as BoundarySource | undefined) ??
      existing?.boundary_source ??
      'MANUAL',
    is_verified: isVerified,
    status: isLandStatus(item.status)
      ? item.status
      : existing?.status ??
        (isVerified ? 'verified' : 'pending'),
    last_audit_year:
      typeof item.last_audit_year === 'number'
        ? item.last_audit_year
        : existing?.last_audit_year ?? null,
    last_audit_date:
      typeof item.last_audit_date === 'string' || item.last_audit_date === null
        ? (item.last_audit_date as string | null)
        : existing?.last_audit_date ?? null,
    current_audit_id:
      toNullableString(item.current_audit_id) ?? existing?.current_audit_id ?? null,
    current_audit_status: isCurrentAuditStatus(item.current_audit_status)
      ? item.current_audit_status
      : existing?.current_audit_status ?? null,
    latest_certificate_url:
      toNullableString(item.latest_certificate_url) ??
      existing?.latest_certificate_url ??
      null,
    latest_tx_hash:
      toNullableString(item.latest_tx_hash) ?? existing?.latest_tx_hash ?? null,
    latest_credits_issued:
      typeof item.latest_credits_issued === 'number'
        ? item.latest_credits_issued
        : existing?.latest_credits_issued ?? null,
    thumbnail_url:
      toNullableString(item.thumbnail_url) ?? existing?.thumbnail_url ?? null,
    created_at: String(item.created_at ?? existing?.created_at ?? ''),
  };
}

export function normalizeLandParcels(
  records: Array<Record<string, unknown>>,
  existingParcels: LandParcel[],
): LandParcel[] {
  return records.map(item => {
    const parcelId = String(item.id ?? '');
    const existing = existingParcels.find(parcel => parcel.id === parcelId) ?? null;
    return normalizeLandParcelRecord(item, existing);
  });
}

export function mergeLandParcels(
  existingParcels: LandParcel[],
  incomingParcels: LandParcel[],
): LandParcel[] {
  const incomingById = new Map(incomingParcels.map(parcel => [parcel.id, parcel]));

  const updatedExisting = existingParcels.map(
    parcel => incomingById.get(parcel.id) ?? parcel,
  );
  const newParcels = incomingParcels.filter(
    parcel => !existingParcels.some(existing => existing.id === parcel.id),
  );

  return [...updatedExisting, ...newParcels];
}

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
    updateParcel(
      state,
      action: PayloadAction<{id: string; changes: Partial<LandParcel>}>,
    ) {
      state.parcels = state.parcels.map(parcel =>
        parcel.id === action.payload.id
          ? {...parcel, ...action.payload.changes}
          : parcel,
      );
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
    clearCachedSatelliteImages(state) {
      state.parcels = state.parcels.map(parcel => ({
        ...parcel,
        thumbnail_url: null,
      }));
    },
  },
});

export const {
  setParcels,
  addParcel,
  updateParcel,
  setCurrentDraft,
  clearCurrentDraft,
  setLastSynced,
  clearCachedSatelliteImages,
} = landSlice.actions;
export default landSlice.reducer;
