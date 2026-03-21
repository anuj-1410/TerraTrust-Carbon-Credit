# Implementation Plan: Land Verification Module

**Branch**: `003-land-verification-module` | **Date**: 2026-03-21 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-land-verification-module/spec.md`

## Summary

Implement the complete land registration flow for the TerraTrust-AR app: four screens
(`LandListScreen`, `DocumentUploadScreen`, `BoundaryConfirmScreen`,
`ManualUploadGuideScreen`), the pre-scaffolded `landSlice` wired to all screens and
the Redux store, and four API integrations against the land module endpoints in
`src/services/api.ts`. The module transforms a paper 7/12 Extract or Record of Rights
photo into a verified GeoJSON boundary stored per-parcel in Redux + MMKV, gating all
future satellite analysis and AR tree scanning on that parcel.

Key technical decisions (from `research.md`):
- `satellite_thumbnail_url` field included in fetch-boundary response per SRS (D-001)
- Gallery picking uses `react-native-document-picker` (NOT react-native-image-picker) (D-002)
- BoundaryConfirmScreen uses absolute-fill `<Image>` + `<MapView mapType="none">` + `<Polygon>` (D-003)
- Owner name mismatch error (HTTP 400 from register) is displayed on BoundaryConfirmScreen (D-004)
- GPS for fetch-boundary is best-effort (5s timeout, proceed without if unavailable) (D-005)
- `LandParcel.boundary_geojson` changed to nullable (D-008)
- Two new packages: `react-native-document-picker`, `@react-native-community/netinfo` (D-002, D-007)

## Technical Context

**Language/Version**: TypeScript 5.0+ strict mode (`"strict": true`). React Native 0.84.1. NOT Expo.  
**Primary Dependencies**: react-native-vision-camera v4 (camera capture), react-native-document-picker (gallery picker), react-native-maps 1.27 (Polygon overlay on BoundaryConfirmScreen), react-native-geolocation-service (GPS for boundary fetch), @react-native-community/netinfo (offline detection), axios (API calls via api.ts), Redux Toolkit 2.0 + redux-persist + MMKV (land slice), React Navigation v6 native stack, NativeWind 4.0, lottie-react-native (spinning_leaf.json), Zod + React Hook Form (farm_name input)  
**Storage**: `react-native-mmkv` via redux-persist — `land.parcels` MUST persist; `land.currentDraft` MUST NOT persist (blacklisted in `store/index.ts` — already configured). `thumbnail_url` per parcel is the MMKV-cached GEE PNG URL, populated from `satellite_thumbnail_url` field of fetch-boundary response.  
**Testing**: Jest + React Native Testing Library (RNTL). Unit tests for `landSlice` reducers and `hectaresToAcres`/`sqmToHectares` utilities. Integration tests for LandListScreen with mocked Redux state. Physical device required for VisionCamera and GPS; emulator OK for Redux and UI smoke tests.  
**Target Platform**: Android 13+ (API 33 minimum), API 34 target. Physical device preferred for VisionCamera and geolocation; emulator acceptable for Redux/UI tests.  
**Project Type**: mobile-app (React Native CLI, Android-only, field operations tool)  
**Performance Goals**: LandListScreen offline load < 200ms from MMKV cache (SC-004). Full registration flow < 3 minutes on standard 4G (SC-001). OCR correct for ≥90% of clearly photographed 7/12 documents (SC-002 — backend responsibility).  
**Constraints**: No Google Maps satellite tiles on BoundaryConfirmScreen — GEE Sentinel-2 PNG only (constitution Map Rules, user requirement). LandListScreen uses static `<Image>`, no map component. `land.currentDraft` MUST NOT persist to MMKV. `land.parcels` MUST persist. Document picker must NOT be `react-native-image-picker`. All touch targets ≥ 48×48px. Status badge strings must match exactly. Roboto Mono on numeric values.  
**Scale/Scope**: 4 screens, 1 Redux slice (minor type fix), 4 backend endpoints, 2 new npm packages.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

Verify ALL of the following before proceeding:

- [x] **Scope** (Principle I): This feature is frontend-only React Native.
      No backend, Python, Solidity, or GEE code is written here.
      All four API contracts (`POST /api/v1/land/verify-document`,
      `GET /api/v1/land/fetch-boundary`, `POST /api/v1/land/register`,
      `GET /api/v1/land/list`) verified against `SRS_TerraTrust_v3.1.txt §6.5`
      and BSDD §5.3. SRS is authoritative; BSDD used as supplementary reference.
      `satellite_thumbnail_url` field included per SRS §6.5 (research D-001).
      See `contracts/api-contracts.md`.
- [x] **Security** (Principle II): Private key stays in Keychain only — no private
      key operations in this feature. Aadhaar: not in scope for land module.
      Evidence photos: not in scope for land module (land document photo is
      sent as-is to `verify-document`, no SHA-256 required per SRS §6.5 —
      document images are not audit evidence photos).
      Mock GPS detection: not in scope for land registration (only required for
      AR audit start). Rooted device banner: established in feature 001/002,
      not re-implemented here. `.env` in `.gitignore` (established in 001).
      No `SUPABASE_SERVICE_KEY` in app code.
- [x] **Offline-first** (Principle III): `land.parcels` persisted to MMKV via
      redux-persist blacklist configuration (established in 001). LandListScreen
      reads from Redux MMKV cache immediately (< 200ms — SC-004). List API call
      is best-effort; offline shows cached data with "Last synced" timestamp.
      `currentDraft` preserved in Redux on API failure — no data loss on
      network error during registration flow. Thumbnail URLs cached via
      `land.parcels[].thumbnail_url` in MMKV; RN Fresco caches PNG bytes on disk.
      BoundaryConfirmScreen has PNG load fallback (plain colour background) so
      polygon is always visible even if PNG URL fails (SC-003).
- [x] **AR Tier integers** (Principle IV): Not in scope for land screens.
      No AR tier references appear in land module code. `auditSlice.arTier`
      typed `1 | 2 | 3` — already established in feature 001; not touched here.
- [x] **Boundary authority** (Principle V): BoundaryConfirmScreen displays
      government-sourced GeoJSON polygon from the backend 3-layer router
      (WMS_AUTO → SCRAPE → MANUAL). No farmer-drawn polygon. No Draw Mode.
      No Walk Mode. `boundary_source` stored per parcel as
      `'WMS_AUTO' | 'SCRAPE' | 'MANUAL'` in Redux `land.parcels[].boundary_source`
      (persisted to MMKV). ManualUploadGuideScreen triggers Layer 3 (farmer
      downloads official government map; OpenCV extracts boundary server-side).
- [x] **Persistence discipline** (Principle VI): `land.parcels` persisted ✅.
      `land.currentDraft` blacklisted (NOT persisted) ✅ — already configured
      in `src/store/index.ts`. No new persist config changes needed.
      `audit.uploadStatus` blacklisted ✅ (established in 001). All required
      audit slices persisted ✅ (established in 001, not touched here).
- [x] **Stitch-first UI** (Principle VII): Stitch MCP must be used to design
      all four screens before any screen implementation begins. NativeWind
      utility classes only — no `StyleSheet.create` for screen layout (one
      exception: `StyleSheet.absoluteFill` used in BoundaryConfirmScreen for
      the Image + MapView geometry stack — this is a geometry constant, not a
      layout stylesheet). All touch targets ≥ 48×48px verified against spec.
      `spinning_leaf.json` used for loading states (OCR and boundary fetch).
      Roboto Mono on area values (acres) and status badge strings match exactly:
      `"✓ Verified"`, `"⏳ Pending"`, `"✗ Rejected"`.

## Project Structure

### Documentation (this feature)

```text
specs/003-land-verification-module/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output — 9 decisions resolved
├── data-model.md        # Phase 1 output — LandParcel, LandDraft, OCRResult, API response types
├── quickstart.md        # Phase 1 output — implementation order, new packages, constraints
├── contracts/
│   └── api-contracts.md # Phase 1 output — all 4 endpoints with TypeScript types
└── tasks.md             # Phase 2 output (/speckit.tasks command — NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
# Land Verification Module — React Native (Android)

