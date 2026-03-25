# Data Model: AR Tree Scanning Module (004)

**Generated**: 2026-03-26
**Source**: spec.md, SRS §14.x, BSDD §5.4, FDD §7.1, research.md

---

## Entity 1: SamplingZone

**Source**: `GET /api/v1/audit/zones` response. Stored in `audit.zones[]` in Redux
(not independently persisted — zones are re-fetched if `activeAuditId` is null).

```typescript
interface SamplingZone {
  zone_id: string;                // UUID from backend
  label: string;                  // "A"–"H" (display label only)
  centre_gps: {
    lat: number;
    lng: number;
  };
  radius_metres: 7 | 9 | 11;     // Determined by land area
  zone_type: 'high_density' | 'medium_density' | 'low_density';
  sequence_order: number;         // 1-based walking order
  gedi_available: boolean;        // Controls "Measure Height" button visibility
  // Client-side only (not from API):
  trees_scanned: number;          // Count of saved trees in this zone
  is_complete: boolean;           // true when ≥ min trees saved
}
```

**Validation rules**:
- `radius_metres` must be one of 7, 9, 11 (land area ≤ 0.4ha → 7, ≤ 1.2ha → 9, > 1.2ha → 11)
- `gedi_available: false` → "Measure Height" button renders; `true` → hidden
- Zone arrival: `distanceToZoneCentre ≤ 10m` (GPS checks every 3 seconds; 30s grace period with last-good position ≤ 15m accuracy)

---

## Entity 2: TreeSample

**Source**: Built on-device during AR scan. Saved to `audit.scannedTrees[]` in Redux
and MMKV after every single save. Sent as array of trees in the audit submit payload.

```typescript
interface TreeSample {
  tree_id: string;              // UUID v4, generated locally at save time
  zone_id: string;              // UUID of the zone this tree was scanned in
  species: string;              // Must be in APPROVED_SPECIES (11 species)
  species_confidence: number;   // 0.0–1.0. ≥ 0.60 = auto-accept
  dbh_cm: number;               // Diameter at breast height in cm (5–200 range)
  wood_density: number;         // Auto-looked-up from species.ts (never manually entered)
  ar_height_m: number | null;   // AR-measured height or null (GEDI satellite used)
  measurement_tier: 1 | 2 | 3; // Integer AR tier — never A/B/C
  confidence_score: number | null; // RANSAC confidence (Tier 1/2); null for Tier 3
  gps_lat: number;
  gps_lng: number;
  gps_accuracy_m: number;       // From geolocation-service coords.accuracy
  evidence_photo_base64: string; // Auto-captured at diameter lock moment
  evidence_photo_hash: string;  // SHA-256 hex computed by react-native-quick-crypto
  scan_timestamp: string;       // ISO 8601, captured at save time
}
```

**Validation rules**:
- `species` must be exactly one of the 11 approved species in `common/constants/species.ts`
- `dbh_cm` must be in range 5–200 cm; outside → "unusual value" warning, re-measure
- `species_confidence < 0.60` → show manual species dropdown
- `confidence_score < 0.7` → Tier 1/2 retry prompt; do not save
- fit error > 5% → retry prompt
- `evidence_photo_hash` = SHA-256 of `evidence_photo_base64` (hex string, 64 chars)
- `measurement_tier` typed `1 | 2 | 3` — matches `arTier` at scan time
- `tree_id` must be generated with `uuid()` (uuid v4) locally

---

## Entity 3: AuditSession (Redux `audit` slice)

**Source**: FDD §7.1. Already scaffolded in `src/features/ar-audit/store/auditSlice.ts`.

```typescript
interface AuditState {
  activeAuditId: string | null;    // Backend UUID; persisted to MMKV
  activeLandId: string | null;     // UUID of land parcel being audited.
  zones: SamplingZone[];           // Zones from GET /api/v1/audit/zones
  currentZoneIndex: number;        // 0-based index into zones[]; persisted
  scannedTrees: TreeSample[];      // CRITICAL — persisted, written after EVERY save
  arTier: 1 | 2 | 3;              // Detected at startup; persisted
  sessionComplete: boolean;        // true for multi-day farms after session 1
  uploadStatus:                    // NOT persisted — resets to 'idle' on launch
    | 'idle'
    | 'uploading'
    | 'processing'
    | 'success'
    | 'error';
}
```

**Persistence config** (already correct in `store/index.ts`):
```typescript
const auditPersistConfig = {
  key: 'audit',
  version: 1,
  storage: mmkvStorage,
  blacklist: ['uploadStatus'],  // uploadStatus MUST NOT persist
};
```

**State transitions**:
```
idle → (tap "Start Audit") → loading zones
     → (zones received) → ZoneNavigationScreen [arTier from MMKV or native check]
     → (arrived at zone) → ARCameraScreen
       → (tree confirmed) → addScannedTree() + MMKV write
       → (zone complete) → setCurrentZoneIndex(index + 1)
     → (all zones complete) → AuditCompleteScreen
       → (submit + network OK) → uploadStatus: uploading → processing → success/error
       → (submit + no network) → pending_upload saved to MMKV
```

