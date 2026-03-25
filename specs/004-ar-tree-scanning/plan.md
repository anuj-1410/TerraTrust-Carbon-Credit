# Implementation Plan: AR Tree Scanning Module

**Branch**: `004-ar-tree-scanning` | **Date**: 2026-03-26 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-ar-tree-scanning/spec.md`

## Summary

Implement the complete AR tree scanning module for TerraTrust-AR: six screens
(`AuditStartScreen`, `ZoneNavigationScreen`, `ARCameraScreen`, `ManualMeasureScreen`,
`TreeResultScreen`, `AuditCompleteScreen`), async Redux thunks added to the
pre-scaffolded `auditSlice`, two custom hooks (`useARTier`, `useGeofence`), the Kotlin
native bridge (`ARModule.kt` / `ARPackage.kt`), a TypeScript AR bridge (`ar-bridge.ts`),
and a `pendingUploadService` for offline retry. This feature is the carbon credit data
collection pipeline — it turns a physical tree walk into a verifiable IPFS-anchored
audit record.

Key technical decisions (from `research.md`):
- GPS grace period: 30-second time-based window using last good position (accuracy ≤ 15m) — count-based rejected for jitter (D-001)
- TFLite species inference: custom Kotlin `@ReactMethod` in `ARModule.kt` — `react-native-fast-tflite` rejected (unmaintained); `@tensorflow/tfjs-react-native` rejected (2MB bundle) (D-002)
- Background-fetch reconnect: `requiredNetworkType: NETWORK_TYPE_ANY` + HeadlessTask registered in `index.js` — NOT `MainApplication.kt` (D-003)
- `auditSlice` + Redux persist config fully scaffolded from feature 001; no structure changes needed (D-004)
- All 6 screen stubs already exist — implementation replaces stubs, no new files (D-005)
- `runSpeciesInference` added to existing `ARModule.kt`; TFLite model loaded once in `init {}` block (D-006)
- Tier 2 SLAM: 5-second ARCore frame accumulation on Kotlin HandlerThread, then same RANSAC as Tier 1 (D-007)
- Evidence photo auto-captured at diameter lock; SHA-256 computed before any MMKV write (D-008)

## Technical Context

**Language/Version**: TypeScript 5.0+ strict mode (`"strict": true`). React Native 0.84.1. Kotlin (Android).
NOT Expo.

**Primary Dependencies**: react-native-vision-camera v4 (ARCameraScreen live preview + snapshot),
react-native-maps with `mapType="standard"` (ZoneNavigationScreen road map), react-native-geolocation-service
(GPS zone arrival + geofence checks every 3s), react-native-haptic-feedback (zone arrival vibration +
diameter lock vibration), react-native-quick-crypto (SHA-256 evidence photo hashing), lottie-react-native
(`spinning_leaf.json`, `scan_success.json`, `credit_earned.json`), react-native-background-fetch
(reconnect-triggered pending_upload retry), react-native-device-info (rooted device warning),
react-native-reanimated (screen transitions + AR tier 2 motion guide animation), ARCore SDK via Kotlin
(`com.google.ar:core:1.42.0`), TensorFlow Lite via Kotlin (`org.tensorflow:tensorflow-lite:2.14.0`),
axios (api.ts — all API calls), Redux Toolkit 2.0 + redux-persist + MMKV (auditSlice), React Navigation v6
native stack, NativeWind 4.0, Zod + React Hook Form (ManualMeasureScreen circumference input), uuid v4
(tree_id generation).

**Storage**: `react-native-mmkv` via redux-persist. `audit.scannedTrees`, `audit.activeAuditId`,
`audit.currentZoneIndex`, `audit.arTier` MUST persist. `audit.uploadStatus` MUST NOT persist (blacklisted
in `store/index.ts` — already configured). MMKV key `'pending_upload'` used for offline submit payload
(raw string, not via redux-persist).

**Testing**: Jest + React Native Testing Library (RNTL). Unit tests for `auditSlice` reducers, `hashPhoto()`
SHA-256 output, ManualMeasureScreen DBH calculation (`circumference / π`), and `pendingUploadService`
validation logic. Integration tests for AuditStartScreen with mocked API. Physical device required for
ARCore (checkDepthSupport, measureCylinder), VisionCamera live preview, GPS arrival detection, and
background-fetch connectivity trigger. Emulator acceptable for Redux, UI smoke tests, and navigation flow.

**Target Platform**: Android 13+ (API 33 minimum), API 34 target. ARCore requires physical device.

**Project Type**: mobile-app (React Native CLI, Android-only, field operations tool).

**Performance Goals**: Tier 1 diameter measurement < 5 seconds (SC-003). Tier 2 < 8 seconds (SC-003).
Species identification (TFLite) < 500ms (SC-004). "Confirm and Save Tree" MMKV write < 100ms (SC-007).
GPS arrival detection activates button within 6 seconds (one 3s check cycle + processing) (SC-008).
Pending upload retry within 60 seconds of connectivity restore (SC-005).

**Constraints**: `mapType="standard"` on ZoneNavigationScreen — never satellite tiles. AR tiers are
integers 1/2/3 everywhere — no A/B/C. `audit.uploadStatus` never persisted. Evidence photos SHA-256 hashed
on-device before upload. Mock GPS → full block (not a warning). All touch targets ≥ 48×48px. NativeWind
utility classes only — no `StyleSheet.create` for layout. Roboto Mono on `dbh_cm` and height values.
Badge strings exactly match fixed labels.

**Scale/Scope**: 6 screens (stubs exist), 4 async Redux thunks, 2 hooks (stubs exist), 2 Kotlin files
(new), 1 TypeScript bridge (update existing), 1 pending-upload service (new), 3 API endpoints, 0 new npm
packages.



## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

Verify ALL of the following before proceeding:

- [x] **Scope** (Principle I): This feature is frontend-only React Native + Kotlin.
      No Python, FastAPI, Celery, Solidity, or GEE code is written here.
      Kotlin code is limited to native bridge (ARModule.kt, ARPackage.kt) required
      for ARCore Depth API — unavailable from JS. Three API contracts verified
      against BSDD §5.4 and SRS §8: `GET /api/v1/audit/zones`,
      `POST /api/v1/audit/submit-samples`, `GET /api/v1/audit/result/{audit_id}`.
      See `contracts/api-contracts.md`.
- [x] **Security** (Principle II): Private key stays in Keychain only — no private
      key operations in this feature. Aadhaar: not in scope for AR audit module.
      Evidence photos: SHA-256 hash computed on-device via `react-native-quick-crypto`
      BEFORE any MMKV write or API call. Both `evidence_photo_base64` and
      `evidence_photo_hash` sent together (FR-039). Mock GPS: `checkMockLocation()`
      is called before every audit start; returns `true` → full blocking screen,
      audit CANNOT proceed (FR-012, SRS §15). This is a BLOCK, not a warning.
      Rooted device: warning banner only via `react-native-device-info` — does NOT
      block audit (FR-013, constitution Principle II). `.env` in `.gitignore` (from
      feature 001). No `SUPABASE_SERVICE_KEY` in app.
- [x] **Offline-first** (Principle III): All AR measurements, GPS navigation,
      on-device TFLite species identification, and tree saves operate without
      internet after zones are downloaded (SC-006). Each tree saved individually
      to Redux + MMKV immediately on "Confirm and Save Tree" tap — never batched
      (FR-034, FR-048). `audit.scannedTrees` survives crash/battery death (SC-002).
      Offline submit → `pending_upload` MMKV key → `react-native-background-fetch`
      retries on connectivity restore, not on a timer (FR-044, constitution Principle
      III). Google Maps road tiles for ZoneNavigationScreen cached on first load
      (FR-009). `audit.uploadStatus` resets to `'idle'` on every app launch (FR-047).
- [x] **AR Tier integers** (Principle IV): AR tiers are `1 | 2 | 3` everywhere.
      `audit.arTier` typed `1 | 2 | 3` in Redux (already correct in auditSlice.ts).
      API field `ar_tier_used` is integer in SubmitSamplesRequest payload.
      Kotlin `measureCylinder` returns `"tier_used": 1` or `"tier_used": 2` as JSON.
      No A/B/C labels anywhere — code, Redux, API, UI. Badge labels are exactly:
      `"◉ High Precision"` (1), `"◉ Standard Precision"` (2), `"◎ Manual Measurement"` (3).
- [x] **Boundary authority** (Principle V): No farmer-drawn polygon UI.
      `useGeofence` hook reads boundary polygon from Redux `land.parcels[].boundary_geojson`
      (cached from land registration in feature 003 — government-sourced). The AR
      audit module does not modify boundaries. Draw Mode and Walk Mode are absent.
- [x] **Persistence discipline** (Principle VI): `audit.scannedTrees`, `audit.activeAuditId`,
      `audit.currentZoneIndex`, `audit.arTier` persisted to MMKV via redux-persist
      (already in `store/index.ts` — non-blacklisted in auditPersistConfig). ✅
      `audit.uploadStatus` blacklisted (NOT persisted) ✅ — already configured.
      `land.currentDraft` blacklisted ✅ (established in feature 003).
      `audit.scannedTrees` written synchronously after EVERY single tree save —
      MMKV's synchronous API guarantees < 100ms write (SC-007, FR-048).
- [x] **Stitch-first UI** (Principle VII): Stitch MCP must be used to design all
      six screens before any screen implementation begins. NativeWind utility classes
      only — no `StyleSheet.create` for layout. All touch targets ≥ 48×48px (Android
      accessibility). Lottie file names unchanged: `spinning_leaf.json` (loading),
      `scan_success.json` (tree confirmed), `credit_earned.json` (MINTED). Roboto
      Mono on `dbh_cm` (32sp on TreeResultScreen) and `ar_height_m` values.
      Badge strings match exactly — see Principle IV above.

## Project Structure

### Documentation (this feature)

```text
specs/004-ar-tree-scanning/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output — 10 decisions resolved
├── data-model.md        # Phase 1 output — 9 entities/types defined
├── quickstart.md        # Phase 1 output — step-by-step implementation order
├── contracts/
│   └── api-contracts.md # Phase 1 output — 3 API endpoints + 4 native bridge contracts
└── tasks.md             # Phase 2 output (/speckit.tasks command — NOT created here)
```

### Source Code (repository root)

```text
# AR Tree Scanning Module — React Native (Android) + Kotlin native bridge

