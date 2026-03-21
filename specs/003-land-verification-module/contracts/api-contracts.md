# API Contracts: Land Verification Module

**Feature**: `003-land-verification-module`  
**Generated**: 2026-03-21  
**Sources**: SRS_TerraTrust_v3.1.txt §6.5 (authoritative), BSDD §5.3 (implementation reference)  
**Base URL**: `Config.API_BASE_URL` (from `.env` via `react-native-config`)  
**Prefix**: `/api/v1/`  
**Auth**: Supabase JWT auto-attached by `src/services/api.ts` axios interceptor  
**Timeout**: 60 000 ms (OCR and boundary fetch can be slow on first call)

---

## Contract 1 — `POST /api/v1/land/verify-document`

**Called from**: `DocumentUploadScreen.tsx` → "Confirm and Process" tap  
**Also called from**: `ManualUploadGuideScreen.tsx` → upload button (same pipeline)  
**Purpose**: Submit a 7/12 Extract or Record of Rights photo. Backend runs PaddleOCR
with Devanagari model and returns extracted location identifiers.

### Request

Content-Type: `multipart/form-data`

| Field   | Type        | Required | Constraint           |
| ------- | ----------- | -------- | -------------------- |
| `image` | File (blob) | ✅       | JPG or PNG, max 10 MB |

**RN FormData construction**:
```typescript
const formData = new FormData();
formData.append('image', {
  uri,            // 'file://<path>' for VisionCamera; 'content://<uri>' for DocumentPicker
  type: mimeType, // 'image/jpeg' or result.type from DocumentPicker
  name: 'document.jpg',
} as unknown as Blob);
```

**Client-side validation before sending** (FR-007, Edge Cases spec):
- File size ≤ 10 MB — show error "Image is too large. Please take a clearer, smaller photo."

### Response — HTTP 200

```json
{
  "survey_number": "47",
  "owner_name": "Ramesh Shankar Patil",
  "village": "Kharadi",
  "taluka": "Haveli",
  "district": "Pune",
  "state": "Maharashtra",
  "extraction_confidence": 0.87
}
```

**TypeScript type**: `VerifyDocumentResponse` (see data-model.md §1.6)  
**Redux action**: `dispatch(setCurrentDraft({ ocr_result: response.data }))`

### Response — HTTP 422 (Unprocessable Entity)

```json
{
  "error": "Could not extract required fields. Image quality too low. Please retake photo."
}
```

**Business rule**: The 422 error message is surfaced directly to the farmer
in an error banner on `DocumentUploadScreen`. The `Try Again` button is shown.

### Response — HTTP 401

Redirect to `LoginScreen` (handled by the global axios response interceptor in
`src/services/api.ts`).

### Response — HTTP 500

Show maintenance banner (handled globally by axios interceptor).

### No response (offline)

Show offline banner. Preserve current draft in Redux. Do NOT clear photo preview.

---

## Contract 2 — `GET /api/v1/land/fetch-boundary`

**Called from**: Auto-triggered immediately after farmer taps "This is correct —
Continue" on `DocumentUploadScreen.tsx` (FR-009)  
**Purpose**: Fetch official government boundary polygon for the extracted survey
number via 3-layer state router (WMS → Scraping → Manual fallback).

### Request

Content-Type: `application/json` (query params)

| Query Param     | Type     | Required | Source                                |
| --------------- | -------- | -------- | ------------------------------------- |
| `survey_number` | `string` | ✅       | `currentDraft.ocr_result.survey_number` |
| `district`      | `string` | ✅       | `currentDraft.ocr_result.district`    |
| `taluka`        | `string` | ✅       | `currentDraft.ocr_result.taluka`      |
| `village`       | `string` | ✅       | `currentDraft.ocr_result.village`     |
| `state`         | `string` | ✅       | `currentDraft.ocr_result.state`       |
| `user_lat`      | `number` | ❌       | GPS from `Geolocation.getCurrentPosition()` (5s timeout) |
| `user_lng`      | `number` | ❌       | GPS from `Geolocation.getCurrentPosition()` (5s timeout) |

**GPS best-effort**: If GPS unavailable within 5s, omit `user_lat`/`user_lng`.
The backend handles missing params gracefully (SRS §6.5, research D-005).

**Redux state change on call start**:
```typescript
dispatch(setCurrentDraft({ fetch_status: 'fetching' }));
```

### Response — HTTP 200 (Success Path)

