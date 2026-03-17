# Data Model: React Native Project Foundation

**Feature**: 001-rn-project-foundation  
**Source of Truth**: SRS_TerraTrust_v3.1.txt (Sections 5–13), FDD Section 7  
**Date**: 2026-03-18

All TypeScript types defined here are the canonical type definitions for the
entire application. Every slice, every API call, and every screen component
MUST import from this model — types MUST NOT be redefined inline.

---

## 1. Auth Domain

```ts
// src/features/auth/store/authSlice.ts

export interface AuthUser {
  id: string; // Supabase UUID
  name: string; // Full name from KYC
  phone: string; // '+91XXXXXXXXXX' format
  aadhaar_hash: string; // SHA-256 hex — never plain text
}

export interface AuthState {
  user: AuthUser | null;
  walletAddress: string | null; // Public blockchain address only
  isAuthenticated: boolean;
  kycCompleted: boolean;
}

// Initial state
export const authInitialState: AuthState = {
  user: null,
  walletAddress: null,
  isAuthenticated: false,
  kycCompleted: false,
};
```

### Validation Rules

- `aadhaar_hash`: Must be a 64-character lowercase hex string (SHA-256 output)
- `walletAddress`: Must be a valid Ethereum address (`0x` + 40 hex chars) when present
- `phone`: Must match `/^\+91\d{10}$/`
- `user.name`: Must not be empty; used for fuzzy match against OCR owner name

---

## 2. Land Domain

```ts
// src/features/land/store/landSlice.ts

export type BoundarySource = "WMS_AUTO" | "SCRAPE" | "MANUAL";
export type LandStatus = "verified" | "pending" | "rejected";

export interface GeoJSONPolygon {
  type: "Polygon";
  coordinates: number[][][]; // [[[lng, lat], ...], ...] — GeoJSON spec
}

export interface LandParcel {
  id: string; // Supabase UUID
  farm_name: string; // Farmer-given name (e.g. "North Field")
  survey_number: string;
  district: string;
  taluka: string;
  village: string;
  state: string;
  area_hectares: number;
  boundary_geojson: GeoJSONPolygon;
  boundary_source: BoundarySource; // Affects audit credibility score
  is_verified: boolean;
  status: LandStatus;
  last_audit_year: number | null;
  thumbnail_url: string | null; // GEE Sentinel-2 PNG URL (cached)
  created_at: string; // ISO 8601
}

export interface OCRResult {
  survey_number: string;
  owner_name: string;
  village: string;
  taluka: string;
  district: string;
  state: string;
  extraction_confidence: number; // 0.0–1.0
}

export interface LandDraft {
  ocr_result: OCRResult | null;
  boundary: GeoJSONPolygon | null;
  boundary_source: BoundarySource | null;
  satellite_thumbnail_url: string | null;
  fetch_status: "idle" | "fetching" | "success" | "manual_required" | "error";
}

export interface LandState {
  parcels: LandParcel[];
  currentDraft: LandDraft; // NOT persisted — cleared after registration
}

export const landInitialState: LandState = {
  parcels: [],
  currentDraft: {
    ocr_result: null,
    boundary: null,
    boundary_source: null,
    satellite_thumbnail_url: null,
    fetch_status: "idle",
  },
};
```

### Validation Rules

- `boundary_geojson.coordinates`: Must form a valid closed polygon (first and last coordinate equal)
- `area_hectares`: Must be between 0.1 and 100 (validated by backend; app shows error if outside range)
- `boundary_source`: Only the three enum values are valid; stored permanently for audit credibility

---

## 3. Audit Domain