src/features/ar-audit/
├── screens/
│   ├── AuditStartScreen.tsx         # P1 — land info display, fetchZones, Lottie loading
│   ├── ZoneNavigationScreen.tsx     # P1 — standard map, zone markers, geofence, arrival detection
│   ├── ARCameraScreen.tsx           # P1 — live camera, species ID, diameter measurement
│   ├── ManualMeasureScreen.tsx      # P2 — circumference input, DBH = circumference / π
│   ├── TreeResultScreen.tsx         # P1 — review + save tree (MMKV sync write)
│   └── AuditCompleteScreen.tsx      # P1 — summary + submit + polling + offline queue
└── store/
    └── auditSlice.ts               # Add async thunks: fetchZones, submitAudit, pollResult,
                                    # detectAndSetARTier (slice structure already complete)

src/services/
├── ar-bridge.ts                     # Implement: detectARTier, measureTreeDiameter,
│                                    # isMockLocationEnabled, identifySpecies (new)
└── pendingUploadService.ts          # New: validate + retry pending_upload from MMKV

src/common/
├── hooks/
│   ├── useARTier.ts                 # Implement: check MMKV cache, call detectARTier, dispatch
│   └── useGeofence.ts              # Implement: watchPosition, 30s grace period, zone arrival
└── utils/
    └── hash.ts                      # Implement: hashPhoto(base64) using react-native-quick-crypto

