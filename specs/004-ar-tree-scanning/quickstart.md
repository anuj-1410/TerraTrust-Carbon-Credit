# Quickstart: AR Tree Scanning Module (004)

**Generated**: 2026-03-26

This is the implementation guide for developers picking up this feature.
Read this before opening any screen file.

---

## What This Feature Builds

6 screens + 1 Redux slice (already scaffolded) + Kotlin native bridge (ARModule.kt)
+ TypeScript AR bridge + useGeofence/useARTier hooks + background-fetch handler.

This is the core data-collection module of the TerraTrust-AR app. A farmer uses it
to walk to satellite-identified zones and scan trees with AR to measure diameter,
identify species, and submit evidence for carbon credit calculation.

---

## Implementation Order (Dependency-Driven)

Build in this exact order. Each step unblocks the next:

### Step 1: Kotlin Native Bridge (ARModule.kt)
**Why first**: Every AR audit screen depends on the native bridge. Without it,
Tier 1/2 measurements are completely non-functional.

Files to modify:
- `android/app/src/main/java/com/terratrustar/ar/ARModule.kt`
- `android/app/src/main/java/com/terratrustar/ar/ARPackage.kt`
- `android/app/src/main/java/com/terratrustar/MainApplication.kt`
- `android/app/build.gradle` (add ARCore + TFLite deps per SRS §14.3)
- `android/app/src/main/AndroidManifest.xml` (add ARCore optional tags)

What to implement:
1. `checkDepthSupport(promise)` — resolves to `"FULL_DEPTH"`, `"SLAM_ONLY"`, or `"UNSUPPORTED"`.
   Never rejects. Catches all exceptions and resolves `"UNSUPPORTED"`.
2. `measureCylinder(promise)` — Tier 1: RAW_DEPTH_ONLY depth config + RANSAC 100 iterations.
   Tier 2: SLAM 5-second accumulation window + same RANSAC. Returns JSON string
   `{ diameter_cm, confidence, tier_used, point_count }`. Rejects if confidence < 0.7
   or point_count < 50.
3. `checkMockLocation(promise)` — reads `Settings.Secure.ALLOW_MOCK_LOCATION`, resolves bool.
4. `runSpeciesInference(imageBase64, promise)` (new) — loads `species_model.tflite` once
   in `init {}` block. Preprocesses base64 → 224×224 float[1][224][224][3]. Returns JSON
   string `{ species, confidence, all_scores }`.

Kotlin constructor init pattern:
```kotlin
private val tfliteInterpreter: Interpreter by lazy {
  val modelBuffer = loadModelFromAssets(reactContext, "species_model.tflite")
  Interpreter(modelBuffer, Interpreter.Options().apply { numThreads = 4 })
}
```

### Step 2: TypeScript AR Bridge (`src/services/ar-bridge.ts`)
**Why second**: Used by hooks, Redux thunks, and screens. Must be correct before
any screen implementation.

Exports (per SRS §14.6 + research D-002):
- `detectARTier(): Promise<1 | 2 | 3>` — calls `checkDepthSupport`, maps to integer
- `measureTreeDiameter(): Promise<ARMeasurementResult>` — calls `measureCylinder`, parses JSON
- `isMockLocationEnabled(): Promise<boolean>` — calls `checkMockLocation`
- `identifySpecies(imageBase64: string): Promise<SpeciesInferenceResult>` — calls `runSpeciesInference`

Interfaces to define: `ARMeasurementResult`, `SpeciesInferenceResult`

### Step 3: Redux Thunks in auditSlice (async actions)
**Why third**: Screens call thunks; thunks call the bridge and the API.

Add async thunks to `src/features/ar-audit/store/auditSlice.ts`:
- `fetchZones(landId)` — calls `GET /api/v1/audit/zones`
- `submitAudit()` — computes SHA-256 hashes, calls `POST /api/v1/audit/submit-samples`
- `pollAuditResult(auditId)` — 5-second interval polling of `GET /api/v1/audit/result/{id}`
- `detectAndSetARTier()` — calls `detectARTier()` from ar-bridge, dispatches `setArTier`

### Step 4: useARTier Hook (`src/common/hooks/useARTier.ts`)
**Why fourth**: Called at app startup (before any audit screen). Depends on Step 2.

Logic:
1. On mount: check if `audit.arTier` is already set in Redux (restored from MMKV).
2. If set: skip native call (avoids redundant ARCore session).
3. If not set: call `detectARTier()` from ar-bridge, dispatch `setArTier(tier)`.

### Step 5: useGeofence Hook (`src/common/hooks/useGeofence.ts`)
**Why fifth**: ZoneNavigationScreen depends on it. Standalone, no AR dependencies.

