# Feature Specification: AR Tree Scanning Module

**Feature Branch**: `004-ar-tree-scanning`  
**Created**: 2026-03-25  
**Status**: Draft  
**Input**: AR Tree Scanning module — AuditStartScreen, ZoneNavigationScreen, ARCameraScreen, ManualMeasureScreen, TreeResultScreen, AuditCompleteScreen; auditSlice with full MMKV persistence; Kotlin native bridge ARModule.kt and ARPackage.kt registered in MainApplication.kt; useGeofence and useARTier hooks; API calls to audit/zones, submit-samples, result polling; offline pending_upload queue.

## User Scenarios & Testing _(mandatory)_

### User Story 1 — Annual Audit: Start and Navigate to Zones (Priority: P1)

A farmer with a verified land parcel opens the app and taps "Start Audit" on the HomeScreen. The AuditStartScreen shows their land name, area, last audit date, and the estimated walking distance for this session. The farmer taps "Start Audit". The app calls the backend to generate satellite-guided sampling zones and navigates to ZoneNavigationScreen showing a Google Maps road map with zone markers, a walking path, and the farmer's live GPS position.

**Why this priority**: All subsequent scanning depends on receiving valid zone data and navigating to the correct physical location. Without this working end-to-end, no tree data can be collected.

**Independent Test**: Can be fully tested by tapping "Start Audit" on a land parcel with a mocked API response — verifies zone rendering, walking path display, and GPS arrival detection independently of AR or submission.

**Acceptance Scenarios**:

1. **Given** the farmer is authenticated and has at least one verified land parcel, **When** they tap "Start Audit", **Then** AuditStartScreen displays land name, area in acres, last audit date, estimated walking distance, and a "Start Audit" button.
2. **Given** the farmer taps "Start Audit", **When** the backend API call to `GET /api/v1/audit/zones` succeeds, **Then** the app stores the returned `audit_id`, zones array, and `min_trees_required` in Redux `audit` state and navigates to ZoneNavigationScreen.
3. **Given** ZoneNavigationScreen is loaded, **When** the farmer's GPS position is more than 10 metres from the current zone centre, **Then** the "Start Scanning" button is disabled and grey.
4. **Given** ZoneNavigationScreen is loaded, **When** the farmer's GPS moves to within 10 metres of the zone centre, **Then** the button turns green, text changes to "You're here — Start Scanning", and a haptic vibration fires.
5. **Given** the farmer's GPS is outside their registered land boundary at any time during navigation, **When** the geofence check runs, **Then** an orange warning banner appears: "You appear to be outside your registered land boundary. Please return to your land to scan." and the scanning button remains disabled.
6. **Given** mock location is enabled on the device, **When** the audit start is attempted, **Then** the audit is blocked with the message "Please disable Mock Location in Developer Settings to use this app."

---

### User Story 2 — AR Diameter Measurement (Tier 1 and Tier 2) (Priority: P1)

A farmer standing in a zone opens ARCameraScreen. The screen shows a full-screen camera view with a crosshair reticle, status text, and three action buttons. The farmer taps "Identify Species" to get a species suggestion, then taps "Measure Diameter". The app detects whether the phone supports full depth (Tier 1) or motion-based AR (Tier 2) and runs the corresponding measurement. A bottom sheet shows the result, and the farmer proceeds to TreeResultScreen to confirm and save the tree.

**Why this priority**: Tier 1 and Tier 2 AR measurement is the primary data collection mechanism for the carbon credit calculation. This is the core technical differentiator of the product.

**Independent Test**: Can be tested by running ARCameraScreen on a real device — Tier 1/2 detection runs at startup, measurement triggers on button tap, and a result bottom sheet is shown with diameter data.

**Acceptance Scenarios**:

