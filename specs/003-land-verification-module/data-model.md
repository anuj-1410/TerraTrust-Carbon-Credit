# Data Model: Land Verification Module

**Feature**: `003-land-verification-module`  
**Generated**: 2026-03-21  
**Sources**: SRS_TerraTrust_v3.1.txt §6, TerraTrust_Backend_System_Design_v3.1.txt §5.3,
TerraTrust_Frontend_Design_Document_v3.1.txt §4, spec.md

---

## 1. Core Entities

### 1.1 `LandParcel`

The primary entity representing a farmer's verified (or pending) land holding.
Stored in Redux `land.parcels[]` and persisted to MMKV.

| Field               | Type                        | Source                                | Notes                                                    |
| ------------------- | --------------------------- | ------------------------------------- | -------------------------------------------------------- |
| `id`                | `string` (UUID)             | `GET /api/v1/land/list`               | Server-generated UUID                                    |
| `farm_name`         | `string`                    | `GET /api/v1/land/list`               | Farmer-provided name (e.g., "North Field")               |
| `survey_number`     | `string`                    | `GET /api/v1/land/list`               | From government 7/12 document                            |
| `district`          | `string`                    | Locally constructed at registration   | Stored from OCRResult at registration time               |
| `taluka`            | `string`                    | Locally constructed at registration   | Stored from OCRResult at registration time               |
| `village`           | `string`                    | Locally constructed at registration   | Stored from OCRResult at registration time               |
| `state`             | `string`                    | Locally constructed at registration   | Stored from OCRResult at registration time               |
| `area_hectares`     | `number`                    | `POST /api/v1/land/register` response | Auto-calculated by PostGIS trigger                       |
| `boundary_geojson`  | `GeoJSONPolygon \| null`    | Locally constructed at registration   | **Nullable** — not returned by list API (D-008)          |
| `boundary_source`   | `BoundarySource`            | `GET /api/v1/land/list` + registration| `'WMS_AUTO' \| 'SCRAPE' \| 'MANUAL'`                    |
| `is_verified`       | `boolean`                   | `GET /api/v1/land/list`               | `true` when status is "verified"                         |
| `status`            | `LandStatus`                | `GET /api/v1/land/list`               | `'verified' \| 'pending' \| 'rejected'`                  |
| `last_audit_year`   | `number \| null`            | `GET /api/v1/land/list`               | Year of last completed audit (null if never audited)     |
| `thumbnail_url`     | `string \| null`            | Populated at registration + list API  | GEE Sentinel-2 PNG URL from `satellite_thumbnail_url`    |
| `created_at`        | `string`                    | Locally set at registration           | ISO timestamp set client-side at registration time       |

**`boundary_source` type**:
```typescript
export type BoundarySource = 'WMS_AUTO' | 'SCRAPE' | 'MANUAL';
```

**`LandStatus` type**:
```typescript
export type LandStatus = 'verified' | 'pending' | 'rejected';
```

**Status badge display mapping** (fixed strings from constitution):

| `status`     | Badge label      |
| ------------ | ---------------- |
| `'verified'` | `"✓ Verified"`   |
| `'pending'`  | `"⏳ Pending"`   |
| `'rejected'` | `"✗ Rejected"`   |

**Change from existing `landSlice.ts`**: `boundary_geojson` was `GeoJSONPolygon`
(non-nullable). MUST be changed to `GeoJSONPolygon | null` to accommodate parcels
retrieved from the list API that do not carry GeoJSON (see research D-008).

---

### 1.2 `LandDraft`

Transient state for a land registration currently in progress.
Stored in Redux `land.currentDraft`. **MUST NOT be persisted to MMKV**
(blacklisted in `store/index.ts` — already configured correctly).

| Field                    | Type                                                             | Notes                                                              |
| ------------------------ | ---------------------------------------------------------------- | ------------------------------------------------------------------ |
| `ocr_result`             | `OCRResult \| null`                                             | Populated after successful `POST /api/v1/land/verify-document`     |
| `boundary`               | `GeoJSONPolygon \| null`                                        | Populated after successful `GET /api/v1/land/fetch-boundary`       |
| `boundary_source`        | `BoundarySource \| null`                                        | Populated from fetch-boundary `boundary_source` field              |
| `satellite_thumbnail_url`| `string \| null`                                                | Populated from fetch-boundary `satellite_thumbnail_url` (SRS D-001)|
| `fetch_status`           | `'idle' \| 'fetching' \| 'success' \| 'manual_required' \| 'error'` | Drives navigation and loading UI                           |

**State transitions for `fetch_status`**:

```
'idle'
  → (farmer taps "This is correct — Continue") → 'fetching'

'fetching'
  → (API returns success) → 'success'
  → (API returns manual_required) → 'manual_required'
  → (API error / offline) → 'error'

'success'
  → (farmer confirms on BoundaryConfirmScreen) → 'idle' (draft cleared)
  → (farmer rejects) → 'idle' (draft cleared)

'manual_required'
  → (farmer uploads manual map, OCR + register succeeds) → 'idle'
```

---

### 1.3 `OCRResult`

The five location identifiers extracted from the government land document by PaddleOCR
on the backend. Stored inside `LandDraft.ocr_result` after a successful
`POST /api/v1/land/verify-document` call.

