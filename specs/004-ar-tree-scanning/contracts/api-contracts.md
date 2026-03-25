# API Contracts: AR Tree Scanning Module (004)

**Generated**: 2026-03-26
**Source authority**: BSDD §5.4, SRS §14.x, FDD §8.x
**Base URL**: `Config.API_BASE_URL` (from `.env` via `react-native-config`)
**All endpoints prefixed**: `/api/v1/`
**Auth**: Supabase JWT attached automatically by Axios interceptor in `src/services/api.ts`

---

## Contract 1: GET /api/v1/audit/zones

**Purpose**: Generate satellite-guided sampling zones for a land parcel. First step of
an annual audit. Called on "Start Audit" tap from AuditStartScreen.

### Request

```
GET /api/v1/audit/zones?land_id={uuid}
Authorization: Bearer {supabase_jwt}
```

### Query Parameters

| Param     | Type   | Required | Description                         |
|-----------|--------|----------|-------------------------------------|
| `land_id` | string | Yes      | UUID of the selected land parcel    |

### Successful Response (200)

```typescript
interface AuditZonesResponse {
  audit_id: string;              // UUID — stored in audit.activeAuditId
  zones: Array<{
    zone_id: string;             // UUID
    label: string;               // "A"–"H" — display only
    centre_gps: {
      lat: number;               // e.g. 18.546
      lng: number;               // e.g. 73.981
    };
    radius_metres: 7 | 9 | 11;  // Determined by land area on backend
    zone_type: 'high_density' | 'medium_density' | 'low_density';
    sequence_order: number;      // 1-based walking order
    gedi_available: boolean;     // false → show "Measure Height" button
  }>;
  walking_path_metres: number;   // Shown on AuditStartScreen (estimated walk)
  min_trees_required: number;    // Typically 9; stored in Redux
}
```

### Error Responses

```typescript
// 401 — JWT expired or invalid
{ "error": "Unauthorized" }

// 404 — land_id not found for this user
{ "error": "Land parcel not found." }

// 500 — GEE computation failure
{ "error": "Satellite analysis failed. Please try again." }
```

### Redux actions on success

```typescript
dispatch(startAudit({ auditId: data.audit_id, landId: land_id }));
dispatch(setZones(data.zones));        // zones enriched with trees_scanned: 0, is_complete: false
// Navigate to ZoneNavigationScreen
```

### Frontend mock (for dev/testing)

```typescript
// Mock response shape — use when backend is not available
const MOCK_ZONES_RESPONSE: AuditZonesResponse = {
  audit_id: 'mock-audit-uuid-001',
  zones: [
    {
      zone_id: 'zone-uuid-001',
      label: 'A',
      centre_gps: { lat: 18.546, lng: 73.981 },
      radius_metres: 9,
      zone_type: 'high_density',
      sequence_order: 1,
      gedi_available: true,
    },
    {
      zone_id: 'zone-uuid-002',
      label: 'B',
      centre_gps: { lat: 18.548, lng: 73.983 },
      radius_metres: 9,
      zone_type: 'medium_density',
      sequence_order: 2,
      gedi_available: false,
    },
    {
      zone_id: 'zone-uuid-003',
      label: 'C',
      centre_gps: { lat: 18.550, lng: 73.985 },
      radius_metres: 7,
      zone_type: 'low_density',
      sequence_order: 3,
      gedi_available: true,
    },
  ],
  walking_path_metres: 145,
  min_trees_required: 9,
};
```

---

## Contract 2: POST /api/v1/audit/submit-samples

**Purpose**: Submit all scanned tree data for satellite fusion computation. Called from
AuditCompleteScreen when farmer taps "Submit for Satellite Verification".

### Request

```
POST /api/v1/audit/submit-samples
Authorization: Bearer {supabase_jwt}
Content-Type: application/json
```

### Request Body

```typescript
interface SubmitSamplesRequest {
  land_id: string;         // audit.activeLandId from Redux
  audit_id: string;        // audit.activeAuditId from Redux
  trees: Array<{
    zone_id: string;
    species: string;               // Must be in approved 11-species list
    dbh_cm: number;                // Diameter in cm
    height_m: number | null;       // null = backend uses GEDI satellite data
    gps: {
      lat: number;
      lng: number;
    };
    ar_tier_used: 1 | 2 | 3;      // INTEGER — never A/B/C
    confidence_score: number | null; // RANSAC confidence; null for Tier 3
    evidence_photo_base64: string; // Full base64 of auto-captured JPEG
    evidence_photo_hash: string;   // SHA-256 hex (64 chars) of evidence_photo_base64
  }>;
}
```