1. **Given** the app detects `FULL_DEPTH` from `ARModule.checkDepthSupport()`, **When** Redux is hydrated, **Then** `audit.arTier` is set to `1` and kept across app restarts via MMKV.
2. **Given** the app detects `SLAM_ONLY`, **When** Redux is hydrated, **Then** `audit.arTier` is set to `2`.
3. **Given** `arTier = 1`, **When** the farmer taps "Measure Diameter", **Then** a 3-second progress ring appears, the phone waits still, and on success the bottom sheet shows the diameter in cm with a green "High Precision" badge.
4. **Given** `arTier = 2`, **When** the farmer taps "Measure Diameter", **Then** an animated left-right arrow guide appears, a 5-second scanning window runs, and on success the result and a blue "Standard Precision" badge are shown.
5. **Given** the RANSAC fit error exceeds 5% or confidence falls below 0.7, **When** measurement completes, **Then** the app shows "Move closer to the tree and hold still, then try again." and does not save the result.
6. **Given** a measured diameter is less than 5 cm or greater than 200 cm, **When** measurement completes, **Then** the app shows "This seems unusual. Please measure again."
7. **Given** a species is identified with confidence ≥ 60%, **When** the result overlay appears, **Then** the species name, confidence percent, and confirmed species are shown and saved to the tree payload; wood density is looked up automatically from the species constants.
8. **Given** TFLite confidence is below 60%, **When** identification completes, **Then** a dropdown of approved species is shown for manual selection.
9. **Given** an identified species is not in the approved 11-species list, **When** the result is shown, **Then** the app displays "This species is not eligible for carbon credits. Please scan a different tree."
10. **Given** `gedi_available = false` for the current zone, **When** ARCameraScreen loads, **Then** the "Measure Height" button is visible and active; otherwise it is hidden.

---

### User Story 3 — Manual Measurement (Tier 3) (Priority: P2)

A farmer on a phone where ARCore is unavailable, or after 3 consecutive Tier 1/2 failures, is directed to ManualMeasureScreen. An animation demonstrates the string-wrapping technique. The farmer enters the circumference in centimetres, taps "Calculate Diameter", and the app shows the computed diameter. The farmer confirms and returns to ARCameraScreen.

**Why this priority**: Tier 3 is the universal fallback that makes the product work on all Android phones, including the budget devices most Indian farmers own. Without it, farmers on low-end phones cannot complete an audit.

**Independent Test**: ManualMeasureScreen can be rendered in isolation with navigation params — input validation, DBH calculation (`circumference / π`), and navigation back to ARCameraScreen can all be tested without hardware.

**Acceptance Scenarios**:

1. **Given** `arTier = 3` or 3 consecutive Tier 1/2 measurement failures, **When** the farmer taps "Measure Diameter", **Then** ManualMeasureScreen opens.
2. **Given** ManualMeasureScreen is open for the first time in the session, **When** it renders, **Then** a short tutorial animation demonstrating the string-wrapping method is shown.
3. **Given** the farmer enters a circumference value and taps "Calculate Diameter", **When** the value is a positive number, **Then** the app shows "Diameter: [X] cm (calculated from [input] cm circumference)" where X = input / π, rounded to one decimal place.
4. **Given** a valid diameter is shown, **When** the farmer taps "Confirm", **Then** the screen returns to ARCameraScreen with the diameter pre-filled and a grey "Manual Measurement" badge.
5. **Given** the farmer enters a non-numeric or empty value, **When** they tap "Calculate Diameter", **Then** the button remains inactive or an inline validation error is shown.

---

### User Story 4 — Save Each Tree and Complete the Audit (Priority: P1)

After each successful measurement the farmer is taken to TreeResultScreen to review and save the tree. After all zones are completed, the farmer reaches AuditCompleteScreen and submits all data for satellite verification. The result polls until processing completes.

**Why this priority**: The save-per-tree mechanism with immediate MMKV persistence is the single most critical reliability requirement. Losing scan data means a farmer must redo physical work. AuditCompleteScreen and submission close the core user journey.

**Independent Test**: TreeResultScreen can be tested independently by injecting a mock scanned tree into Redux and verifying MMKV persistence. AuditCompleteScreen submission flow can be tested with a mocked API response and polling logic.

**Acceptance Scenarios**:

