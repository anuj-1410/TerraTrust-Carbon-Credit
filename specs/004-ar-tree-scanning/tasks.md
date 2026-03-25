# Tasks: AR Tree Scanning Module

**Input**: Design documents from `/specs/004-ar-tree-scanning/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/api-contracts.md ✅, quickstart.md ✅

**Tests**: Unit tests for `hashPhoto()`, `auditSlice` thunks, ManualMeasureScreen DBH formula, and `pendingUploadService` validation included per plan.md §Testing. Integration test for AuditStartScreen with mocked API included.

**Organization**: Tasks are grouped by user story (US1 [P1], US2 [P1], US3 [P2], US4 [P1], US5 [P1]) to enable independent implementation and testing of each story. US5 (Kotlin bridge) is built first because it is the hard runtime prerequisite for US1–US4.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files / no blocking dependency)
- **[US\*]**: Which user story this task belongs to

---

## Phase 1: Setup

**Purpose**: Android build config, navigation types, and utility functions — all standalone, no inter-module dependencies.

- [x] T001 [P] Add ARCore and TFLite dependencies to `android/app/build.gradle` per SRS §14.3: `implementation 'com.google.ar:core:1.42.0'`, `implementation 'org.tensorflow:tensorflow-lite:2.14.0'`, `implementation 'org.tensorflow:tensorflow-lite-support:0.4.4'`; add `local.properties` reader block and `manifestPlaceholders = [GOOGLE_MAPS_API_KEY: ...]` inside `defaultConfig {}` per SRS §14.3 in `android/app/build.gradle`
- [x] T002 [P] Add ARCore optional meta-data tags to `android/app/src/main/AndroidManifest.xml` per FR-056: `<uses-feature android:name="android.hardware.camera.ar" android:required="false"/>` and `<meta-data android:name="com.google.ar.core" android:value="optional"/>` inside `<application>`
- [x] T003 [P] Add `AuditStackParamList` to `src/types/navigation.ts` per research D-010: `AuditStart: { landId: string; landName: string }`, `ZoneNavigation: { auditId: string; landId: string }`, `ARCamera: { zoneId: string; zoneIndex: number }`, `ManualMeasure: { returnDiameter?: number }`, `TreeResult: undefined`, `AuditComplete: undefined`
- [x] T004 [P] Implement `hashPhoto(base64: string): string` in `src/common/utils/hash.ts` using `react-native-quick-crypto` (`createHash('sha256').update(base64).digest('hex')`) per SRS §15; add Jest unit test asserting SHA-256 output is a 64-character hex string for a known base64 input in `src/common/utils/__tests__/hash.test.ts`

**Checkpoint**: `npx tsc --noEmit` passes; `android/app/build.gradle` compiles with Gradle; navigation types include all 6 audit screen entries.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: TypeScript AR bridge, Redux async thunks, and custom hooks — all screen implementations depend on these. `ar-bridge.ts` compiles against `NativeModules.ARModule` (runtime binding; TypeScript does not require the Kotlin module to compile).

**⚠️ CRITICAL**: No audit screen can be wired up until this phase is complete.

- [x] T005 Implement `src/services/ar-bridge.ts` — define `ARMeasurementResult` interface (`diameter_cm: number`, `confidence: number`, `tier_used: 1 | 2`, `point_count: number`) and `SpeciesInferenceResult` interface (`species: string`, `confidence: number`, `all_scores: number[]`); implement `detectARTier(): Promise<1 | 2 | 3>`, `measureTreeDiameter(): Promise<ARMeasurementResult>`, `isMockLocationEnabled(): Promise<boolean>`, and `identifySpecies(imageBase64: string): Promise<SpeciesInferenceResult>` calling `NativeModules.ARModule` per SRS §14.6 and research D-002
- [x] T006 Add `fetchZones` and `detectAndSetARTier` async thunks to `src/features/ar-audit/store/auditSlice.ts` — `fetchZones(landId: string)`: calls `GET /api/v1/audit/zones?land_id={landId}` via `api.ts`, dispatches `startAudit({ auditId, landId })` + `setZones(zones.map(z => ({ ...z, trees_scanned: 0, is_complete: false })))` on success, handles 401/404/500 with plain-language error (FR-002, FR-003); `detectAndSetARTier()`: calls `detectARTier()` from ar-bridge, dispatches `setArTier(tier)` (FR-010)
- [x] T007 Add `submitAudit` and `pollAuditResult` async thunks to `src/features/ar-audit/store/auditSlice.ts` — `submitAudit()`: reads `audit.scannedTrees` + `audit.activeAuditId` + `audit.activeLandId` from Redux, maps each tree to `SubmitSamplesRequest` payload (`ar_tier_used` as integer 1/2/3), dispatches `setUploadStatus('uploading')`, calls `POST /api/v1/audit/submit-samples`, dispatches `setUploadStatus('processing')` on 202, saves full payload to MMKV `'pending_upload'` key if offline (FR-044); `pollAuditResult(auditId)`: calls `GET /api/v1/audit/result/{auditId}` every 5 seconds until status is not `"CALCULATING"`, dispatches `setUploadStatus('success')` on MINTED or `setUploadStatus('error')` on FAILED (FR-041, FR-042, FR-043, contracts/api-contracts.md Contract 3)
- [x] T008 [P] Implement `useARTier` hook in `src/common/hooks/useARTier.ts` — on mount: read `audit.arTier` from Redux (`useAppSelector`); if already set (restored from MMKV) skip native call and return early; if not set (arTier default = 3 from `auditInitialState`) dispatch `detectAndSetARTier()` thunk; never calls `NativeModules.ARModule` twice per device per launch (FR-060, FR-061)
- [x] T009 [P] Implement `useGeofence` hook in `src/common/hooks/useGeofence.ts` — `watchPosition({ enableHighAccuracy: true, distanceFilter: 1, interval: 3000 })`; cache `lastGoodPosition` when `position.coords.accuracy ≤ 15`; use cached position for up to 30 seconds if accuracy degrades (research D-001, spec Edge Cases); return `{ isInsideBoundary: boolean; isAtZoneCentre: boolean; currentPosition: GPS | null }`; boundary check = point-in-polygon haversine against `land.parcels[activeLandId].boundary_geojson` from Redux; zone centre check = haversine distance to `zones[currentZoneIndex].centre_gps ≤ 10` metres (FR-057, FR-058, FR-059, FR-006, FR-007, FR-008)

**Checkpoint**: `npx tsc --noEmit` passes; `ar-bridge.ts` exports compile; auditSlice has all 4 thunks; hooks are type-safe; no screen code written yet.

---

## Phase 3: User Story 5 — Kotlin AR Bridge (Priority: P1)

**Goal**: The native `ARModule` is registered and accessible via `NativeModules.ARModule` from JavaScript. `checkDepthSupport`, `measureCylinder`, and `checkMockLocation` all resolve correctly. Species inference runs on the on-device TFLite model.

**Independent Test**: Call `NativeModules.ARModule.checkDepthSupport()` from a temporary test screen; verify it resolves to one of `"FULL_DEPTH"`, `"SLAM_ONLY"`, `"UNSUPPORTED"` without throwing. Call `checkMockLocation()` and toggle mock location in Android Developer Settings to verify true/false. Call `measureCylinder()` aimed at a tree trunk and verify the result JSON contains `diameter_cm`, `confidence`, `tier_used`, `point_count`.

- [x] T010 [US5] Create `android/app/src/main/java/com/terratrustar/ar/ARPackage.kt` implementing `ReactPackage` returning `listOf(ARModule(reactContext))` from `createNativeModules` and `emptyList<ViewManager<*,*>>()` from `createViewManagers` (SRS §14.5); register `ARPackage()` in `getPackages()` in `android/app/src/main/java/com/terratrustar/MainApplication.kt` (FR-053, FR-054); create `ARModule.kt` scaffold with `class ARModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext)` and `override fun getName() = "ARModule"` in `android/app/src/main/java/com/terratrustar/ar/ARModule.kt`
- [x] T011 [US5] Implement `checkDepthSupport(promise: Promise)` in `ARModule.kt` — call `ArCoreApk.getInstance().checkAvailability(reactContext)`; if `UNSUPPORTED` resolve `"UNSUPPORTED"` and return; otherwise open `Session(reactContext)`, call `session.isDepthModeSupported(Config.DepthMode.RAW_DEPTH_ONLY)`, close session, resolve `"FULL_DEPTH"` if true or `"SLAM_ONLY"` if false; wrap entire method in try/catch resolving `"UNSUPPORTED"` on any exception — never rejects (FR-049, FR-050, SRS §14.4); implement `checkMockLocation(promise: Promise)` — read `Settings.Secure.getInt(reactContext.contentResolver, Settings.Secure.ALLOW_MOCK_LOCATION, 0) == 1`, resolve boolean (FR-052, SRS §14.4)
- [x] T012 [US5] Implement `measureCylinder(promise: Promise)` for Tier 1 (RAW_DEPTH_ONLY) in `ARModule.kt` — configure `arCoreSession` with `Config.DepthMode.RAW_DEPTH_ONLY`; acquire `frame.acquireRawDepthImage16Bits()`; filter to centre 30% width × 60% height of frame; convert depth pixels to 3D world coordinates using camera intrinsics (focal length + principal point); run RANSAC cylinder fitting for minimum 100 iterations (select 2 axis points + 1 radius point; count inliers within epsilon); `confidence = best_inlier_count / total_point_count`; if `confidence < 0.7` or `point_count < 50` reject promise with user-facing message; resolve JSON string `{ "diameter_cm": ..., "confidence": ..., "tier_used": 1, "point_count": ... }` (FR-051, FR-049, SRS §14.4)
- [x] T013 [US5] Implement `measureCylinder(promise: Promise)` Tier 2 SLAM path in `ARModule.kt` — when depth mode is not RAW_DEPTH_ONLY available, switch to SLAM mode; accumulate ARCore depth frames on a `HandlerThread` for exactly 5 seconds (research D-007, spec US2 acceptance scenario 4); after 5 seconds run the same RANSAC cylinder fitting algorithm on the accumulated point cloud; resolve JSON with `"tier_used": 2`; same confidence/point-count rejection thresholds apply (FR-049, FR-051)
- [x] T014 [US5] Implement `runSpeciesInference(imageBase64: String, promise: Promise)` in `ARModule.kt` — lazy-init `tfliteInterpreter: Interpreter` from `context.assets.open("species_model.tflite")` with `numThreads = 4` (research D-006); decode base64 → Bitmap; scale to 224×224; convert to `Array(1){ Array(224){ Array(224){ FloatArray(3) } } }` normalized to [-1, 1]; run `tfliteInterpreter.run(input, output)` where output is `Array(1){ FloatArray(11) }`; find top-1 index in output; look up species name from ordered APPROVED_SPECIES list; resolve JSON string `{ "species": ..., "confidence": ..., "all_scores": [...] }` (FR-017, research D-002, data-model.md SpeciesInferenceResult)

**Checkpoint**: App builds and installs on real device. `NativeModules.ARModule` is defined from JavaScript. All 4 `@ReactMethod` functions resolve without uncaught exceptions on the happy path.

---

## Phase 4: User Story 1 — Start Audit and Navigate to Zones (Priority: P1) 🎯 MVP

**Goal**: Farmer starts an audit from the HomeScreen, sees their land info on AuditStartScreen, triggers zone generation, and uses the Google Maps road map to walk to the first zone. GPS arrival detection locks/unlocks the scan button.

**Independent Test**: Render `AuditStartScreen` with mocked `GET /api/v1/audit/zones` returning 3 zones. Verify: land name, area, last audit year, estimated walking distance display. Verify `spinning_leaf.json` Lottie plays during call. Verify navigation to `ZoneNavigationScreen` on success. On `ZoneNavigationScreen`, mock GPS at `< 10m` from zone centre — verify button turns green, text changes, haptic fires. Mock GPS outside land boundary — verify orange banner appears.

- [x] T015 [US1] Generate `AuditStartScreen` design via Stitch MCP — call `generate_screen_from_text` with the AuditStartScreen spec (land name, area in acres, last audit year, estimated walking distance, "Start Audit" CTA, rooted device warning banner slot), then call `get_screen` on the result to retrieve screen details and download URL, then fetch the HTML/CSS from the download URL
- [x] T016 [US1] Implement `AuditStartScreen.tsx` from Stitch HTML/CSS in `src/features/ar-audit/screens/AuditStartScreen.tsx` — read `landId` + `landName` from nav params; read land parcel data from `land.parcels` (Redux MMKV); display land name, area in acres (`hectaresToAcres()` from `units.ts`, Roboto Mono), last audit year or `"No audit yet"`, estimated walking distance from `audit.zones`; on "Start Audit" tap call `isMockLocationEnabled()` from ar-bridge — if `true` show full blocking screen `"Please disable Mock Location in Developer Settings to use this app."` (FR-012, SRS §15); if `false` dispatch `fetchZones(landId)` thunk displaying `spinning_leaf.json` Lottie during loading; on thunk success navigate to `ZoneNavigation` screen; on error show plain-language retry message (FR-001, FR-002, FR-003)
- [x] T017 [US1] Generate `ZoneNavigationScreen` design via Stitch MCP — call `generate_screen_from_text` with ZoneNavigationScreen spec (standard Google Maps road map, zone circle markers, walking path polyline, farmer GPS dot, scan button with locked/unlocked states, orange geofence warning banner, zone progress indicator), then call `get_screen`, then fetch HTML/CSS
- [x] T018 [US1] Implement `ZoneNavigationScreen.tsx` from Stitch HTML/CSS in `src/features/ar-audit/screens/ZoneNavigationScreen.tsx` — `<MapView mapType="standard">` (NEVER satellite) with `cacheEnabled={true}` + `loadingEnabled={true}` for offline tile caching (FR-004, FR-009); render farmer GPS as `<Marker>` blue dot; render `zones[currentZoneIndex]` as green `<Circle>` labelled with zone label; render completed zones as grey unlabelled `<Circle>`; render `<Polyline strokePattern={[{dot:true}]}` connecting all zone centres (FR-005); wire `useGeofence` hook — when `isAtZoneCentre` becomes true: set button green, text `"You're here — Start Scanning"`, fire `ReactNativeHapticFeedback.trigger('impactMedium')` (FR-006); when `isInsideBoundary` is false: show orange warning banner `"You appear to be outside your registered land boundary. Please return to your land to scan."` + disable scan button (FR-008); "Start Scanning" navigates to `ARCamera` with `{ zoneId, zoneIndex }` (FR-004, FR-005, FR-006, FR-007, FR-008); add Jest integration test for AuditStartScreen with mocked API response verifying Lottie + navigation in `src/features/ar-audit/screens/__tests__/AuditStartScreen.test.tsx`

**Checkpoint**: Farmer can tap "Start Audit" from HomeScreen, see their land info, trigger zone generation, view zone markers on a road map, and have the scan button react to GPS arrival at the zone centre. Mock GPS detection blocks audit start completely.

---

## Phase 5: User Story 2 — AR Diameter Measurement: Tier 1 and Tier 2 (Priority: P1)

**Goal**: Farmer opens the camera screen in a zone, identifies the tree species using on-device TFLite inference, measures trunk diameter via ARCore (Tier 1: still-hold 3s; Tier 2: left-right 5s), and sees the result in a bottom sheet with appropriate precision badge. Confidence < 0.7 or unusual DBH triggers retry prompts, not saves.

**Independent Test**: Run `ARCameraScreen` on a supported real device. Tap "Identify Species" — verify species overlay appears with name + confidence or dropdown for low confidence. Tap "Measure Diameter" — verify Tier 1/2 detection runs correctly, 3s ring / 5s animation shows, bottom sheet appears with `diameter_cm` and correct badge. Verify tree counter updates. Verify 3 consecutive failures auto-navigate to ManualMeasureScreen.

- [x] T019 [US2] Generate `ARCameraScreen` design via Stitch MCP — call `generate_screen_from_text` with ARCameraScreen spec (full-screen camera, white crosshair reticle, status text at top, "Identify Species" / "Measure Diameter" / "Measure Height" action buttons, green wireframe cylinder overlay, species overlay card, measurement bottom sheet, tree counter top-right, scan_success Lottie overlay), then call `get_screen`, then fetch HTML/CSS
- [x] T020 [US2] Implement `ARCameraScreen.tsx` camera + species identification path from Stitch HTML/CSS in `src/features/ar-audit/screens/ARCameraScreen.tsx` — `<Camera>` full-screen from `react-native-vision-camera` v4 with white SVG crosshair reticle; status text cycling `"Point camera at tree trunk" → "Trunk detected" → "Measuring..." → "Measurement complete"` (FR-014, FR-015); tree scan counter `"X/Y trees scanned"` top-right from `audit.scannedTrees.filter(t => t.zone_id === currentZoneId).length` vs `zones[currentZoneIndex].trees_scanned` / `minTreesRequired` (FR-025); "Identify Species" tap: `camera.takeSnapshot()` → `identifySpecies(base64)` → if `confidence ≥ 0.60` show species name + confidence overlay (FR-017); if `confidence < 0.60` show approved-species dropdown (11 species from `common/constants/species.ts`) (FR-017); if species not in approved list show `"This species is not eligible for carbon credits. Please scan a different tree."` and block saving (FR-018); auto-look-up `wood_density` from species constants on acceptance (FR-019); show "Measure Height" button only when `zones[currentZoneIndex].gedi_available === false` (FR-024)
- [x] T021 [US2] Implement `ARCameraScreen.tsx` diameter measurement + evidence photo path in `src/features/ar-audit/screens/ARCameraScreen.tsx` — Tier 1: `"Measure Diameter"` tap starts 3-second animated progress ring (Reanimated), waits still, calls `measureTreeDiameter()` from ar-bridge (FR-020); Tier 2: shows 5-second left-right arrow motion guide (Reanimated `useAnimatedStyle`), calls `measureTreeDiameter()` (FR-020); Tier 3: navigates to `ManualMeasure` (FR-023); on success: `confidence < 0.7` or `fit_error > 5%` → show `"Move closer to the tree and hold still, then try again."` retry prompt — do NOT save (FR-021); `diameter_cm < 5 || > 200` → show `"This seems unusual. Please measure again."` — do NOT save (FR-022); on valid result: auto-capture evidence photo via `camera.takeSnapshot()` → compute `hashPhoto(base64)` from `utils/hash.ts` (research D-008); fire `ReactNativeHapticFeedback.trigger('impactMedium')` (FR-026); show measurement bottom sheet; track consecutive failures — after 3 failures auto-navigate to `ManualMeasure` (FR-027); on measurement confirmed navigate to `TreeResult`

**Checkpoint**: Full diameter measurement pipeline works on a real ARCore device for both Tier 1 and Tier 2. Species identity and evidence photo are captured at lock time. Retry prompts show instead of saving bad measurements.

---

## Phase 6: User Story 3 — Manual Measurement: Tier 3 (Priority: P2)

**Goal**: Farmer on a non-ARCore phone, or after 3 failures, enters trunk circumference by hand. App computes DBH = circumference / π and returns the result to ARCameraScreen for confirmation with a grey "Manual Measurement" badge.

**Independent Test**: Render `ManualMeasureScreen` standalone with `{ returnDiameter: undefined }` nav param. Verify tutorial animation plays. Enter `"62.8"` → tap "Calculate Diameter" → verify `"Diameter: 20.0 cm (calculated from 62.8 cm circumference)"`. Enter empty string → verify button inactive or inline validation error. Tap "Confirm" → verify navigation back with `returnDiameter = 20.0`. Verify `"◎ Manual Measurement"` badge is set.

- [x] T022 [US3] Generate `ManualMeasureScreen` design via Stitch MCP — call `generate_screen_from_text` with ManualMeasureScreen spec (tutorial animation slot at top, circumference input field in cm, "Calculate Diameter" button, result display, "Confirm" / "Back" buttons, "◎ Manual Measurement" grey badge), then call `get_screen`, then fetch HTML/CSS
- [x] T023 [US3] Implement `ManualMeasureScreen.tsx` from Stitch HTML/CSS in `src/features/ar-audit/screens/ManualMeasureScreen.tsx` — use `useRef<boolean>` to track first-session display; on first render play tutorial string-wrapping animation (Lottie or Reanimated sequence) before showing input (FR-028); use Zod + React Hook Form for circumference input in cm with validation `z.string().regex(/^\d+(\.\d+)?$/).transform(Number).refine(n => n > 0)` (FR-031); on valid submission compute `dbh_cm = Math.round((circumference / Math.PI) * 10) / 10` and display `"Diameter: ${dbh_cm} cm (calculated from ${circumference} cm circumference)"` (FR-029); "Confirm" navigates back to `ARCamera` screen with `returnDiameter: dbh_cm` — sets grey `"◎ Manual Measurement"` badge in ARCameraScreen (FR-030); "Back" navigates without saving; add Jest unit test asserting `Math.round((62.8 / Math.PI) * 10) / 10 === 20.0` in `src/features/ar-audit/screens/__tests__/ManualMeasureScreen.test.ts`

**Checkpoint**: Farmer can enter circumference, see the computed diameter, and return to ARCameraScreen with the result pre-filled. DBH formula is correct. Input validation blocks non-numeric entry.

---

## Phase 7: User Story 4 — Save Each Tree and Complete the Audit (Priority: P1)

**Goal**: Farmer reviews each scanned tree on TreeResultScreen, saves it to local MMKV storage instantly, completes all zones, and submits via AuditCompleteScreen. Offline submit saves to MMKV pending queue; background fetch retries on reconnect. MINTED result navigates to HomeScreen with Lottie celebration.

**Independent Test**: Inject a mock `TreeSample` into Redux and render `TreeResultScreen` — verify all fields display, `uuid` is generated, MMKV write fires synchronously on "Confirm and Save Tree", zone-minimum prompt appears after 3rd tree save. Render `AuditCompleteScreen` with mocked `POST /submit-samples` → 202 → mocked `GET /result` → MINTED — verify Lottie plays and navigation to HomeScreen. Render with offline failure — verify `pending_upload` MMKV key is written.

- [x] T024 [US4] Generate `TreeResultScreen` design via Stitch MCP — call `generate_screen_from_text` with TreeResultScreen spec (species name, DBH in Roboto Mono 32sp, height source string, precision badge, GPS coordinates formatted to 4dp, evidence photo thumbnail, "Confirm and Save Tree" / "Rescan This Tree" buttons, zone-minimum prompt overlay), then call `get_screen`, then fetch HTML/CSS
- [x] T025 [US4] Implement `TreeResultScreen.tsx` from Stitch HTML/CSS in `src/features/ar-audit/screens/TreeResultScreen.tsx` — read current tree scan state from ARCameraScreen's built measurement (passed via Redux `currentTreeDraft` or navigation state); display: species name, `dbh_cm` formatted to 1dp in Roboto Mono 32sp, height `"From GEDI Satellite"` when `ar_height_m` is null else `"AR Measured: ${ar_height_m} m"`, precision badge exactly `"◉ High Precision"` (Tier 1), `"◉ Standard Precision"` (Tier 2), `"◎ Manual Measurement"` (Tier 3) (FR-033), GPS formatted as `"${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E"` (FR-032), evidence photo `<Image>` thumbnail from base64; "Confirm and Save Tree": generate `tree_id = uuid()` (uuid v4), assemble full `TreeSample` with all fields from data-model.md, dispatch `addScannedTree(treeSample)` (synchronous Redux + MMKV write < 100ms — SC-007, FR-034); after save: if `scannedTrees.filter(t => t.zone_id === currentZoneId).length === 3` show "Move to Next Zone" / "Scan More Trees" prompt (FR-035); "Rescan This Tree": navigate back to ARCamera with no save (FR-036); add Jest unit test asserting uuid v4 format and that `addScannedTree` persists via MMKV in `src/features/ar-audit/screens/__tests__/TreeResultScreen.test.ts`
- [x] T026 [US4] Generate `AuditCompleteScreen` design via Stitch MCP — call `generate_screen_from_text` with AuditCompleteScreen spec (total trees count, zones completed X/Y, preliminary carbon estimate with "Estimated" label, "Submit for Satellite Verification" CTA, processing spinner with Lottie spinning_leaf, credit_earned Lottie overlay on MINTED, error state with retry), then call `get_screen`, then fetch HTML/CSS
- [x] T027 [US4] Implement `AuditCompleteScreen.tsx` from Stitch HTML/CSS in `src/features/ar-audit/screens/AuditCompleteScreen.tsx` — display total trees from `audit.scannedTrees.length`, zones completed from `audit.currentZoneIndex` / `audit.zones.length`, preliminary carbon estimate (read from zones data as an estimate labelled `"Estimated — final number calculated by satellite verification."`) (FR-038); "Submit for Satellite Verification" tap: dispatch `submitAudit()` thunk — thunk computes SHA-256 for each `evidence_photo_base64` via `hashPhoto()` from `utils/hash.ts` BEFORE upload (FR-039); display `spinning_leaf.json` Lottie with `"Calculating your carbon credits using satellite data... This takes about 30-60 seconds."` during processing (FR-040); on `status: 'processing'` dispatch `pollAuditResult(auditId)` which polls every 5 seconds (FR-041); on `status: 'success'` (MINTED): navigate to HomeScreen and play `credit_earned.json` Lottie overlay (FR-042); on `status: 'error'` (FAILED): show API error message + "Try Again" retry button (FR-043); on offline failure: thunk saves `pending_upload` to MMKV — screen shows `"Saved for upload when you're back online."` (FR-044); show multi-day `"Session 1 saved. Return tomorrow for Session 2"` message when `audit.sessionComplete` is true (research D-009)
- [x] T028 [US4] Implement `src/services/pendingUploadService.ts` — export `retryPendingUpload(taskId: string): Promise<void>`: (1) `mmkv.getString('pending_upload')` — if null/undefined finish quietly; (2) `JSON.parse()` — if throws, `mmkv.delete('pending_upload')` and return; (3) validate `typeof payload.audit_id === 'string' && Array.isArray(payload.trees) && payload.trees.length > 0` — if invalid, delete and return; (4) call `api.post('/audit/submit-samples', payload)`; on success (202) `mmkv.delete('pending_upload')`; on 401 delete key (stale auth); on `ENOTFOUND`/no-response leave key intact (still offline — retries next trigger); add Jest unit test covering all 4 validation failure branches in `src/services/__tests__/pendingUploadService.test.ts`
- [x] T029 [US4] Configure `react-native-background-fetch` in `src/app/App.tsx` — call `BackgroundFetch.configure({ minimumFetchInterval: 15, stopOnTerminate: false, startOnBoot: true, enableHeadless: true, requiredNetworkType: BackgroundFetch.NETWORK_TYPE_ANY }, async taskId => { await retryPendingUpload(taskId); BackgroundFetch.finish(taskId); }, async taskId => { BackgroundFetch.finish(taskId); })` inside `useEffect([], [])` at app startup (research D-003, FR-044); register HeadlessTask in `index.js` at repo root via `BackgroundFetch.registerHeadlessTask(async event => { if (event.timeout) { BackgroundFetch.finish(event.taskId); return; } await retryPendingUpload(event.taskId); BackgroundFetch.finish(event.taskId); })` called BEFORE `AppRegistry.registerComponent` (research D-003)

**Checkpoint**: Full end-to-end audit flow works: scan tree → save to MMKV → audit complete → submit → poll → MINTED navigates home with Lottie. Offline submit saves payload and auto-retries on reconnect.

---

## Final Phase: Polish & Cross-Cutting Concerns

**Purpose**: Reliability guards, edge-case handling, and per-spec behaviours that span multiple user stories.

- [x] T030 Add rooted-device warning banner to `AuditStartScreen.tsx` — on mount call `DeviceInfo.isRooted()` from `react-native-device-info`; if true display a persistent amber banner `"This device appears to be rooted. Audit data may be less trusted."` BELOW the screen title but ABOVE the land info card; banner does NOT block the audit — farmer can still proceed (FR-013, constitution Principle II, SRS §15)
- [x] T031 Wire `returnDiameter` param from ManualMeasureScreen back into `ARCameraScreen.tsx` — on `route.params.returnDiameter` present: pre-fill `dbh_cm` with the returned value, show `"◎ Manual Measurement"` grey badge in measurement result area, treat as a completed measurement and enable navigation to TreeResultScreen; this completes the Tier 3 round-trip (FR-030, spec US3 acceptance scenario 4)
- [x] T032 Add zone-minimum prompt logic to `TreeResultScreen.tsx` — after each `addScannedTree` dispatch check if trees saved in current zone equals minimum required per zone (`Math.floor(minTreesRequired / zones.length)`, minimum 3); if minimum reached show modal/bottom sheet offering `"Move to Next Zone"` (dispatch `setCurrentZoneIndex(currentZoneIndex + 1)`, navigate to `ZoneNavigation`) or `"Scan More Trees (up to 5)"` (allow up to 5 per zone — stay on ARCamera); if all zones complete navigate to `AuditComplete` (FR-035, spec US4 acceptance scenario 4)
- [x] T033 [P] Validate GPS grace-period edge cases in `useGeofence.ts` — add guard: if `Date.now() - lastGoodAccuracyTime > 30_000` (grace period expired) set `currentPosition = null` and `isAtZoneCentre = false` so a stale GPS never falsely enables the scan button; add the `gps_accuracy_m` field capture (used in `TreeSample.gps_accuracy_m`) from `position.coords.accuracy` at snapshot time (research D-001, spec Edge Cases, data-model.md TreeSample)
- [x] T034 [P] Add green wireframe cylinder overlay to `ARCameraScreen.tsx` — when `measureTreeDiameter()` is in flight and ARCore has detected a trunk candidate surface (confidence ≥ 0.4 interim feedback), render a green SVG cylinder wireframe `<Animated.View>` overlay centred on the crosshair reticle using the interim diameter estimate as width; hide overlay when not measuring (FR-016)

**Checkpoint**: All 63 functional requirements covered; `npx tsc --noEmit` passes; rooted device banner displays; Tier 3 round-trip works; zone minimum logic routes correctly; GPS grace period does not strangle valid zone-arrival reads with a stale position.

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup)          → No dependencies — can start immediately
Phase 2 (Foundational)   → Depends on Phase 1 — BLOCKS all user story screens
Phase 3 (US5)            → Depends on Phase 1 (build config); TypeScript side in Phase 2 is runtime-only
Phase 4 (US1)            → Depends on Phase 2 + Phase 3 (ARModule must be registered for isMockLocationEnabled)
Phase 5 (US2)            → Depends on Phase 3 (measureCylinder) + Phase 4 (zone selection context)
Phase 6 (US3)            → Depends on Phase 5 (ARCameraScreen calls ManualMeasureScreen)
Phase 7 (US4)            → Depends on Phase 5 + Phase 6 (measurements feed TreeResultScreen)
Polish                   → Depends on all user story phases complete
```

