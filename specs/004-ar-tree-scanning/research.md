# Research: AR Tree Scanning Module (004)

**Generated**: 2026-03-26
**Status**: Complete — all NEEDS CLARIFICATION resolved

---

## D-001: GPS Grace Period During Accuracy Degradation

**Decision**: Time-based 30-second grace period using `lastGoodPosition` cached in
`useGeofence` hook state. A "good" reading is defined as `accuracy ≤ 15 metres`.
When accuracy exceeds 15m, the last good position is used for zone arrival checks
for up to 30 seconds before the geofence is considered stale.

**Rationale**: Count-based grace (e.g., 10 consecutive bad reads × 3-second interval
= 30 seconds) causes jitter when accurate reads intersperse bad ones, resetting the
counter unpredictably. A fixed time window is deterministic and user-understandable.
SRS §15 sets the hard GPS rejection threshold at 30m accuracy for saving a tree;
15m is the intermediate threshold for zone-arrival computation.

**Alternatives considered**:
- *Count-based grace*: Rejected — counter jitter from intermittent good reads.
- *No grace period*: Rejected — brief GPS outages would falsely disable the scan
  button while farmer is physically standing in the zone.

**Implementation note**: `useGeofence.ts` stores `{ lastGoodPosition, lastGoodAccuracyTime }`.
`watchPosition` config: `{ enableHighAccuracy: true, distanceFilter: 1, interval: 3000 }`.

---

## D-002: TFLite Species Inference Transport from VisionCamera

**Decision**: Custom Kotlin `@ReactMethod` `runSpeciesInference(imageBase64, promise)` added
to the existing `ARModule.kt`. Model loaded once in `ARModule` constructor via
`context.assets.open("species_model.tflite")`. Input: 224×224 normalised float array.
Output JSON: `{ species, confidence, all_scores }`. Called from JS after `camera.takeSnapshot()`.

**Rationale**:
- `react-native-fast-tflite` — unmaintained (last update Aug 2024), lacks VisionCamera
  frame integration, requires the same custom glue code anyway.
- `@tensorflow/tfjs-react-native` — ~2MB WASM bundle, ~500ms cold start, JS↔native
  boundary crossing on every frame inference; unacceptable for < 500ms SC-004 target.
- Custom Kotlin bridge is ~150 additional lines, zero extra deps beyond the
  `org.tensorflow:tensorflow-lite:2.14.0` already specified in SRS §14.3, and
  gives full control over YUV→RGB→float preprocessing pipeline.

**Alternatives considered**:
- `react-native-fast-tflite`: Rejected (unmaintained, no VisionCamera integration).
- `@tensorflow/tfjs-react-native`: Rejected (bundle overhead, latency).

**Build.gradle additions**: No new dependencies required beyond what SRS §14.3 already
specifies: `implementation 'org.tensorflow:tensorflow-lite:2.14.0'` and
`implementation 'org.tensorflow:tensorflow-lite-support:0.4.4'`.

---

## D-003: Background-Fetch Reconnect Trigger Configuration

**Decision**: Configure `react-native-background-fetch` with
`requiredNetworkType: BackgroundFetch.NETWORK_TYPE_ANY` (value = 1). This uses
Android's JobScheduler API to run the task only when network is available.
Additional required options: `stopOnTerminate: false`, `startOnBoot: true`,
`enableHeadless: true`.

HeadlessTask function is registered in `index.js` (app root) via
`BackgroundFetch.registerHeadlessTask(...)` — NOT in `MainApplication.kt`.
The module itself auto-links; `MainApplication.kt` needs no changes.

**Rationale**: `requiredNetworkType: NETWORK_TYPE_ANY` maps directly to Android
JobScheduler's `setRequiredNetworkType(NetworkType.CONNECTED)`, guaranteeing the
task only fires on connectivity restore. This is reconnect-triggered — not a timer.
The spec assumption about HeadlessTask in `MainApplication.kt` is slightly incorrect:
only the npm package auto-links there; the task handler function must be registered
in `index.js`.

**Alternatives considered**:
- `@react-native-community/netinfo` event listener: Rejected — fires in foreground
  only; does not work when app is terminated. Background fetch covers both states.
- Timer-based polling: Rejected explicitly by constitution Principle III.

**pending_upload validation**: Before retry, validate: (a) key exists, (b) JSON
parseable, (c) `audit_id` string present, (d) `trees` array present and non-empty.
Corrupted or invalid payload → `mmkv.delete('pending_upload')` → skip gracefully.
Still-offline error → leave key intact for next trigger.

---

## D-004: auditSlice Scaffold Status

**Decision**: `auditSlice.ts` is already fully scaffolded with all required fields
and reducers. The slice contains: `activeAuditId`, `activeLandId`, `zones`,
`currentZoneIndex`, `scannedTrees`, `arTier` (typed `1 | 2 | 3`), `sessionComplete`,
`uploadStatus`. All required reducers exist: `startAudit`, `setZones`,
`setCurrentZoneIndex`, `addScannedTree`, `setArTier`, `setUploadStatus`,
`setSessionComplete`, `resetAudit`.