1. **Given** a tree scan is complete, **When** the farmer taps "Confirm and Save Tree" on TreeResultScreen, **Then** the tree is saved to `audit.scannedTrees` in Redux AND immediately persisted to MMKV — no internet connection required.
2. **Given** the app crashes or the phone dies after a save, **When** the app is reopened, **Then** all previously saved trees are present in `audit.scannedTrees` from MMKV, `audit.currentZoneIndex` is restored, and `audit.activeAuditId` is intact.
3. **Given** a saved tree, **When** TreeResultScreen displays, **Then** it shows species name, diameter in cm in Roboto Mono 32sp, height source ("From GEDI Satellite" or "AR Measured: X m"), precision badge, GPS coordinates formatted as "18.5460°N, 73.9820°E", and an evidence photo thumbnail.
4. **Given** the minimum 3 trees in the current zone are saved, **When** the farmer saves the third, **Then** the app offers the option to move to the next zone or scan more trees (up to the maximum of 5).
5. **Given** all zones are complete, **When** the farmer reaches AuditCompleteScreen, **Then** it shows total trees scanned, zones completed of total, and a preliminary carbon estimate clearly labelled as "Estimated — final number calculated by satellite verification."
6. **Given** the farmer taps "Submit for Satellite Verification" and internet is available, **When** `POST /api/v1/audit/submit-samples` is called, **Then** each evidence photo's SHA-256 hash is computed on-device before upload and both base64 and hash are sent; the app shows a spinner: "Calculating your carbon credits using satellite data... This takes about 30-60 seconds."
7. **Given** the submit returns `status: "processing"`, **When** polling begins, **Then** the app calls `GET /api/v1/audit/result/{audit_id}` every 5 seconds until status is not `"CALCULATING"`.
8. **Given** the poll returns `status: "MINTED"`, **When** received, **Then** the app navigates to HomeScreen, plays the `credit_earned.json` Lottie animation, and updates the CTT balance.
9. **Given** the farmer submits with no internet connection, **When** the submit API call fails, **Then** the full payload is saved under MMKV key `pending_upload` and react-native-background-fetch retries the upload automatically when connectivity is restored.
10. **Given** `audit.uploadStatus` is persisted, **When** the app is relaunched, **Then** `uploadStatus` is reset to `'idle'` regardless of its previous value.

---

### User Story 5 — Kotlin AR Bridge: Depth Support Check and Cylinder Measurement (Priority: P1)

The native Kotlin module `ARModule.kt` is registered in `MainApplication.kt` via `ARPackage.kt`. It exposes `checkDepthSupport()`, `measureCylinder()`, and `checkMockLocation()` as promise-based React Native methods. The TypeScript service `ar-bridge.ts` wraps these into typed async functions consumed by Redux thunks and screen logic.

**Why this priority**: The Kotlin bridge is the only path to ARCore Depth API from JavaScript. Without it, Tier 1 and Tier 2 measurements cannot function. It must be registered correctly before any audit screen code is meaningful.

**Independent Test**: Bridge registration can be validated by calling `NativeModules.ARModule.checkDepthSupport()` from a test screen and verifying one of the three string return values; `checkMockLocation()` can be validated against a device with mock location toggled on/off.

**Acceptance Scenarios**:

1. **Given** `ARPackage` is added to `getPackages()` in `MainApplication.kt`, **When** the app starts, **Then** `NativeModules.ARModule` is defined and accessible from JavaScript.
2. **Given** `checkDepthSupport()` is called, **When** ARCore is unavailable, **Then** the promise resolves to `"UNSUPPORTED"` without throwing; when full depth is available it resolves to `"FULL_DEPTH"`; when SLAM only, to `"SLAM_ONLY"`.
3. **Given** `measureCylinder()` is called mid-scan, **When** the RANSAC fitting succeeds with confidence ≥ 0.7, **Then** the promise resolves with a JSON string containing `diameter_cm`, `confidence`, `tier_used` (1 or 2), and `point_count`.
4. **Given** `measureCylinder()` is called and fitting fails (confidence < 0.7 or point count < 50), **When** the result is returned, **Then** the TypeScript bridge surfaces a user-facing error rather than crashing.
5. **Given** `checkMockLocation()` is called, **When** mock location is enabled in Android developer settings, **Then** the promise resolves to `true` and the app blocks audit start.

---

### Edge Cases