```json
{
  "status": "success",
  "boundary_source": "WMS_AUTO",
  "geojson": {
    "type": "Feature",
    "geometry": {
      "type": "Polygon",
      "coordinates": [[[73.981, 18.545], [73.982, 18.546], [73.981, 18.547], [73.981, 18.545]]]
    },
    "properties": {
      "survey_number": "47",
      "owner_name": "Ramesh Shankar Patil",
      "area_sqm": 4856.2
    }
  },
  "satellite_thumbnail_url": "https://storage.googleapis.com/terratrust-gee/thumbnails/abc123.png"
}
```

**Note**: `satellite_thumbnail_url` is authoritative from SRS §6.5 (BSDD omits it).
See research D-001 for the SRS-wins rationale.

**TypeScript type**: `BoundaryFetchSuccessResponse` (see data-model.md §1.5)

**Redux actions on success**:
```typescript
dispatch(setCurrentDraft({
  boundary: response.data.geojson.geometry,
  boundary_source: response.data.boundary_source,
  satellite_thumbnail_url: response.data.satellite_thumbnail_url,
  fetch_status: 'success',
}));
navigation.navigate('BoundaryConfirmScreen');
```

### Response — HTTP 200 (Manual Fallback)

```json
{
  "status": "manual_required"
}
```

**TypeScript type**: `BoundaryFetchManualResponse`

**Redux actions + navigation**:
```typescript
dispatch(setCurrentDraft({ fetch_status: 'manual_required' }));
navigation.navigate('ManualUploadGuideScreen');
```

### Response — HTTP 401 / 500 / Offline

Same global handling as Contract 1. On any error:
```typescript
dispatch(setCurrentDraft({ fetch_status: 'error' }));
```
Show error toast. Allow farmer to retry by tapping a retry button.

---

## Contract 3 — `POST /api/v1/land/register`

**Called from**: `BoundaryConfirmScreen.tsx` → "Yes, this is my land — Confirm" tap  
**Purpose**: Save the confirmed boundary polygon to the database. Backend fuzzy-matches
`ocr_owner_name` against the farmer's KYC full name (≥ 80% similarity required).

### Request

Content-Type: `application/json`

| Field             | Type           | Required | Source                                       |
| ----------------- | -------------- | -------- | -------------------------------------------- |
| `farm_name`       | `string`       | ✅       | User-entered on `BoundaryConfirmScreen` OR default from survey_number |
| `survey_number`   | `string`       | ✅       | `currentDraft.ocr_result.survey_number`      |
| `district`        | `string`       | ✅       | `currentDraft.ocr_result.district`           |
| `taluka`          | `string`       | ✅       | `currentDraft.ocr_result.taluka`             |
| `village`         | `string`       | ✅       | `currentDraft.ocr_result.village`            |
| `state`           | `string`       | ✅       | `currentDraft.ocr_result.state`              |
| `boundary_source` | `BoundarySource` | ✅     | `currentDraft.boundary_source`               |
| `geojson`         | GeoJSON object | ✅       | `{ type: 'Feature', geometry: currentDraft.boundary, properties: {...} }` |
| `ocr_owner_name`  | `string`       | ✅       | `currentDraft.ocr_result.owner_name`         |

**`farm_name` UX note**: The spec does not include a separate farm name input field on
any screen. Default `farm_name` to the extracted `survey_number` (e.g., `"Survey 47"`)
at registration time. The FDD indicates it is farmer-editable but no screen spec includes
the edit widget. Use the default and leave edit-after-registration as a future feature.

### Response — HTTP 200

```json
{
  "land_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "area_hectares": 0.49,
  "status": "verified"
}
```

**TypeScript type**: `RegisterLandResponse` (see data-model.md §1.7)

**Post-success actions**:
```typescript
// 1. Build the new parcel using register response + currentDraft data
const newParcel: LandParcel = {
  id: response.data.land_id,
  farm_name: farmName,
  survey_number: currentDraft.ocr_result!.survey_number,
  district: currentDraft.ocr_result!.district,
  taluka: currentDraft.ocr_result!.taluka,
  village: currentDraft.ocr_result!.village,
  state: currentDraft.ocr_result!.state,
  area_hectares: response.data.area_hectares,
  boundary_geojson: currentDraft.boundary,
  boundary_source: currentDraft.boundary_source!,
  is_verified: true,
  status: 'verified',
  last_audit_year: null,
  thumbnail_url: currentDraft.satellite_thumbnail_url,  // MMKV-cached via land.parcels
  created_at: new Date().toISOString(),
};

// 2. Add parcel to Redux (persisted to MMKV automatically)
dispatch(addParcel(newParcel));

// 3. Clear current draft (must not persist)
dispatch(clearCurrentDraft());

// 4. Navigate back to LandListScreen
navigation.navigate('LandListScreen');
```

