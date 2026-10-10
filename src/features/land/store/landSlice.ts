import {
  createAsyncThunk,
  createSlice,
  type PayloadAction,
} from '@reduxjs/toolkit';
import type { AuthState } from '../../auth/store/authSlice';

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
  snapshotRequestId: string | null;
  localRevision: number;
  currentPage: number;
  hasMore: boolean;
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
  snapshotRequestId: null,
  localRevision: 0,
  currentPage: 1,
  hasMore: false,
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

function nullableField(
  item: Record<string, unknown>,
  key: string,
  fallback?: string | null,
): string | null {
  return item[key] === null
    ? null
    : toNullableString(item[key]) ?? fallback ?? null;
}

export function normalizeLandParcelRecord(
  item: Record<string, unknown>,
  existing?: LandParcel | null,
): LandParcel {
  const id = canonicalLandId(item.id ?? item.land_id ?? existing?.id);
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
    area_hectares: Number.isFinite(
      Number(item.area_hectares ?? existing?.area_hectares),
    )
      ? Math.max(0, Number(item.area_hectares ?? existing?.area_hectares))
      : 0,
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
      : typeof item.is_verified === 'boolean'
      ? isVerified
        ? 'verified'
        : 'pending'
      : existing?.status ?? (isVerified ? 'verified' : 'pending'),
    last_audit_year:
      item.last_audit_year === null
        ? null
        : Number.isInteger(Number(item.last_audit_year)) &&
          item.last_audit_year !== undefined
        ? Number(item.last_audit_year)
        : existing?.last_audit_year ?? null,
    last_audit_date:
      typeof item.last_audit_date === 'string' || item.last_audit_date === null
        ? (item.last_audit_date as string | null)
        : existing?.last_audit_date ?? null,
    current_audit_id: nullableField(
      item,
      'current_audit_id',
      existing?.current_audit_id,
    ),
    current_audit_status:
      item.current_audit_status === null
        ? null
        : isCurrentAuditStatus(item.current_audit_status)
        ? item.current_audit_status
        : existing?.current_audit_status ?? null,
    latest_certificate_url: nullableField(
      item,
      'latest_certificate_url',
      existing?.latest_certificate_url,
    ),
    latest_tx_hash: nullableField(
      item,
      'latest_tx_hash',
      existing?.latest_tx_hash,
    ),
    latest_credits_issued:
      item.latest_credits_issued === null
        ? null
        : typeof item.latest_credits_issued === 'number'
        ? item.latest_credits_issued
        : existing?.latest_credits_issued ?? null,
    thumbnail_url: nullableField(
      item,
      'thumbnail_url',
      existing?.thumbnail_url,
    ),
    created_at: String(
      item.created_at ?? item.registered_at ?? existing?.created_at ?? '',
    ),
  };
}

export function normalizeLandParcels(
  records: Array<Record<string, unknown>>,
  existingParcels: LandParcel[],
): LandParcel[] {
  return records.map(item => {
    const parcelId = canonicalLandId(item.id ?? item.land_id);
    const existing =
      existingParcels.find(parcel => parcel.id === parcelId) ?? null;
    return normalizeLandParcelRecord(item, existing);
  });
}

export function mergeLandParcels(
  existingParcels: LandParcel[],
  incomingParcels: LandParcel[],
): LandParcel[] {
  const incomingById = new Map(
    incomingParcels.map(parcel => [parcel.id, parcel]),
  );

  const updatedExisting = existingParcels.map(
    parcel => incomingById.get(parcel.id) ?? parcel,
  );
  const newParcels = incomingParcels.filter(
    parcel => !existingParcels.some(existing => existing.id === parcel.id),
  );

  return dedupeLandParcels([...updatedExisting, ...newParcels]);
}

function canonicalLandId(value: unknown): string {
  const id = value == null ? '' : String(value).trim();
  return /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id) ? id.toLowerCase() : id;
}

export function dedupeLandParcels(parcels: LandParcel[]): LandParcel[] {
  const orderedIds: string[] = [];
  const mergedById = new Map<string, LandParcel>();

  parcels.forEach(parcel => {
    const id = canonicalLandId(parcel?.id);
    if (!id) {
      return;
    }

    if (!mergedById.has(id)) {
      orderedIds.push(id);
      mergedById.set(id, { ...parcel, id });
      return;
    }

    mergedById.set(id, {
      ...mergedById.get(id)!,
      ...parcel,
      id,
    });
  });

  return orderedIds
    .map(parcelId => mergedById.get(parcelId))
    .filter((parcel): parcel is LandParcel => parcel != null);
}

