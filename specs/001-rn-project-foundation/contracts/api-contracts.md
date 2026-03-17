# API Contracts: TerraTrust-AR Mobile ↔ Backend

**Source of Truth**: SRS_TerraTrust_v3.1.txt Sections 5–8 and FDD Section 8  
**Status**: READ-ONLY derived from SRS — do not modify to match implementation.  
 If implementation differs from these types, fix the implementation.

All requests use the Axios instance from `src/services/api.ts`.  
All requests automatically carry `Authorization: Bearer <supabase-jwt>`.  
Base URL: `Config.API_BASE_URL` from `.env.*` via `react-native-config`.  
All endpoints are prefixed `/api/v1/`.

---

## Auth Endpoints

### POST /api/v1/auth/kyc

Called after first KYC form submission on `KYCScreen`.

```ts
export interface KYCRequest {
  full_name: string; // Farmer's full name (matched against 7/12 OCR later)
  aadhaar_number: string; // 12-digit string — backend hashes with SHA-256
}

export interface KYCResponse {
  status: "success";
  user_id: string; // Supabase UUID
}
```

> **Security**: `aadhaar_number` is the ONE place plain-text Aadhaar exists in the app
> (the form input). It MUST be sent immediately to the backend and NEVER stored in
> Redux, MMKV, or any persistent storage. The backend hashes it; the hash is stored.

---

### POST /api/v1/auth/register-wallet

Called once after silent wallet creation on first OTP verification.

```ts
export interface RegisterWalletRequest {
  wallet_address: string; // 0x-prefixed public address ONLY — never private key
}

export interface RegisterWalletResponse {
  status: "success";
}
```

---

## Land Endpoints

### POST /api/v1/land/verify-document

Sends the 7/12 document photo for PaddleOCR processing.

```ts
export interface VerifyDocumentRequest {
  image_base64: string; // Base64-encoded JPG or PNG, max 10MB
}

export interface VerifyDocumentResponse {
  survey_number: string;
  owner_name: string;
  village: string;
  taluka: string;
  district: string;
  state: string;
  extraction_confidence: number; // 0.0–1.0 overall OCR confidence
}
```

---

### GET /api/v1/land/fetch-boundary

Fetches the official government boundary polygon for the extracted OCR fields.

```ts
export interface FetchBoundaryRequest {
  survey_number: string;
  district: string;
  taluka: string;
  village: string;
  state: string;
  user_lat: number; // Farmer's current GPS — used for WMS bounding box
  user_lng: number;
}

export type FetchBoundaryResponse =
  | {
      status: "success";
      boundary_source: "WMS_AUTO" | "SCRAPE" | "MANUAL";
      geojson: { type: "Polygon"; coordinates: number[][][] };
      satellite_thumbnail_url: string; // GEE Sentinel-2 PNG URL to cache
    }
  | {
      status: "manual_required";
      // boundary_source: undefined — layers 1 and 2 both failed
    };
```

---

### POST /api/v1/land/register

Confirms boundary and saves it permanently to Supabase PostGIS.

```ts
export interface RegisterLandRequest {
  farm_name: string;
  survey_number: string;
  district: string;
  taluka: string;
  village: string;
  state: string;
  boundary_source: "WMS_AUTO" | "SCRAPE" | "MANUAL";
  geojson: { type: "Polygon"; coordinates: number[][][] };
  ocr_owner_name: string;
}

export interface RegisterLandResponse {
  land_id: string; // Supabase UUID
  area_hectares: number; // Calculated by PostGIS ST_Area
  status: "verified";
}

// Error responses:
// 400: { error: 'Owner name mismatch' }
// 409: { error: 'Survey number already registered' }
```

---

### GET /api/v1/land/list

Fetches all registered land parcels for the authenticated farmer.

```ts
// No request body; user identified from JWT
export interface LandListItem {
  id: string;
  farm_name: string;
  survey_number: string;
  area_hectares: number;
  is_verified: boolean;
  status: "verified" | "pending" | "rejected";
  last_audit_year: number | null;
  thumbnail_url: string | null; // GEE Sentinel-2 PNG — cache after first load
}

export type LandListResponse = LandListItem[];
```

---

## Audit Endpoints