### User Story Dependencies

- **US5 (P1)**: Depends on Phase 1 (build.gradle, manifest). No other user story deps.
- **US1 (P1)**: Depends on Phase 2 (fetchZones thunk, useARTier, useGeofence) + US5 (isMockLocationEnabled at runtime).
- **US2 (P1)**: Depends on US5 (measureCylinder, runSpeciesInference) + US1 (zone context in Redux).
- **US3 (P2)**: Depends on US2 (ARCameraScreen navigates to it after 3 failures or Tier 3 detection).
- **US4 (P1)**: Depends on US2/US3 (completed measurement feeds TreeResultScreen, submitAudit reads scannedTrees).

### Within Each User Story

- Stitch design task MUST complete before screen implementation task (Principle VII — mandatory)
- Screen layout task before wiring/logic task (within same screen)
- Core implementation before integration (e.g., pendingUploadService before BackgroundFetch config)

### Parallel Opportunities

- All Phase 1 tasks (T001–T004) can run simultaneously — different files
- T008 (useARTier) and T009 (useGeofence) within Phase 2 can run in parallel — different files
- T011 and T012 within Phase 3 (US5) can run sequentially in ARModule.kt (same file — not parallel)
- Stitch design tasks (T015, T017) can sometimes be run ahead of implementation tasks (T016, T018)
- T033 and T034 in Polish phase touch different files — can run in parallel