- What happens when the farmer is in a zone but the GPS signal temporarily drops or becomes inaccurate (accuracy > 15 m)? The geofence check should not falsely block scanning during a brief GPS degradation; the last known valid position should be used for a grace period.
- What happens when all zones are returned but one zone has `gedi_available = false` and the farmer skips height measurement for that zone? The tree payload should store `ar_height_m: null` and the backend uses satellite fallback.
- What happens if fewer than 3 trees exist physically within a zone radius? The zone is marked low-density and the farmer can move on after scanning whatever is available; no blocking error.
- What happens if the MMKV `pending_upload` payload is corrupted or partially written? The background fetch handler must validate the payload structure before attempting submission and skip the upload, logging the error, rather than crashing.
- What happens on a farm > 10 acres (multi-day audit)? After Session 1 zones are completed, AuditCompleteScreen shows "Session 1 saved. Return tomorrow for Session 2" and the app state is preserved in MMKV with `sessionComplete` for session boundary tracking.
- What happens if the app is killed during a Tier 1/2 measurement (before saving the tree)? The in-progress measurement is lost but all previously saved trees remain; the farmer is returned to ARCameraScreen for the same tree on next launch.
- What happens if species confidence is exactly 60%? It is accepted (threshold is ≥ 60%).

---

## Requirements _(mandatory)_

### Functional Requirements

#### AuditStartScreen

- **FR-001**: AuditStartScreen MUST display the selected land parcel's name, area in hectares/acres, last audit year, and estimated walking distance for the current session before the farmer taps "Start Audit".
- **FR-002**: On "Start Audit" tap, the screen MUST call `GET /api/v1/audit/zones?land_id=[uuid]`, display a Lottie `spinning_leaf.json` loading state, and navigate to ZoneNavigationScreen on success with zone data stored in Redux `audit` state.
- **FR-003**: If the API call fails, the screen MUST display a retry-able error message in plain language without showing HTTP error codes.

#### ZoneNavigationScreen

- **FR-004**: ZoneNavigationScreen MUST use `react-native-maps` with `mapType="standard"` (Google Maps road map) — never satellite tiles on this screen.
- **FR-005**: The map MUST show: blue dot for the farmer's real-time GPS; green labelled circle for the current target zone; grey unlabelled circles for completed zones; a dotted line walking path connecting all zone centres; green pin markers for scanned trees within completed zones.
- **FR-006**: The "Start Scanning" button MUST be disabled until the farmer's GPS is within 10 metres of the current zone centre. On arrival the button MUST activate, text MUST change, and a haptic vibration MUST fire.
- **FR-007**: GPS distance to zone centre MUST be rechecked every 3 seconds using `react-native-geolocation-service`.
- **FR-008**: The geofence hook MUST run continuously during ZoneNavigationScreen. If the farmer's GPS exits the registered land boundary polygon, an orange warning banner MUST appear and the scanning button MUST be disabled.
- **FR-009**: Map tiles for the land boundary area MUST be cached by `react-native-maps` on first load to allow offline navigation once in the field.

#### AR Tier Detection

- **FR-010**: On app startup (before any audit screen), the `useARTier` hook MUST call `NativeModules.ARModule.checkDepthSupport()` and store the result as `audit.arTier` (integer 1, 2, or 3) in Redux.
- **FR-011**: `audit.arTier` MUST be persisted to MMKV so the AR check does not re-run on every app launch.
- **FR-012**: Before any audit starts, `NativeModules.ARModule.checkMockLocation()` MUST be called; if it returns `true`, the audit MUST be blocked with a clear user message.
- **FR-013**: `react-native-device-info` rooted-device check MUST show a warning banner but MUST NOT block the audit.

#### ARCameraScreen