src/types/
└── navigation.ts                    # Add AuditStackParamList with all 6 screen params

index.js                             # Register BackgroundFetch HeadlessTask

android/app/src/main/java/com/terratrustar/ar/
├── ARModule.kt                      # New: checkDepthSupport, measureCylinder (Tier 1 + 2),
│                                    # checkMockLocation, runSpeciesInference (TFLite)
└── ARPackage.kt                     # New: ReactPackage wrapping ARModule

android/app/src/main/java/com/terratrustar/
└── MainApplication.kt              # Modify: add ARPackage() to getPackages()

android/app/
├── build.gradle                     # Modify: add ARCore + TFLite deps (SRS §14.3);
│                                    # add local.properties injection for Maps API key
└── src/main/AndroidManifest.xml    # Modify: add ARCore optional meta-data (FR-056)
```

**Structure Decision**: Single React Native project — Android-only. All native AR code
lives in `android/app/src/main/java/com/terratrustar/ar/` (separate package from MainApplication).
All 6 screen stubs and the auditSlice already exist from feature 001 scaffolding.
The Kotlin bridge is new (ARModule.kt, ARPackage.kt). No new npm packages required —
all dependencies were installed in features 001–003.

## Complexity Tracking

> **No constitution violations.** All gates pass. No justification table needed.
>
> Note: Kotlin native code is present in this feature. This is explicitly required by
> the constitution ("React Native CLI — NOT Expo — because ARCore Depth API requires
> native bridge") and does not constitute a scope violation. The Kotlin code is
> strictly limited to the native bridge that makes ARCore accessible from JavaScript.