### Response — HTTP 400 (Owner Name Mismatch)

```json
{
  "error": "Owner name on document does not match your registered name."
}
```

**Display**: Inline red error message on `BoundaryConfirmScreen` bottom sheet.
Verbatim user-facing message (from spec FR-009):  
> "The name on this document does not match your registered name. Please use the land document where you are listed as the owner."

**Note**: The API error text and the display text differ slightly. Always use the
**spec FR-009 display string**, not the raw API error string. The API error
distinguishes the error type; the display string is sourced from the spec.

### Response — HTTP 409 (Duplicate Survey Number)

```json
{
  "error": "This survey number is already registered to your account."
}
```

**Display**: Inline error message on `BoundaryConfirmScreen`:
> "This land parcel is already registered in your account."

*(Spec acceptance scenario 6 from User Story 3.)*

### Response — HTTP 401 / 500 / Offline

Same global handling. On network error, preserve `currentDraft` —
do NOT clear the draft so the farmer can retry.

---

## Contract 4 — `GET /api/v1/land/list`

**Called from**: `LandListScreen.tsx` on mount (and on pull-to-refresh)  
**Purpose**: Fetch all land parcels registered by the authenticated farmer.

### Request

No body or query params. Auth header only (JWT via interceptor).

### Response — HTTP 200

```json
[
  {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "farm_name": "Survey 47",
    "survey_number": "47",
    "area_hectares": 0.49,
    "is_verified": true,
    "boundary_source": "WMS_AUTO",
    "last_audit_year": 2025,
    "thumbnail_url": "https://storage.googleapis.com/terratrust-gee/thumbnails/abc123.png"
  }
]
```

**TypeScript type** (partial parcel from API — `boundary_geojson` missing):
```typescript
// Internal API response type (not exported from landSlice)
interface LandListItem {
  id: string;
  farm_name: string;
  survey_number: string;
  area_hectares: number;
  is_verified: boolean;
  boundary_source: BoundarySource;
  last_audit_year: number | null;
  thumbnail_url: string | null;
}
```

**Mapping to `LandParcel`**: API items are missing `district`, `taluka`, `village`,
`state`, `boundary_geojson`, `created_at`. When `setParcels()` is dispatched from
the list response, these fields default to empty strings / `null`. Existing data from
MMKV cache (already-registered parcels) retains full data from the registration flow.

**Redux action**:
```typescript
// Merge API list with existing MMKV-cached data to preserve richer local fields
const merged = data.map(item => {
  const cached = parcels.find(p => p.id === item.id);
  return {
    ...(cached ?? {}),  // keep local-enriched fields if parcel already in MMKV
    ...item,            // trust server for live fields (status, area, last_audit_year)
    boundary_geojson: cached?.boundary_geojson ?? null,
  } as LandParcel;
});
dispatch(setParcels(merged));
```

**Offline fallback** (FR-004): If the call fails, show the MMKV-persisted parcels
from Redux (`land.parcels`) with a "Last synced [time]" indicator in the header.
The `last_synced` timestamp is stored in local component state and formatted as
`"Last synced today at 10:35 AM"` using the JS `Date` API.

### Response — HTTP 401 / 500 / Offline

Show offline banner if no network. Show cached parcels from MMKV. No spinner
after initial data is available.

---

## Error Handling Summary

| HTTP Status | Global (axios interceptor)              | Local (component state)                               |
| ----------- | --------------------------------------- | ----------------------------------------------------- |
| 400         | No — component handles locally         | Show inline error message in the appropriate screen   |
| 401         | Yes — redirect to LoginScreen           | —                                                     |
| 409         | No — component handles locally         | Show inline "already registered" error                |
| 422         | No — component handles locally         | Show "Image quality too low" error on DocumentUpload  |
| 500         | Yes — show maintenance banner          | —                                                     |
| Network err | No — component checks `!error.response` | Show offline banner; preserve draft in Redux         |

---

## Axios Client Configuration

```typescript
// src/services/api.ts (already configured from feature 001)
// Confirm these settings are active:
//   baseURL: Config.API_BASE_URL + '/api/v1'
//   timeout: 60_000
//   Headers: 'Authorization: Bearer <supabase-jwt>' (request interceptor)
//   401 response interceptor → navigation.navigate('LoginScreen')
//   500 response interceptor → show maintenance banner
```

No changes to `api.ts` are required for this module.