```ts
// src/features/ar-audit/store/auditSlice.ts

export type ARTier = 1 | 2 | 3; // 1=RAW_DEPTH, 2=SLAM, 3=MANUAL — integers only, never A/B/C
export type UploadStatus =
  | "idle"
  | "uploading"
  | "processing"
  | "success"
  | "error";

export interface GPS {
  lat: number;
  lng: number;
}

export interface SamplingZone {
  zone_id: string; // Backend UUID
  label: string; // 'Zone A', 'Zone B', etc.
  centre_gps: GPS;
  radius_metres: number; // 7, 9, or 11 per SRS Section 7.2
  zone_type: "high_density" | "medium_density" | "low_density";
  sequence_order: number;
  gedi_available: boolean; // If false, AR height needed
  trees_scanned: number; // Incremented locally
  is_complete: boolean;
}

export interface TreeSample {
  tree_id: string; // UUID v4 generated locally
  zone_id: string;
  species: string;
  species_confidence: number; // 0.0–1.0
  dbh_cm: number;
  wood_density: number; // g/cm³ — auto-looked up from species table
  ar_height_m: number | null; // null when GEDI is available
  measurement_tier: ARTier; // 1 | 2 | 3
  confidence_score: number | null; // RANSAC fit quality; null for Tier 3
  gps_lat: number;
  gps_lng: number;
  gps_accuracy_m: number;
  evidence_photo_base64: string; // Full photo bytes
  evidence_photo_hash: string; // SHA-256 hex — computed before upload
  scan_timestamp: string; // ISO 8601
}

export interface AuditState {
  activeAuditId: string | null;
  activeLandId: string | null;
  zones: SamplingZone[];
  currentZoneIndex: number;
  scannedTrees: TreeSample[]; // MOST CRITICAL — persisted to MMKV immediately per tree
  arTier: ARTier; // Detected once at startup; 1 | 2 | 3
  sessionComplete: boolean; // For multi-day audits (farms > 10 acres)
  uploadStatus: UploadStatus; // NOT persisted — resets to 'idle' on launch
}

export const auditInitialState: AuditState = {
  activeAuditId: null,
  activeLandId: null,
  zones: [],
  currentZoneIndex: 0,
  scannedTrees: [],
  arTier: 3, // Safe default; overwritten at startup by AR detection
  sessionComplete: false,
  uploadStatus: "idle",
};
```

### Validation Rules

- `measurement_tier`: MUST be `1`, `2`, or `3` — TypeScript discriminated union enforces this
- `evidence_photo_hash`: Must be a 64-character lowercase hex string
- `ar_height_m`: Required when `gedi_available=false` for the zone; null when GEDI data is present
- `dbh_cm`: Must be between 5 and 200 (app-level sanitisation gate per SRS)
- `species`: Must be one of the 11 approved species from `src/common/constants/species.ts`

---

## 4. Credits Domain

```ts
// src/features/dashboard/store/creditsSlice.ts

export interface AuditRecord {
  audit_id: string;
  audit_year: number;
  land_id: string;
  land_name: string;
  credits_issued: number; // CTT tokens (equals CO2 tonnes)
  total_biomass_tonnes: number;
  tx_hash: string;
  ipfs_certificate_url: string; // 'ipfs://CID' — open in browser
  minted_at: string; // ISO 8601
}

export interface CreditsState {
  balance: number; // Total CTT tokens across all parcels
  history: AuditRecord[];
  pendingMint: boolean; // True while blockchain tx is in flight
}

export const creditsInitialState: CreditsState = {
  balance: 0,
  history: [],
  pendingMint: false,
};
```

---

## 5. Species Constants

```ts
// src/common/constants/species.ts

export interface Species {
  name: string;
  scientificName: string;
  woodDensity: number; // g/cm³ — used directly in Chave's allometric equation
}

export const APPROVED_SPECIES: Species[] = [
  { name: "Teak", scientificName: "Tectona grandis", woodDensity: 0.6 },
  { name: "Eucalyptus", scientificName: "Eucalyptus spp.", woodDensity: 0.55 },
  { name: "Neem", scientificName: "Azadirachta indica", woodDensity: 0.56 },
  { name: "Mango", scientificName: "Mangifera indica", woodDensity: 0.54 },
  { name: "Bamboo", scientificName: "Bambusa spp.", woodDensity: 0.7 },
  { name: "Pongamia", scientificName: "Pongamia pinnata", woodDensity: 0.67 },
  {
    name: "Subabul",
    scientificName: "Leucaena leucocephala",
    woodDensity: 0.56,
  },
  {
    name: "Casuarina",
    scientificName: "Casuarina equisetifolia",
    woodDensity: 0.69,
  },
  {
    name: "Indian Rosewood",
    scientificName: "Dalbergia sissoo",
    woodDensity: 0.75,
  },
  { name: "Drumstick", scientificName: "Moringa oleifera", woodDensity: 0.39 },
  { name: "Amla", scientificName: "Phyllanthus emblica", woodDensity: 0.74 },
];

// Array of just names for O(1) lookup
export const APPROVED_SPECIES_NAMES: string[] = APPROVED_SPECIES.map(
  (s) => s.name,
);

export const getWoodDensity = (speciesName: string): number | null => {
  const species = APPROVED_SPECIES.find((s) => s.name === speciesName);
  return species?.woodDensity ?? null;
};
```