type LandPageData = LandListResponse | Array<Record<string, unknown>>;
const pendingPages = new Map<string, Promise<LandPageData>>();
export const LAND_PAGE_SIZE = 10;

export const fetchLandPage = createAsyncThunk<
  { parcels: LandParcel[]; hasMore: boolean; snapshotRequestId: string | null },
  number | void,
  { state: { auth: AuthState; land: LandState } }
>(
  'land/fetchPage',
  async (requestedPage, { getState }) => {
    const page = requestedPage ?? 1;
    const owner = getState().auth.user;
    const snapshotRequestId = getState().land.snapshotRequestId;
    const localRevision = getState().land.localRevision;
    const key = `${owner?.firebaseUid}:${page}:${localRevision}:${page === 1 ? 'first' : snapshotRequestId}`;
    let pending = pendingPages.get(key);
    if (!pending) {
      const api = require('../../../services/api')
        .default as typeof import('../../../services/api').default;
      pending = api
        .get<LandPageData>('/api/v1/land/list', {
          params: { page, limit: LAND_PAGE_SIZE },
        })
        .then(response => response.data);
      pendingPages.set(key, pending);
    }
    let data: LandPageData;
    try {
      data = await pending;
    } finally {
      if (pendingPages.get(key) === pending) {
        pendingPages.delete(key);
      }
    }
    if (
      !getState().auth.sessionReady ||
      getState().auth.user?.firebaseUid !== owner?.firebaseUid
    ) {
      throw new Error('LAND_SESSION_CHANGED');
    }
    if (getState().land.localRevision !== localRevision) {
      throw new Error('LAND_SNAPSHOT_CHANGED');
    }
    if (page > 1 && getState().land.snapshotRequestId !== snapshotRequestId) {
      throw new Error('LAND_SNAPSHOT_CHANGED');
    }
    return {
      parcels: dedupeLandParcels(
        normalizeLandParcels(
          Array.isArray(data) ? data : data.items ?? [],
          getState().land.parcels,
        ),
      ),
      hasMore: !Array.isArray(data) && Boolean(data.has_more),
      snapshotRequestId,
    };
  },
  {
    condition: (page, { getState }) =>
      Boolean(
        getState().auth.sessionReady &&
          getState().auth.user &&
          ((page ?? 1) === 1 ||
            (page ?? 1) === (getState().land.currentPage ?? 1) + 1),
      ),
  },
);

const landSlice = createSlice({
  name: 'land',
  initialState: landInitialState,
  reducers: {
    setParcels(state, action: PayloadAction<LandParcel[]>) {
      state.parcels = dedupeLandParcels(action.payload);
    },
    addParcel(state, action: PayloadAction<LandParcel>) {
      state.localRevision++;
      const id = canonicalLandId(action.payload.id);
      state.parcels = dedupeLandParcels([
        action.payload,
        ...state.parcels.filter(parcel => canonicalLandId(parcel.id) !== id),
      ]);
    },
    updateParcel(
      state,
      action: PayloadAction<{
        id: string;
        changes: Partial<LandParcel>;
        fallback?: LandParcel;
      }>,
    ) {
      state.localRevision++;
      if (
        !state.parcels.some(
          parcel => parcel.id === canonicalLandId(action.payload.id),
        ) &&
        action.payload.fallback
      ) {
        state.parcels.push({
          ...action.payload.fallback,
          id: canonicalLandId(action.payload.id),
        });
      }
      state.parcels = state.parcels.map(parcel =>
        parcel.id === canonicalLandId(action.payload.id)
          ? { ...parcel, ...action.payload.changes }
          : parcel,
      );
    },
    setCurrentDraft(state, action: PayloadAction<Partial<LandDraft>>) {
      state.currentDraft = { ...state.currentDraft, ...action.payload };
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
  extraReducers: builder => {
    builder.addCase(fetchLandPage.pending, (state, action) => {
      if ((action.meta.arg ?? 1) === 1) {
        state.snapshotRequestId = action.meta.requestId;
        state.hasMore = false;
      }
    });
    builder.addCase(fetchLandPage.fulfilled, (state, action) => {
      const firstPage = (action.meta.arg ?? 1) === 1;
      if (
        firstPage
          ? state.snapshotRequestId !== action.meta.requestId
          : state.snapshotRequestId !== action.payload.snapshotRequestId
      ) {
        return;
      }
      state.parcels = firstPage
        ? action.payload.parcels
        : mergeLandParcels(state.parcels, action.payload.parcels);
      state.lastSyncedAt = new Date().toISOString();
      state.currentPage = action.meta.arg ?? 1;
      state.hasMore = action.payload.hasMore;
    });
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