### GET /api/v1/audit/zones

Fetches NDVI-guided sampling zones for a land parcel. Called when farmer taps "Start Audit".

```ts
export interface FetchZonesRequest {
  land_id: string; // Query parameter
}

export interface ZoneItem {
  zone_id: string;
  label: string; // 'Zone A', 'Zone B', etc.
  centre_gps: { lat: number; lng: number };
  radius_metres: number; // 7, 9, or 11 per SRS Section 7.2
  zone_type: "high_density" | "medium_density" | "low_density";
  sequence_order: number; // Walk order (nearest-neighbour path)
  gedi_available: boolean; // False = AR height measurement required
}

export interface FetchZonesResponse {
  audit_id: string;
  zones: ZoneItem[];
  walking_path_metres: number;
  min_trees_required: number; // = zones.length × 3
}
```

---

### POST /api/v1/audit/submit-samples

Sends all scanned tree data for satellite processing and blockchain minting.

```ts
export interface TreeSamplePayload {
  zone_id: string;
  species: string;
  dbh_cm: number;
  height_m: number | null; // null = use GEDI satellite height
  gps: { lat: number; lng: number };
  ar_tier_used: 1 | 2 | 3; // INTEGER — never string, never A/B/C
  confidence_score: number | null; // RANSAC quality 0.0–1.0; null for Tier 3
  evidence_photo_base64: string; // Full photo bytes
  evidence_photo_hash: string; // SHA-256 hex computed on-device before upload
}

export interface SubmitAuditRequest {
  land_id: string;
  audit_id: string;
  trees: TreeSamplePayload[];
}

export interface SubmitAuditResponse {
  status: "processing";
  audit_id: string;
  estimated_seconds: number; // Typically 60
}
```

---

### GET /api/v1/audit/result/{audit_id}

Polled every 5 seconds after submission until status is not `'CALCULATING'`.

```ts
export type AuditResultResponse =
  | { status: "CALCULATING" }
  | {
      status: "MINTED";
      total_biomass_tonnes: number;
      credits_issued: number;
      tx_hash: string;
      ipfs_certificate_url: string; // 'ipfs://CID' — open in browser
      audit_year: number;
    }
  | {
      status: "FAILED";
      error: string;
    };
```

---

## Credits Endpoint

### GET /api/v1/credits/balance

Fetches total CTT balance and full audit history.

```ts
// Query param: wallet_address (from auth state)
export interface CreditsBalanceResponse {
  balance_ctt: number;
  history: Array<{
    audit_year: number;
    credits_issued: number;
    land_name: string;
    tx_hash: string;
    ipfs_certificate_url: string;
    minted_at: string; // ISO 8601
  }>;
}
```

---

## Axios Instance Contract

```ts
// src/services/api.ts — required shape

import axios from "axios";
import Config from "react-native-config";
import { supabase } from "./supabase";

const api = axios.create({
  baseURL: Config.API_BASE_URL,
  timeout: 60_000, // 60 s — satellite processing can be slow
});

// Request interceptor: auto-attach Supabase JWT
api.interceptors.request.use(async (config) => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

// Response interceptor: global error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Navigate to LoginScreen (handled via navigation ref or event emitter)
    } else if (error.response?.status >= 500) {
      // Show maintenance banner
    } else if (!error.response) {
      // Show offline banner
    }
    return Promise.reject(error);
  },
);

export default api;
```

---

## Supabase Auth Contract

The Supabase client is used **only** for phone OTP authentication.  
All subsequent data operations use the Axios instance above.

```ts
// src/services/supabase.ts — required shape
import { createClient } from "@supabase/supabase-js";
import Config from "react-native-config";

export const supabase = createClient(
  Config.SUPABASE_URL,
  Config.SUPABASE_ANON_KEY,
);

// Sign in — triggers SMS OTP
// supabase.auth.signInWithOtp({ phone: '+91XXXXXXXXXX' })

// Verify OTP
// supabase.auth.verifyOtp({ phone: '+91XXXXXXXXXX', token: '123456', type: 'sms' })

// Get current session (used in Axios interceptor)
// supabase.auth.getSession()

// Sign out
// supabase.auth.signOut()
```