---

## Parallel Execution Examples

### Phase 1 (All 4 tasks in parallel)
```
Task T001: android/app/build.gradle — ARCore + TFLite deps
Task T002: android/app/src/main/AndroidManifest.xml — ARCore meta-data
Task T003: src/types/navigation.ts — AuditStackParamList
Task T004: src/common/utils/hash.ts — hashPhoto() + unit test
```

### Phase 2 Hook Parallelism (after T005–T007)
```
Task T008: src/common/hooks/useARTier.ts
Task T009: src/common/hooks/useGeofence.ts
```

### Phase 7 Parallelism
```
# AuditCompleteScreen infrastructure (T028, T029) after T027
Task T028: src/services/pendingUploadService.ts
Task T029: BackgroundFetch configure in App.tsx + index.js
```

---

## Implementation Strategy

### MVP First (US5 + US1 only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (ar-bridge, thunks, hooks)
3. Complete Phase 3: US5 Kotlin bridge (ARModule registered, depth + mock check working)
4. Complete Phase 4: US1 (start audit, navigate to zones, GPS arrival detection)

At this point, a farmer can: start an audit → see zones on a map → reach a zone. This is independently demonstrable and testable — the most valuable user-visible milestone.

### Full Delivery Order

Phase 1 → Phase 2 → Phase 3 (US5) → Phase 4 (US1) → Phase 5 (US2) → Phase 6 (US3) → Phase 7 (US4) → Polish