| Field                   | Type     | Notes                                              |
| ----------------------- | -------- | -------------------------------------------------- |
| `survey_number`         | `string` | e.g., `"47"` — used as key for boundary lookup    |
| `owner_name`            | `string` | e.g., `"Ramesh Shankar Patil"` — cross-checked at register |
| `village`               | `string` | e.g., `"Kharadi"`                                 |
| `taluka`                | `string` | e.g., `"Haveli"`                                  |
| `district`              | `string` | e.g., `"Pune"`                                    |
| `state`                 | `string` | e.g., `"Maharashtra"`                             |
| `extraction_confidence` | `number` | `0.0` to `1.0` — not displayed but stored for debug |

---

### 1.4 `GeoJSONPolygon`

The geometry type for a land boundary polygon. Used in `LandParcel.boundary_geojson`
and `LandDraft.boundary`.

```typescript
export interface GeoJSONPolygon {
  type: 'Polygon';
  coordinates: number[][][]; // [ring][point][lng, lat]
}
```

---

### 1.5 `BoundaryFetchResponse` (API Response Type — Not Stored in Redux)

The complete response type for `GET /api/v1/land/fetch-boundary`.

```typescript
export interface BoundaryFetchSuccessResponse {
  status: 'success';
  boundary_source: BoundarySource;
  geojson: GeoJSONFeature;
  satellite_thumbnail_url: string; // SRS-authoritative field (research D-001)
}

export interface BoundaryFetchManualResponse {
  status: 'manual_required';
}

export type BoundaryFetchResponse =
  | BoundaryFetchSuccessResponse
  | BoundaryFetchManualResponse;

export interface GeoJSONFeature {
  type: 'Feature';
  geometry: GeoJSONPolygon;
  properties: {
    survey_number: string;
    owner_name: string;
    area_sqm: number;
  };
}
```

---

### 1.6 `VerifyDocumentResponse` (API Response Type — Not Stored in Redux)

Response type for `POST /api/v1/land/verify-document`.

```typescript
export interface VerifyDocumentResponse {
  survey_number: string;
  owner_name: string;
  village: string;
  taluka: string;
  district: string;
  state: string;
  extraction_confidence: number;
}
```

---

### 1.7 `RegisterLandResponse` (API Response Type — Not Stored in Redux)

Response type for `POST /api/v1/land/register`.

```typescript
export interface RegisterLandResponse {
  land_id: string;
  area_hectares: number;
  status: 'verified';
}
```

---

## 2. Redux State Shape

### Full `LandState` shape (in `src/features/land/store/landSlice.ts`):

```typescript
export interface LandState {
  parcels: LandParcel[];       // MMKV-persisted
  currentDraft: LandDraft;     // NOT persisted — blacklisted
}
```

### Redux slice actions:

| Action                               | Payload                          | Effect                                           |
| ------------------------------------ | -------------------------------- | ------------------------------------------------ |
| `setParcels(parcels)`                | `LandParcel[]`                   | Replaces entire parcels array (after list fetch) |
| `addParcel(parcel)`                  | `LandParcel`                     | Appends newly registered parcel to list          |
| `setCurrentDraft(partial)`           | `Partial<LandDraft>`             | Merges partial update into currentDraft          |
| `clearCurrentDraft()`                | —                                | Resets currentDraft to initial state             |

*(All four reducers are already present in the scaffolded `landSlice.ts`.)*

---

## 3. MMKV Persistence Map

| Redux key              | Persisted? | MMKV key      | Why                                                      |
| ---------------------- | ---------- | ------------- | -------------------------------------------------------- |
| `land.parcels`         | ✅ YES     | `persist:land`| Offline access; LandListScreen works without network     |
| `land.currentDraft`    | ❌ NO      | blacklisted   | MUST NOT persist — belongs to a single registration session |

---

## 4. Area Unit Conversion

All area calculations use `src/common/utils/units.ts`.

- API returns `area_sqm` (square metres) in GeoJSON properties.
- API returns `area_hectares` (hectares) in `POST /api/v1/land/register` response and `GET /api/v1/land/list`.
- Display uses **acres**: `area_hectares × 2.471`.

```typescript
// units.ts — already present
export const hectaresToAcres = (hectares: number): number =>
  Math.round(hectares * 2.471 * 100) / 100;

export const sqmToHectares = (sqm: number): number => sqm / 10_000;
```

---

## 5. Zod Validation Schemas

Used with React Hook Form for any user-entered data in this module.

```typescript
// ─── DocumentUpload: only used for the farm_name field
import { z } from 'zod';

export const farmNameSchema = z.object({
  farm_name: z
    .string()
    .min(2, 'Farm name must be at least 2 characters')
    .max(100, 'Farm name must be less than 100 characters')
    .trim(),
});

// ─── ManualMeasure circumference input (no-op; this module uses
//     react-native-document-picker, not a text form for measurements)

// ─── No OCR field editing: OCR results are display-only; farmer
//     can only "Try Again" or "Continue" — no text input on review card.
```

---

## 6. Type Change Summary (Modifications to Existing Scaffolded Code)

| File                                       | Change                                                            |
| ------------------------------------------ | ----------------------------------------------------------------- |
| `src/features/land/store/landSlice.ts`    | `boundary_geojson: GeoJSONPolygon | null` (was non-nullable)      |

All other types in `landSlice.ts` are already correct and need no changes.
The `LandDraft.satellite_thumbnail_url` field is **already present** in the
scaffolded `landSlice.ts` — confirmed at line 43.