> **Source**: Global Wood Density Database (Zanne et al. 2009) + regional literature.  
> **Count**: Exactly 11 species — adding or removing any requires explicit SRS amendment.

---

## 6. Navigation Types

```ts
// src/types/navigation.ts

export type RootStackParamList = {
  SplashScreen: undefined;
  LoginScreen: undefined;
  OTPScreen: { phone: string };
  KYCScreen: undefined;
  LandListScreen: undefined;
  DocumentUploadScreen: undefined;
  BoundaryConfirmScreen: {
    geojson: GeoJSONPolygon;
    survey_number: string;
    owner_name: string;
    satellite_thumbnail_url: string;
    boundary_source: BoundarySource;
  };
  ManualUploadGuideScreen: undefined;
  AuditStartScreen: { landId: string };
  ZoneNavigationScreen: { auditId: string; landId: string };
  ARCameraScreen: { zoneId: string; auditId: string };
  ManualMeasureScreen: { zoneId: string; auditId: string };
  TreeResultScreen: { treeId: string };
  AuditCompleteScreen: { auditId: string };
  HomeScreen: undefined;
  CreditHistoryScreen: undefined;
};

// Global augmentation: useNavigation() is typed everywhere without explicit generics
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
```

---

## 7. State Persistence Map

| Slice key                | Persisted? | Storage | Reason                                     |
| ------------------------ | ---------- | ------- | ------------------------------------------ |
| `auth.user`              | ✅ Yes     | MMKV    | Avoid re-fetching profile on every launch  |
| `auth.walletAddress`     | ✅ Yes     | MMKV    | Avoid server round-trip on every launch    |
| `auth.isAuthenticated`   | ✅ Yes     | MMKV    | Avoid forcing re-login on every launch     |
| `auth.kycCompleted`      | ✅ Yes     | MMKV    | Avoid re-running KYC check                 |
| `land.parcels`           | ✅ Yes     | MMKV    | Offline access to land list + thumbnails   |
| `land.currentDraft`      | ❌ **No**  | —       | Registration session data; clear on launch |
| `audit.scannedTrees`     | ✅ Yes     | MMKV    | **MOST CRITICAL** — survives crash/battery |
| `audit.activeAuditId`    | ✅ Yes     | MMKV    | Knows an audit is in progress              |
| `audit.currentZoneIndex` | ✅ Yes     | MMKV    | Resumes at correct zone without re-walking |
| `audit.arTier`           | ✅ Yes     | MMKV    | Avoids re-running ARCore check each launch |
| `audit.zones`            | ✅ Yes     | MMKV    | Needed to resume multi-day audits          |
| `audit.uploadStatus`     | ❌ **No**  | —       | Resets to `'idle'` on every launch         |
| `credits.balance`        | ✅ Yes     | MMKV    | Show last known balance while loading      |
| `credits.history`        | ✅ Yes     | MMKV    | Show cached history offline                |

> **Implementation note**: `audit.zones` is persisted because the multi-day audit flow (farms >10 acres) requires the zone list to survive an app restart between sessions. This is consistent with persisting `activeAuditId`.

---

## 8. Entity Relationships

```
AuthUser ─── wallet_address ──► blockchain wallet (Keychain, never Redux)
    │
    └─── has many ──► LandParcel
                          │
                          └─── has many ──► AuditRecord (credits.history)
                          │
                          └─── has ──► GeoJSONPolygon (boundary)
                                            │
                                            └─── contains ──► SamplingZone[]
                                                                    │
                                                                    └─── contains ──► TreeSample[]
```