src/features/land/
├── screens/
│   ├── LandListScreen.tsx          # P1 — FlatList of parcels, GEE thumbnails, empty state
│   ├── DocumentUploadScreen.tsx    # P1 — VisionCamera capture, gallery picker, OCR review
│   ├── BoundaryConfirmScreen.tsx   # P1 — Satellite PNG + MapView Polygon + confirm/reject
│   └── ManualUploadGuideScreen.tsx # P2 — 4-step guide, portal link, upload button
└── store/
    └── landSlice.ts                # Minor fix: boundary_geojson → GeoJSONPolygon | null

src/services/
└── api.ts                          # Verified: no changes needed (60s timeout, JWT interceptor)

src/common/utils/
└── units.ts                        # Must have: hectaresToAcres(), sqmToHectares()

src/types/
└── navigation.ts                   # Add LandStackParamList if missing

# New npm packages (to be installed)
# react-native-document-picker      ← gallery picker (NOT react-native-image-picker)
# @react-native-community/netinfo   ← offline detection
```

**Structure Decision**: Single project — Android-only React Native CLI app. Land
module is a feature within the existing `src/features/land/` directory. No new
directory structure additions; four placeholder screen files and one store file are
already scaffolded. Work is modification-only (no new screen file creation needed).

## Complexity Tracking

> **No constitution violations.** All gates pass. No justification table needed.