**Rationale**: `store/index.ts` confirms `auditPersistConfig` with
`blacklist: ['uploadStatus']` — correct per constitution Principle VI.
No structural changes to `auditSlice.ts` or `store/index.ts` needed.

---

## D-005: All AR-Audit Screen Stubs Already Exist

**Decision**: All 6 screens (`AuditStartScreen`, `ZoneNavigationScreen`,
`ARCameraScreen`, `ManualMeasureScreen`, `TreeResultScreen`, `AuditCompleteScreen`)
already have placeholder stub files under `src/features/ar-audit/screens/`.
Implementation starts by replacing stub content — no new screen files to create.

**Rationale**: Feature 001 (RN Project Foundation) scaffolded these files as empty
placeholders. The work here is implementation, not file creation.

---

## D-006: ARModule.kt Extension for Species Inference

**Decision**: Add `runSpeciesInference(imageBase64: String, promise: Promise)` as a
new `@ReactMethod` to the existing `ARModule.kt`. The TFLite `Interpreter` is
initialised once in `ARModule`'s `init {}` block and stored as a `private` field.
This avoids re-loading the model (~25MB) on every inference call.

**Rationale**: A separate Kotlin module (e.g., `SpeciesModule.kt`) would work but
adds a second package registration step and splits AR-related native code across
files. Since `ARModule.kt` already owns the AR session context and the species
inference is only called from `ARCameraScreen`, co-location is appropriate.

---

## D-007: Tier 2 SLAM 5-Second Window in Kotlin

**Decision**: For Tier 2 (SLAM_ONLY), `measureCylinder()` accumulates ARCore depth
frames captured over a 5-second period on an ARCore HandlerThread, then runs the
same RANSAC cylinder fitting algorithm as Tier 1 on the accumulated point cloud.
A `CountDownLatch(1)` or coroutine `delay(5000)` manages the timing. The
`tier_used` field in the result JSON is set to `2`.

**Rationale**: The 5-second window gives the SLAM engine enough motion parallax to
triangulate depth without a hardware ToF sensor. The same RANSAC parameters (100
iterations, 0.7 confidence) apply. The JS layer does not need to know the
collection duration — it simply awaits the promise.

---

## D-008: Evidence Photo Capture Timing

**Decision**: Evidence photos are auto-captured at the exact moment of diameter lock
(when RANSAC confidence ≥ 0.7 for Tier 1/2, or when farmer taps "Confirm" for
Tier 3). The camera frame in use at lock time is the evidence photo. The farmer
cannot manually trigger photo capture — it is automatic.

**Rationale**: Spec Assumptions section: "Evidence photos are auto-captured at the
moment of diameter lock (not manually triggered by the farmer)." Auto-capture
ensures the photo shows the trunk that was measured, maintaining audit chain of
custody.

**SHA-256 flow**: `camera.takeSnapshot()` → base64 string → `hashPhoto(base64)`
(via `react-native-quick-crypto` from `common/utils/hash.ts`) → store both
`evidence_photo_base64` and `evidence_photo_hash` in `TreeSample` before MMKV write.

---

## D-009: Zone Low-Density and Multi-Day Session Handling

**Decision**:
- **Low-density zones** (< 3 trees physically present): The zone is marked
  low-density in the `SamplingZone` state (`zone_type: 'low_density'`). The farmer
  can move to the next zone after scanning whatever is available; no blocking error
  is shown. FR-035's "minimum 3 trees" option prompt only appears when 3+ trees
  have been saved.
- **Multi-day audits** (farms > 10 acres): Backend splits zones into sessions in
  the `GET /api/v1/audit/zones` response. Frontend reads `audit.sessionComplete`
  and `audit.currentZoneIndex` from MMKV on relaunch. `AuditCompleteScreen` shows
  "Session 1 saved. Return tomorrow for Session 2" when `sessionComplete` is set by
  the backend (determined from zone counts in the zones payload).

**Rationale**: Frontend does not determine session splits — the backend does, based
on land area. Frontend only needs to respect the `sessionComplete` flag and resume
from `currentZoneIndex`.

---

## D-010: Navigation Type Updates Required

**Decision**: `src/types/navigation.ts` must add `AuditStackParamList` with params
for all 6 AR audit screens. `ZoneNavigationScreen` receives `{ auditId, landId }` as
nav params (already in Redux, but passed for type safety). `ARCameraScreen` receives
`{ zoneId, zoneIndex }`. `ManualMeasureScreen` receives `{ returnDiameter?: number }`
for pre-fill. `TreeResultScreen` receives no params (reads from Redux). `AuditCompleteScreen`
receives no params.

**Rationale**: The existing `navigation.ts` has `RootStackParamList` and
`AuthStackParamList`. Audit screens need their own typed stack for navigation type safety.