**CRITICAL**: `evidence_photo_hash` MUST be computed on-device via
`react-native-quick-crypto` BEFORE calling this endpoint. Both fields must be sent.
`ar_tier_used` MUST be integer 1, 2, or 3.

### Successful Response (202)

```typescript
interface SubmitSamplesResponse {
  status: 'processing';
  audit_id: string;
  estimated_seconds: number;    // e.g. 60 — used for spinner copy
  message: string;              // "Satellite verification in progress"
}
```

### Error Responses

```typescript
// 400 — minimum trees not met
{ "error": "Minimum 9 trees required across all zones." }

// 401 — JWT expired
{ "error": "Unauthorized" }

// 422 — invalid tree data (species not approved, dbh out of range, etc.)
{ "error": "Invalid tree data: [detail]" }
```

### Offline handling

When no network is available and this call fails, save the full request body
(the same `SubmitSamplesRequest` object) to MMKV under key `'pending_upload'`.
`react-native-background-fetch` retries on connectivity restore.

---

## Contract 3: GET /api/v1/audit/result/{audit_id}

**Purpose**: Poll for audit status after submission. Called every 5 seconds until
status is not `"CALCULATING"`.

### Request

```
GET /api/v1/audit/result/{audit_id}
Authorization: Bearer {supabase_jwt}
```

### Response — Still Processing

```typescript
{ status: 'CALCULATING' }
```

### Response — Success (Minted)

```typescript
interface AuditResultMinted {
  status: 'MINTED';
  total_biomass_tonnes: number;    // e.g. 14.8
  credits_issued: number;          // e.g. 2.4 (CTT tokens minted)
  tx_hash: string;                 // Polygon blockchain transaction hash
  ipfs_certificate_url: string;    // IPFS certificate URL
  audit_year: number;              // e.g. 2026
}
```

### Response — Failed

```typescript
interface AuditResultFailed {
  status: 'FAILED';
  error: string;    // e.g. "Insufficient satellite data for this region."
}
```

### Polling pattern

```typescript
// Poll every 5 seconds; stop when status != 'CALCULATING'
const pollResult = async (auditId: string): Promise<AuditResultResponse> => {
  while (true) {
    const res = await api.get<AuditResultResponse>(
      `/audit/result/${auditId}`
    );
    if (res.data.status !== 'CALCULATING') {
      return res.data;
    }
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
};
```

---

## Contract 4: Native Bridge — ARModule.kt → ar-bridge.ts

**Source**: SRS §14.4–14.6

### checkDepthSupport

```typescript
// ar-bridge.ts
export const detectARTier = async (): Promise<1 | 2 | 3> => {
  const support: string = await NativeModules.ARModule.checkDepthSupport();
  if (support === 'FULL_DEPTH') return 1;
  if (support === 'SLAM_ONLY')  return 2;
  return 3;  // 'UNSUPPORTED' or any exception
};
```

Kotlin resolution values:
- `"FULL_DEPTH"` → Tier 1 (hardware ToF depth sensor available)
- `"SLAM_ONLY"` → Tier 2 (ARCore SLAM available, no ToF)
- `"UNSUPPORTED"` → Tier 3 (no ARCore support; also returned on any exception)

### measureCylinder

```typescript
// ar-bridge.ts
export interface ARMeasurementResult {
  diameter_cm: number;
  confidence: number;      // RANSAC inlier ratio (0.0–1.0)
  tier_used: 1 | 2;        // 1 = RAW_DEPTH_ONLY, 2 = SLAM
  point_count: number;
}

export const measureTreeDiameter =
    async (): Promise<ARMeasurementResult> => {
  const raw: string = await NativeModules.ARModule.measureCylinder();
  return JSON.parse(raw) as ARMeasurementResult;
};
```

Kotlin returns JSON string. `confidence < 0.7` or `fit_error > 5%` → Kotlin
rejects the promise with an error message (NOT resolves with bad data).
`point_count < 50` → error.

### runSpeciesInference (new — research D-002)

```typescript
// ar-bridge.ts
export interface SpeciesInferenceResult {
  species: string;
  confidence: number;
  all_scores: number[];    // 11 values, one per approved species
}

export const identifySpecies =
    async (imageBase64: string): Promise<SpeciesInferenceResult> => {
  const raw: string = await NativeModules.ARModule.runSpeciesInference(
    imageBase64
  );
  return JSON.parse(raw) as SpeciesInferenceResult;
};
```

### checkMockLocation

```typescript
// ar-bridge.ts
export const isMockLocationEnabled = async (): Promise<boolean> => {
  return NativeModules.ARModule.checkMockLocation();
};
```

Returns `true` → block audit start. Block is full-screen (not a warning).
Message: `"Please disable Mock Location in Developer Settings to use this app."`