US3 (P2) is the only non-P1 story. It may be deferred if delivery timeline requires it — farmers on ARCore devices do not need Tier 3.

---

## Task Summary

| Phase | Tasks | User Story | Priority |
|-------|-------|-----------|----------|
| Phase 1: Setup | T001–T004 | — | — |
| Phase 2: Foundational | T005–T009 | — | — |
| Phase 3 | T010–T014 | US5 | P1 |
| Phase 4 | T015–T018 | US1 | P1 |
| Phase 5 | T019–T021 | US2 | P1 |
| Phase 6 | T022–T023 | US3 | P2 |
| Phase 7 | T024–T029 | US4 | P1 |
| Polish | T030–T034 | — | — |
| **Total** | **34** | — | — |

**Parallel opportunities identified**: 9 tasks marked [P] (T001–T004, T008–T009, T033–T034).

**Independent test criteria per story**:
- US5: `NativeModules.ARModule.checkDepthSupport()` resolves correctly on real device
- US1: AuditStartScreen renders with mocked API; ZoneNavigation GPS arrival toggles scan button
- US2: ARCameraScreen diameter measurement completes with correct badge on real device
- US3: ManualMeasureScreen DBH formula `62.8 / π ≈ 20.0 cm` passes Jest unit test
- US4: TreeResultScreen MMKV sync write + AuditCompleteScreen offline pending_upload path verified