---

## Entity 4: PendingUpload

**Source**: Built from `audit.scannedTrees` + `audit.activeAuditId` + `audit.activeLandId`
when internet is unavailable at submit time. Saved under MMKV key `'pending_upload'`.
Matches `POST /api/v1/audit/submit-samples` request body exactly.

```typescript
interface PendingUpload {
  land_id: string;         // audit.activeLandId
  audit_id: string;        // audit.activeAuditId
  trees: Array<{
    zone_id: string;
    species: string;
    dbh_cm: number;
    height_m: number | null;
    gps: { lat: number; lng: number };
    ar_tier_used: 1 | 2 | 3;      // Integer — never A/B/C
    confidence_score: number | null;
    evidence_photo_base64: string;
    evidence_photo_hash: string;   // SHA-256 computed on-device
  }>;
}
```

**Validation before retry** (background fetch handler):
1. `mmkv.getString('pending_upload')` exists and is non-null
2. JSON.parse succeeds without throwing
3. `payload.audit_id` is a non-empty string
4. `payload.trees` is a non-empty array
5. Failed validation → `mmkv.delete('pending_upload')` → skip upload

---

## Entity 5: ARMeasurementResult (TypeScript bridge type)

**Source**: SRS §14.6. Returned by `ARModule.measureCylinder()` as JSON string,
parsed in `ar-bridge.ts`.

```typescript
interface ARMeasurementResult {
  diameter_cm: number;       // Diameter at breast height
  confidence: number;        // RANSAC inlier ratio (0.0–1.0)
  tier_used: 1 | 2;          // 1 = RAW_DEPTH_ONLY, 2 = SLAM
  point_count: number;       // Total 3D points used
}
```

---

## Entity 6: SpeciesInferenceResult (new type for TFLite bridge)

**Source**: research.md D-002. Returned by `ARModule.runSpeciesInference()` as JSON
string.

```typescript
interface SpeciesInferenceResult {
  species: string;           // Top-1 species name (must be in APPROVED_SPECIES)
  confidence: number;        // 0.0–1.0 (≥ 0.60 auto-accepts)
  all_scores: number[];      // Probabilities for all 11 species (debug/logging)
}
```

---

## Entity 7: AuditZonesResponse (API response type)

**Source**: BSDD §5.4 `GET /api/v1/audit/zones` response.

```typescript
interface AuditZonesResponse {
  audit_id: string;
  zones: SamplingZone[];          // zone_id, label, centre_gps, radius_metres,
                                  // zone_type, sequence_order, gedi_available
  walking_path_metres: number;    // Shown on AuditStartScreen
  min_trees_required: number;     // Stored in Redux, used for progress counters
}
```

---

## Entity 8: SubmitSamplesResponse (API response type)

**Source**: BSDD §5.4 `POST /api/v1/audit/submit-samples` response.

```typescript
interface SubmitSamplesResponse {
  status: 'processing';
  audit_id: string;
  estimated_seconds: number;   // Used for spinner message duration hint
  message: string;
}
```

---

## Entity 9: AuditResultResponse (API response type — polling)

**Source**: BSDD §5.4 `GET /api/v1/audit/result/{audit_id}` response.

```typescript
type AuditResultResponse =
  | { status: 'CALCULATING' }
  | {
      status: 'MINTED';
      total_biomass_tonnes: number;
      credits_issued: number;
      tx_hash: string;
      ipfs_certificate_url: string;
      audit_year: number;
    }
  | {
      status: 'FAILED';
      error: string;
    };
```

---

## Species Constants (existing — `common/constants/species.ts`)

```typescript
// Must contain exactly 11 entries — no adds, no removes
const SPECIES_DENSITY: Record<string, number> = {
  'Teak':             0.60,
  'Eucalyptus':       0.55,
  'Neem':             0.56,
  'Mango':            0.54,
  'Bamboo':           0.70,
  'Pongamia':         0.67,
  'Subabul':          0.56,
  'Casuarina':        0.69,
  'Indian Rosewood':  0.75,
  'Drumstick':        0.39,
  'Amla':             0.74,
};
export const APPROVED_SPECIES = Object.keys(SPECIES_DENSITY);
```

---

## Navigation Types (`src/types/navigation.ts` additions)

```typescript
export type AuditStackParamList = {
  AuditStart:      { landId: string; landName: string };
  ZoneNavigation:  { auditId: string; landId: string };
  ARCamera:        { zoneId: string; zoneIndex: number };
  ManualMeasure:   { returnDiameter?: number };
  TreeResult:      undefined;          // reads from Redux
  AuditComplete:   undefined;          // reads from Redux
};
```