- **FR-014**: ARCameraScreen MUST display a full-screen live camera preview using `react-native-vision-camera` v4 with a white crosshair reticle centred on screen.
- **FR-015**: Status text at the top of ARCameraScreen MUST cycle through: "Point camera at tree trunk" → "Trunk detected" → "Measuring..." → "Measurement complete".
- **FR-016**: For Tier 1 and Tier 2, a green wireframe cylinder overlay MUST appear over the detected trunk when the depth/SLAM engine identifies a trunk candidate.
- **FR-017**: The "Identify Species" button MUST capture a still frame, run the TFLite `species_model.tflite` on-device, and show a species + confidence overlay. Confidence ≥ 60% auto-accepts; below 60% shows the approved species dropdown.
- **FR-018**: If the selected or identified species is not in the approved 11-species list (defined in `common/constants/species.ts`), the app MUST show "This species is not eligible for carbon credits. Please scan a different tree." and block saving.
- **FR-019**: Wood density (`rho` value) MUST be looked up automatically from the species constants for every accepted species — it is NEVER entered manually by the farmer.
- **FR-020**: For Tier 1, "Measure Diameter" MUST trigger `ARModule.measureCylinder()` with a 3-second still-hold progress ring. For Tier 2, a 5-second animated left-right arrow motion guide MUST appear.
- **FR-021**: A fit error > 5% or confidence < 0.7 MUST show a retry prompt, not save the result.
- **FR-022**: A measured diameter outside the range 5–200 cm MUST show an unusual-value warning and prompt a re-measure.
- **FR-023**: For Tier 3, "Measure Diameter" MUST open ManualMeasureScreen rather than triggering the AR pipeline.
- **FR-024**: The "Measure Height" button MUST only be visible when the current zone's `gedi_available` is `false`.
- **FR-025**: A tree scan progress counter "X/Y trees scanned" MUST be shown in the top-right corner of ARCameraScreen at all times, derived from `audit.scannedTrees.length` vs `audit.zones` min total.
- **FR-026**: A haptic vibration MUST fire on successful diameter lock using `react-native-haptic-feedback`.
- **FR-027**: After 3 consecutive Tier 1 or Tier 2 measurement failures in a session, the app MUST automatically fall back to ManualMeasureScreen for subsequent measurements in that session.

#### ManualMeasureScreen

- **FR-028**: ManualMeasureScreen MUST show a tutorial animation (string-wrapping method) on first display in a session before any input is shown.
- **FR-029**: The farmer MUST be able to enter a circumference value in centimetres. The app MUST calculate `dbh_cm = circumference_cm / π` and display it as "Diameter: [X] cm (calculated from [input] cm circumference)".
- **FR-030**: The result MUST be returned to ARCameraScreen as a confirmed diameter with the grey "Manual Measurement" badge; it MUST NOT navigate to TreeResultScreen directly.
- **FR-031**: Non-numeric or empty input MUST trigger inline validation before calculation is allowed.

#### TreeResultScreen

- **FR-032**: TreeResultScreen MUST display: species name, diameter in cm using Roboto Mono 32sp, height value and source ("From GEDI Satellite" or "AR Measured: X m"), precision badge, GPS coordinates formatted as "DDDDDDd°N, DDDDDDD°E", and the auto-captured evidence photo thumbnail.
- **FR-033**: The precision badge labels MUST be exactly: "◉ High Precision" (Tier 1), "◉ Standard Precision" (Tier 2), "◎ Manual Measurement" (Tier 3) — no other labels.
- **FR-034**: Tapping "Confirm and Save Tree" MUST immediately dispatch the tree to `audit.scannedTrees` in Redux AND write synchronously to MMKV — no internet connection required, no async delay.
- **FR-035**: After saving, the app MUST update the progress counter. When the zone minimum (3 trees) is reached, the app MUST offer "Move to Next Zone" or "Scan More Trees" options.
- **FR-036**: Tapping "Rescan This Tree" MUST return to ARCameraScreen without saving any data.
- **FR-037**: Each saved tree MUST generate a locally-unique UUID (`tree_id`) using uuid v4 before saving.

#### AuditCompleteScreen

- **FR-038**: AuditCompleteScreen MUST show: total trees scanned, zones completed of total, and a preliminary carbon estimate clearly labelled as "Estimated — final number calculated by satellite verification."
- **FR-039**: On "Submit for Satellite Verification" tap, the app MUST compute a SHA-256 hash of each evidence photo on-device using `react-native-quick-crypto` BEFORE uploading; both `evidence_photo_base64` and `evidence_photo_hash` MUST be included in every tree payload.
- **FR-040**: The submit API call MUST be `POST /api/v1/audit/submit-samples` with the complete payload specified in BSDD §5.4.
- **FR-041**: After a `status: "processing"` response, the app MUST poll `GET /api/v1/audit/result/{audit_id}` every 5 seconds until status is not `"CALCULATING"`.
- **FR-042**: On `status: "MINTED"`, the app MUST navigate to HomeScreen and play `credit_earned.json`.
- **FR-043**: On `status: "FAILED"`, the app MUST display the error message from the API and offer a retry.
- **FR-044**: If submission fails due to no internet, the complete payload MUST be saved to MMKV under key `'pending_upload'`. `react-native-background-fetch` MUST be configured to retry the upload automatically when connectivity is restored — not on a timer.