Logic (per research D-001):
- `watchPosition` with `{ enableHighAccuracy: true, distanceFilter: 1, interval: 3000 }`
- Cache `lastGoodPosition` when `accuracy ≤ 15m`; timestamp it
- Grace period: 30 seconds — use last good position within window
- Returns `{ isInsideBoundary: boolean, isAtZoneCentre: boolean, currentPosition: GPS | null }`
- Boundary check: point-in-polygon test against `land.parcels[].boundary_geojson`
- Zone centre check: haversine distance ≤ `zone.radius_metres` (typically 10m threshold from FR-006)

> IMPORTANT: FR-006 specifies 10-metre zone arrival threshold.
> `zone.radius_metres` (7/9/11) defines scan area; zone *arrival* check is fixed at 10m.

### Step 6: AuditStartScreen
**Depends on**: Step 3 (`fetchZones` thunk), navigation types

Key requirements:
- Display: land name, area in acres, last audit year, estimated walking distance
- Lottie `spinning_leaf.json` during `fetchZones` call
- On success: navigate to ZoneNavigation with stored zones

### Step 7: ZoneNavigationScreen
**Depends on**: Steps 4, 5, Step 6

Key requirements:
- `mapType="standard"` (Google Maps road map) — NEVER satellite tiles
- Blue dot: farmer GPS; green circle: current zone; grey circles: completed zones
- Dotted walking path between zone centres
- Geofence hook drives: orange warning banner (outside boundary) + scan button state
- Zone arrival: button turns green, text changes, haptic fires (`react-native-haptic-feedback`)
- Map tiles cached on first load (FR-009)

### Step 8: ARCameraScreen
**Depends on**: Steps 1–5

Key requirements:
- Full-screen `react-native-vision-camera` v4 preview + white crosshair reticle
- "Identify Species" → `camera.takeSnapshot()` → `identifySpecies(base64)` → overlay
- "Measure Diameter" → Tier 1: 3s progress ring; Tier 2: 5s left-right animation; Tier 3: navigate to ManualMeasure
- Evidence photo auto-capture at diameter lock (NOT manual)
- `"X/Y trees scanned"` counter top-right (from `audit.scannedTrees.length` vs `min_trees_required`)
- Bottom sheet shows measurement result + species overlay
- After 3 consecutive failures → auto-navigate to ManualMeasureScreen

### Step 9: ManualMeasureScreen
**Depends on**: Step 8 (navigation param)

Key requirements:
- Tutorial animation (string-wrapping demo) on first session display
- Input: circumference in cm
- Compute: `dbh_cm = Math.round((circumference / Math.PI) * 10) / 10`
- Display: `"Diameter: X cm (calculated from Y cm circumference)"`
- "Confirm" → navigate back to ARCameraScreen with diameter param
- "Manual Measurement" badge (grey `"◎ Manual Measurement"`)
- Validates: non-numeric or empty → inline error; no navigate allowed

### Step 10: TreeResultScreen
**Depends on**: Steps 7–9 (Redux state populated)

Key requirements:
- Roboto Mono 32sp for `dbh_cm`
- Height: `"From GEDI Satellite"` or `"AR Measured: X m"`
- Precision badge: `"◉ High Precision"` (Tier 1), `"◉ Standard Precision"` (Tier 2), `"◎ Manual Measurement"` (Tier 3)
- GPS formatted: `"18.5460°N, 73.9820°E"` (4 decimal places)
- Evidence photo thumbnail
- "Confirm and Save Tree" → `dispatch(addScannedTree(...))` → MMKV write sync
- Auto-generate `tree_id` with `uuid()` (uuid v4) before saving
- "Rescan This Tree" → back to ARCameraScreen, no save
- Zone minimum prompt when 3rd tree saved

### Step 11: AuditCompleteScreen
**Depends on**: Step 10, API contracts

Key requirements:
- Show: total trees, zones completed, preliminary carbon estimate (labelled "Estimated")
- SHA-256 each `evidence_photo_base64` via `react-native-quick-crypto` BEFORE submit
- Call `submitAudit()` thunk → poll with `pollAuditResult()` every 5 seconds
- MINTED → navigate to HomeScreen + play `credit_earned.json`
- FAILED → show error + retry button
- No internet → save `pending_upload` to MMKV (do NOT crash)

### Step 12: Background Fetch Handler + Pending Upload Service
**Depends on**: Step 11

Key requirements:
- New file: `src/services/pendingUploadService.ts` — reads, validates, retries `pending_upload` from MMKV
- Configure BackgroundFetch in `App.tsx` (see research D-003):
  `requiredNetworkType: BackgroundFetch.NETWORK_TYPE_ANY, stopOnTerminate: false,`
  `startOnBoot: true, enableHeadless: true`
