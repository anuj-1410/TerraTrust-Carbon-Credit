# Diameter scan changes and device validation

## Diagnosis

The Realme 6 Pro is listed as supporting ARCore, without a Depth API capability
entry. Runtime `isDepthModeSupported(RAW_DEPTH_ONLY)` remains authoritative.
Its expected path is Tier 2, using sparse tracked bark features.

The former code projected lateral displacement onto physical camera X. That
axis is relative to the unrotated image sensor, so portrait sideways movement
could register as almost zero. It also selected SLAM points in sensor axes
instead of the displayed viewport, counted repeated features every frame,
discarded the preview cloud at capture, and combined coordinates from different
ARCore world frames without an anchor. A displayed cylinder was a provisional
fit with looser acceptance rules, so it did not imply a valid final measurement.

The uncertainty check also mixed individual point noise with geometry grouped
by viewing angle. This overstated radius uncertainty for sparse but accurately
fitted scans. It now uses the angular groups' mean errors and the matching
grouped geometry, with a noise floor and conditioning checks retained.

## Corrections

- Use display-oriented camera right projected onto the ground plane for motion.
- Project SLAM samples into the viewport; use a wider trunk region and isolate
  the foreground around the central reticle.
- Store coordinates relative to one nearby AR anchor; transform them back for
  rendering. Update SLAM samples by feature ID and expire unseen features.
- Retain the initial scan points and use the same capture cloud for fitting and
  preview. Deduplicate spatial samples before checking evidence counts.
- Fit circle centre and radius jointly using damped geometric least squares,
  robust Huber weights, and multiple RANSAC candidates. Use double precision
  and translated coordinates when creating candidate circles.
- Validate independent point count, at least 70% inliers, vertical extent,
  trimmed arc coverage, relative residual, radius conditioning, and agreement
  between upper and lower stem sections. Require three consistent accepted
  fits from fresh point-cloud/depth updates.
- Fit on one worker thread; keep camera updates and overlay rendering on the
  rendering thread. Reset after long tracking loss or app backgrounding.
- Show an amber provisional cylinder, green confirmation, and actionable
  guidance for the specific rejected condition. Scanning may continue for up
  to 30 seconds on Tier 2 or 25 seconds on Tier 1 after trunk lock.
- Route the legacy `measureCylinder` bridge through the same visible Activity.

The confidence field is the accepted inlier fraction, rather than an inflated
weighted score. `radius_uncertainty_cm` estimates geometric conditioning; it
does **not** include camera calibration error, SLAM scale bias, bark morphology,
or all correlated sensor errors. It is not a certified accuracy guarantee.

## Automated checks

The Kotlin regression tests cover noisy partial arcs, sparse independent
features, repeated features, background outliers, translated coordinates,
different diameters, narrow ambiguous arcs, non-finite inputs, flat walls,
insufficient motion, inadequate height coverage, and strongly leaning stems.
Motion tests cover display-right projection and rejection of vertical movement.
Existing JavaScript tests exercise the surrounding audit and fallback flows.

All 21 Kotlin tests and all 127 JavaScript tests passed. TypeScript and ESLint
checks passed. The sparse synthetic 36 cm reference produced a 36.05 cm fit;
this is a numerical regression result, not a field accuracy measurement.
The Android release build succeeded using `.env.production` with synthetic
audit GPS disabled. The installable artifact is
`android/app/build/outputs/apk/release/app-arm64-v8a-release.apk`.

## Physical release check

Rebuild/install the Android app: Metro refresh cannot update the native scan
pipeline or the new native blur component. Enable USB debugging and connect the
Realme 6 Pro if capturing diagnostics from this workspace.

1. Mark 1.3 m above ground on a round, upright trunk. Measure circumference with
   a tape at that mark and divide by pi for the reference diameter.
2. Start approximately 1 m away in even daylight. Keep the same marked section
   in the reticle and move your body sideways approximately 25–35 cm. Turning
   the phone in place does not provide translation/parallax.
3. Repeat five scans per trunk across multiple trunk sizes and lighting
   conditions. Record error, repeatability, success rate, and capture duration.
   Validate Tier 1 separately on an actual Depth API device.
4. Verify that a wall, a branch, an almost flat visible patch, and inadequate
   motion do not produce accepted diameters. Check tracking recovery, app
   background/return, Back cancellation, and the manual fallback after failures.
5. On every main tab, scroll content underneath the bar, verify real backdrop
   blur, check the last row and floating action button remain reachable, then
   open the keyboard and Wallet Recovery to verify bar hiding.

For diagnostic logs (do not share phone numbers or OTPs):

```powershell
adb logcat -s TerraTrustAR
```

Pending logs identify tier, rejection reason, unique sample count, and motion
span, with fit residual, arc coverage, and estimated radius conditioning when
geometry was available. Success logs include diameter, confidence, residual,
and inlier count.
No physical device was attached during implementation; automated geometry
tests alone cannot certify the specifications' centimetre accuracy targets.

The local `.env.production` has `AUDIT_DEMO_MODE=false`. For a release build,
select its environment explicitly, especially when combining Gradle tasks:

```powershell
cd android
.\gradlew.bat :app:assembleRelease -DENVFILE=.env.production
```

Development `.env` retains its audit demo setting. The release build enforces
actual GPS checks when saving an audit tree. Gradle rejects release packaging
when synthetic audit GPS, demo API responses, or mock AR flags are enabled.

## Primary references

- [ARCore Camera: physical versus display-oriented pose](https://developers.google.com/ar/reference/java/com/google/ar/core/Camera)
- [ARCore Pose: persistence across world-coordinate changes](https://developers.google.com/ar/reference/java/com/google/ar/core/Pose)
- [ARCore PointCloud: feature IDs and timestamps](https://developers.google.com/ar/reference/java/com/google/ar/core/PointCloud)
- [ARCore raw depth: confidence and fresh depth frames](https://developers.google.com/ar/develop/c/depth/raw-depth)
- [ARCore supported devices](https://developers.google.com/ar/devices)
- [Native blur component](https://github.com/margelo/react-native-blur)