#### auditSlice (Redux Toolkit)

- **FR-045**: `auditSlice` MUST contain all fields defined in FDD §7.1: `activeAuditId`, `activeLandId`, `zones`, `currentZoneIndex`, `scannedTrees`, `arTier`, `sessionComplete`, `uploadStatus`.
- **FR-046**: The following fields MUST be persisted to MMKV via redux-persist: `scannedTrees`, `activeAuditId`, `currentZoneIndex`, `arTier`.
- **FR-047**: `uploadStatus` MUST NOT be persisted — it MUST be reset to `'idle'` on every app launch.
- **FR-048**: `scannedTrees` MUST be written to MMKV synchronously after every single tree save — not batched.

#### Kotlin Native Bridge (ARModule.kt / ARPackage.kt)

- **FR-049**: `ARModule.kt` MUST expose three `@ReactMethod` promise-based functions: `checkDepthSupport`, `measureCylinder`, and `checkMockLocation`.
- **FR-050**: `checkDepthSupport` MUST return exactly one of: `"FULL_DEPTH"`, `"SLAM_ONLY"`, or `"UNSUPPORTED"`. It MUST resolve (not reject) in all cases, returning `"UNSUPPORTED"` on any exception.
- **FR-051**: `measureCylinder` MUST: configure ARCore with `RAW_DEPTH_ONLY` depth mode; acquire a 16-bit raw depth image; filter to the centre 30% width × 60% height of the frame; convert depth pixels to 3D world coordinates using camera intrinsics; run RANSAC cylinder fitting for a minimum of 100 iterations; return a JSON string containing `diameter_cm`, `confidence`, `tier_used`, and `point_count`.
- **FR-052**: `checkMockLocation` MUST read `Settings.Secure.ALLOW_MOCK_LOCATION` and resolve to a boolean.
- **FR-053**: `ARPackage.kt` MUST implement `ReactPackage` and return `listOf(ARModule(reactContext))` from `createNativeModules`.
- **FR-054**: `ARPackage` MUST be added to `getPackages()` in `MainApplication.kt`.
- **FR-055**: `android/app/build.gradle` MUST include ARCore and TFLite dependencies as specified in SRS §14.3.
- **FR-056**: `android/app/src/main/AndroidManifest.xml` MUST include `android.hardware.camera.ar` with `required="false"` and the ARCore `optional` meta-data tag.

#### useGeofence Hook

- **FR-057**: `useGeofence` MUST accept a GeoJSON polygon (the registered land boundary) and return a boolean `isInsideBoundary` updated in real-time as the farmer's GPS position changes.
- **FR-058**: The hook MUST use `react-native-geolocation-service` for GPS position updates and check containment against the polygon.
- **FR-059**: The hook MUST NOT perform network requests; the boundary polygon MUST come from Redux `land.parcels` (cached from land registration).

#### useARTier Hook

- **FR-060**: `useARTier` MUST call `NativeModules.ARModule.checkDepthSupport()` once on mount and dispatch `setARTier(tier)` to the Redux store.
- **FR-061**: If `audit.arTier` is already set in Redux on mount (restored from MMKV), the hook MUST skip the native call to avoid redundant ARCore sessions.

#### TypeScript AR Bridge (ar-bridge.ts)

- **FR-062**: `ar-bridge.ts` MUST export `measureTreeDiameter(): Promise<ARMeasurementResult>`, `detectARTier(): Promise<1 | 2 | 3>`, and `isMockLocationEnabled(): Promise<boolean>` as documented in SRS §14.6.
- **FR-063**: `ARMeasurementResult` interface MUST include `diameter_cm: number`, `confidence: number`, `tier_used: 1 | 2`, and `point_count: number`.

### Key Entities