- Register HeadlessTask in `index.js` (app root) via `BackgroundFetch.registerHeadlessTask`
- Corrupted payload: delete key → finish task → do not retry
- Still offline: leave key → finish task → let next trigger retry

### Step 13: Navigation Types
**Can be done alongside Step 6**

Add to `src/types/navigation.ts`:
```typescript
export type AuditStackParamList = {
  AuditStart:    { landId: string; landName: string };
  ZoneNavigation:{ auditId: string; landId: string };
  ARCamera:      { zoneId: string; zoneIndex: number };
  ManualMeasure: { returnDiameter?: number };
  TreeResult:    undefined;
  AuditComplete: undefined;
};
```

---

## New Files to Create

| File | Purpose |
|------|---------|
| `android/app/src/main/java/com/terratrustar/ar/ARModule.kt` | Kotlin native bridge |
| `android/app/src/main/java/com/terratrustar/ar/ARPackage.kt` | ReactPackage registration |
| `src/services/pendingUploadService.ts` | Offline retry logic |

## Existing Files to Modify (not create)

| File | What changes |
|------|-------------|
| `src/services/ar-bridge.ts` | Add `identifySpecies()`, implement all 3 existing exports |
| `src/features/ar-audit/store/auditSlice.ts` | Add async thunks |
| `src/common/hooks/useARTier.ts` | Implement (currently stub) |
| `src/common/hooks/useGeofence.ts` | Implement (currently stub) |
| `src/features/ar-audit/screens/*.tsx` | Replace all 6 stubs with full implementations |
| `src/types/navigation.ts` | Add `AuditStackParamList` |
| `src/common/utils/hash.ts` | Implement `hashPhoto` using `react-native-quick-crypto` |
| `android/app/build.gradle` | Add ARCore + TFLite deps (SRS §14.3) |
| `android/app/src/main/AndroidManifest.xml` | Add ARCore optional tags (FR-056) |
| `android/app/src/main/java/com/terratrustar/MainApplication.kt` | Add `ARPackage()` |
| `index.js` | Register BackgroundFetch HeadlessTask |

---

## No New npm Packages Required

All required packages were installed in prior features (001–003):
- `react-native-vision-camera` v4 ✓
- `react-native-maps` ✓
- `react-native-geolocation-service` ✓
- `react-native-haptic-feedback` ✓
- `react-native-quick-crypto` ✓
- `react-native-background-fetch` ✓
- `react-native-device-info` ✓
- `react-native-reanimated` ✓
- `lottie-react-native` ✓
- `uuid` ✓
- `redux-toolkit` + `redux-persist` + `mmkv` ✓

---

## Critical Constraints (Violations Block Merge)

| Constraint | What to check |
|-----------|--------------|
| AR tiers are integers 1/2/3 | No A/B/C anywhere — code, Redux, API payload, UI |
| `arTier` field typed `1 \| 2 \| 3` | TypeScript strict |
| `ar_tier_used` in API payload is integer | Check JSON.stringify output |
| `evidence_photo_hash` computed BEFORE upload | SHA-256 before API call |
| `audit.uploadStatus` NOT in MMKV | blacklist in `store/index.ts` already set |
| `audit.scannedTrees` written to MMKV after EVERY single tree | Not batched |
| Mock GPS → full block | Not a warning banner — full blocking screen |
| Rooted device → warning only | Do NOT block audit |
| mapType="standard" on ZoneNavigationScreen | Never satellite tiles |
| Private key: Keychain only | Never Redux, MMKV, logs |
| NativeWind only — no StyleSheet.create for layout | Screen-level layouts |
| Roboto Mono on DBH cm + height m values | Not on labels |
| Badge strings exactly match fixed labels | `"◉ High Precision"` etc. |
| Stitch MCP before any screen code | See constitution Principle VII |

---

## Testing Notes

**Can test without real device** (emulator OK):
- auditSlice reducer unit tests (addScannedTree, setArTier, MMKV persistence)
- `hashPhoto()` output matches expected SHA-256
- ManualMeasureScreen DBH calculation (`circumference / π`)
- PendingUpload payload validation logic
- Navigation type safety (TypeScript compile check)
- AuditStartScreen with mocked API response

**Requires real Android device**:
- ARModule.checkDepthSupport() (needs ARCore)
- ARModule.measureCylinder() (needs ToF sensor or SLAM surface tracking)
- ARModule.runSpeciesInference() (needs camera + TFLite)
- ZoneNavigationScreen GPS dot and arrival detection
- react-native-background-fetch connectivity trigger
- VisionCamera live preview

**Tier availability by device**:
- Tier 1: ToF sensor phones (Pixel 6+, Samsung S21 Ultra+, select mid-range)
- Tier 2: Any ARCore-supported Android phone
- Tier 3: All Android phones (universal fallback)