- **SamplingZone**: Represents one satellite-identified vegetation density area on the farm. Key attributes: `zone_id` (UUID), `label` (A–H), `centre_gps` ({ lat, lng }), `radius_metres` (7, 9, or 11), `zone_type` ('high_density' | 'medium_density' | 'low_density'), `sequence_order` (integer), `gedi_available` (boolean).
- **TreeSample**: One scanned tree measurement. Key attributes: `tree_id` (UUID v4, generated locally), `zone_id`, `species` (string, must be in approved list), `species_confidence` (0.0–1.0), `dbh_cm` (number), `wood_density` (number, auto-looked-up), `ar_height_m` (number | null), `measurement_tier` (1 | 2 | 3), `confidence_score` (number | null), `gps_lat`, `gps_lng`, `gps_accuracy_m`, `evidence_photo_base64` (string), `evidence_photo_hash` (SHA-256 hex string), `scan_timestamp` (ISO 8601).
- **AuditSession**: The in-progress or completed audit. Key attributes: `activeAuditId` (UUID from backend), `activeLandId`, `zones` (SamplingZone[]), `currentZoneIndex`, `scannedTrees` (TreeSample[]), `arTier` (1 | 2 | 3), `sessionComplete` (boolean for multi-day large farms), `uploadStatus`.
- **PendingUpload**: The full submit-samples payload stored in MMKV under key `'pending_upload'` when offline. Matches the request body of `POST /api/v1/audit/submit-samples` exactly.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A farmer starting from AuditStartScreen can reach the first zone, scan a tree, and save it to local storage in under 5 minutes on a supported device with internet, measured from app launch.
- **SC-002**: All scanned tree data survives an app force-quit and cold restart with zero data loss — validated by force-killing the app, relaunching, and confirming `audit.scannedTrees` count is unchanged.
- **SC-003**: Tier 1 diameter measurement completes in under 5 seconds on a device with a ToF sensor (3-second still period + processing); Tier 2 completes in under 8 seconds (5-second motion window + processing).
- **SC-004**: Species identification using the on-device TFLite model returns a result in under 500 milliseconds, with no network request required.
- **SC-005**: The offline pending-upload queue retries successfully within 60 seconds of internet connectivity being restored, with no manual user action required.
- **SC-006**: The entire AR scanning session for a 3-zone farm (9 trees minimum) can be completed without any internet connection after zones are downloaded — only the final submission requires connectivity.
- **SC-007**: The "Confirm and Save Tree" action writes to local storage in under 100 milliseconds, ensuring the farmer never experiences a perceptible delay between tapping and the confirmation.
- **SC-008**: GPS arrival detection at a zone centre activates the scanning button within 6 seconds of the farmer physically entering the 10-metre radius (one GPS check cycle = 3 seconds + processing).
- **SC-009**: Zone navigation map renders correctly and the farmer's live GPS dot updates without freezing on a device with cached map tiles and no internet connection.
- **SC-010**: A farmer who scans the minimum required trees (9 total across 3 zones) submits successfully, and the app polls to a `MINTED` result and displays it without requiring any manual page refresh.

## Assumptions

- The backend API endpoint `GET /api/v1/audit/zones` is implemented and returns the response shape documented in BSDD §5.4 before this module can be integrated end-to-end; development proceeds with mocked responses.
- The `species_model.tflite` asset file in `src/assets/tflite/` is provided and trained to classify the 11 approved species; this feature does not train or update the model.
- ARCore is installed on the test device or through the play services mechanism; the Kotlin bridge assumes `ArCoreApk.getInstance()` is accessible.
- The `react-native-background-fetch` module is already installed and its Android `HeadlessTask` is configured in `MainApplication.kt`; this feature adds the pending-upload task handler, not the module setup itself.
- GEDI height data availability per zone (`gedi_available`) is determined by the backend and returned in the zone payload; the frontend does not independently verify this.
- Evidence photos are auto-captured at the moment of diameter lock (not manually triggered by the farmer); the camera frame in use at lock time is the evidence photo.
- For multi-day audits (farms > 10 acres), the zone split into two sessions is determined by the backend in the zones response; the frontend handles resume by reading `audit.currentZoneIndex` and `audit.sessionComplete` from MMKV.
