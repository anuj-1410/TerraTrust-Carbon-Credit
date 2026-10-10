# UI and appearance changes — updated 10 October 2026

## 10 October: OTP rendering, motion, history, and land review

| Finding | Correction |
| --- | --- |
| The autofill-compatible OTP TextInput and six custom cells both occupied the row. Transparent text alone allowed the native input's entire code to appear over the cells on the reported phone. | Hide the native input's rendering with opacity zero, retain its input/autofill behavior, and display digits only in the custom cells. The visible row exposes an accessibility action to focus code entry. Refocus after verification/resend failures waits until the input is editable again. |
| Modal slide animation moved the backdrop with the sheet, producing a late tint. Authentication could also navigate while the drawer was still exiting. | Use SheetModal with native Modal animation disabled. One native-driven Animated.Value fades a stationary backdrop and translates the sheet together. Open in 280ms, close in 200ms, focus after opening, and commit login after closing. Dismissal invalidates the phone intent immediately. Honor the device's reduced-motion setting. Shared sheets use the same transition and bounded, scrollable content. |
| The history chart called yearly issuance “growth”, used hard-to-read axes, and calculated totals from only the fetched page. | Use exact year/CTT labels and horizontal comparison bars. Filters: All years, 1, 3, 5, 10 calendar years ending in the current year, or a validated custom inclusive year range. Chart shows up to five years per page with Older/Newer controls; the audit list follows the same filter. |
| History could silently stop at the first API page or accept stale refresh results. | Fetch all history sequentially in batches of 20 from the existing page/limit API. Deduplicate overlaps, stop non-advancing pagination, reject superseded/account-changed responses, and label loading/failed totals as incomplete. Keep cached data and offer retry. The list is virtualized; no artificial overall year or record cap is imposed, but loading remains subject to device memory, network, and backend limits. |
| Land pagination lived separately from the shared parcel snapshot; background refresh could leave the list using old page metadata. Null audit fields retained old values, and registered_at was not displayed. | Keep page/hasMore with the shared snapshot. Isolate later-page requests by snapshot ID, reject skipped/stale pages, preserve selected detail/rename data across page-one refresh, clear explicit null fields, and map registered_at. Show loading and retry states. |
| Camera/picker/OCR/boundary/rename/register results could finish after navigation or logout, and repeated taps could submit twice. | Own each operation by focused screen, Firebase UID, generation, and a synchronous lock; abort HTTP requests and discard obsolete results. Validate required OCR fields and registration responses. Scope document back handlers to focus, provide loading cancellation, and surface unexpected boundary errors with retry/manual-map actions. |
| Boundary preview could send malformed coordinates to the map, ignored holes, and estimated area with a fixed latitude. The confirmation panel obscured part of the map. | Check ring closure, coordinate bounds, and distinct vertices; render/subtract holes, exclude them from geofencing, and use the parcel's latitude for the local approximate area. Keep server/PostGIS area authoritative. Place the map above a bounded bottom panel. Structural checks do not replace backend topology/ownership validation. |
| Visible scroll indicators appeared across screens; transition behavior and backgrounds varied. | Hide both scroll indicators on every app ScrollView/FlatList while retaining scrolling. Use themed native stack transitions, avoid interaction-blocking tab springs, and honor reduced motion in stacks, tabs, and sheets. Prevent duplicate success-screen navigation from its timer and button. |

### Verification completed on 10 October

- TypeScript: `npx tsc --noEmit` passed.
- ESLint: `npx eslint src --ext .ts,.tsx --quiet` passed, with no errors.
- Jest: `npx jest --runInBand --testTimeout=15000` — **201 tests across 45 suites passed**. New coverage includes OTP input rendering/autofill props, deferred drawer dismissal, reduced motion, annual totals/ranges/chart paging, complete/repeating/stale history pagination, land snapshot metadata/null/date mapping, geometry holes/latitude, duplicate submissions, refresh during rename, late registration after logout, cancellation during OCR, malformed OCR, and unexpected boundary responses.
- Android production Metro bundle and 20 assets generated successfully. The sandbox blocked Metro worker spawning (EPERM); the approved run outside the sandbox completed. The existing @noble/hashes/crypto.js package-exports advisory remains, with Metro's successful file fallback. Native debug compilation in the historical section below was performed on 9 October; these changes introduce no native dependency.

### Demo data rules

The intended checkpoints in TerraTrust_DemoAccounts_Specification.txt are:

| Phone | Intended next-login behavior |
| --- | --- |
| +91 9000000001 | Reset to fresh: no KYC, wallet registration, or land. |
| +91 9000000002 | Restore KYC/wallet checkpoint; remove added lands/audits. |
| +91 9000000003 | Restore KYC/wallet and the seeded parcel; remove audits/scans. |
| +91 9000000004 | Keep server-side data; new lands, audits, and credits accumulate. |

The supplied backend middleware example uses a UID set for the entire server process. That permits only one reset per UID per process until explicitly invalidated; it does not detect every new login. No deployed backend implementation is present in this frontend workspace, so actual reset frequency is unverified. The frontend does not simulate destructive server resets. Logout clears local account caches for every account, while appearance preference remains saved.

### Device and integration checks

On Realme 6 Pro, verify typed/pasted/SMS-autofilled six-digit codes render once, errors restore typing, and keyboard/drawer/backdrop enter and exit together. Check close during verification and reduced motion. Exercise light/dark mode, large text, short screens, map visibility, document capture/manual upload, register/rename, pull refresh after loading several land pages, and offline retry. Use more than 20 history records spanning more than five years to verify totals and all filters against server data. Verify demo resets in the deployed backend independently.

No physical-phone frame profiling, signed APK, live registration transaction, or deployed demo-reset check was performed here. Automated tests and bundling establish code correctness for the covered cases; they do not establish device animation performance or live-service behavior.

References: [React Native animations](https://reactnative.dev/docs/animations), [TextInput autofill](https://reactnative.dev/docs/textinput), [reduced motion](https://reactnative.dev/docs/accessibilityinfo), and [GeoJSON polygon structure](https://datatracker.ietf.org/doc/html/rfc7946).

## Findings and fixes

| Issue | Change |
| --- | --- |
| The logo disappeared quickly after the earlier startup optimizations. | Keep the launch logo and wordmark visible for 2.5 seconds. Firebase restoration and profile loading run concurrently. The delay applies once per app process; OTP handoff and authentication retries do not replay it. |
| The floating bar had a full-width native blur layer and a large pill shadow. Android's installed blur implementation captures the activity root, creating a rendering risk beyond the intended pill. | Remove Android live blur and pill shadows/elevation. Keep the surroundings transparent, the pill opaque, and foreground icons/labels undimmed. On iOS, clip optional blur inside the pill. Phone verification is still needed to confirm the reported visual artifact is gone. |
| Native navigation headers were disabled, while many custom title/back rows were inside scrolling content. | Add a shared fixed ScreenHeader outside scroll/list content, with safe-area spacing, readable themed colors, and 48dp back controls. Preserve audit cancellation, rescan, and save/discard handlers. Camera controls remain fixed over the preview. |
| Several forms, chart labels, status cards, and sheets used hard-coded white backgrounds or dark text. | Add semantic light and dark palettes, NativeWind variables, and navigation/status-bar theming. Update forms, OTP cells, chart colors, badges, alerts, cards, sheets, tabs, and recovery UI. Camera imagery, document photos, and camera reticles keep their original colors. |
| There was no saved appearance preference. | Add Settings → Dark Mode. Save appearance_mode in MMKV, apply it immediately, restore it on relaunch, and preserve it when account data is cleared on logout. Native appearance follows the selected mode. |
| Multiple GPS warnings or long boundary details could crowd controls on small displays. | Let the zone map flex to fill all space above a bottom-aligned, bounded scrollable control panel; bound the boundary-confirmation panel with scrolling. Apply safe bottom spacing to audit and camera controls, and remove excessive Lands list footer spacing. |

Light mode uses restrained forest accents and bright surfaces. Dark mode uses a black (#000000) main background, neutral charcoal cards/inputs, neutral grey borders, and readable status colors. Green is used for primary actions, icons, selections, and success indicators. Light mode uses neutral off-white surfaces and dark neutral text. Primary button backgrounds stay dark green in both modes so white labels retain contrast.

## Historical verification — 9 October

- TypeScript: `npx tsc --noEmit` passed.
- ESLint: `npx eslint src --ext .ts,.tsx --quiet` passed with no errors. Existing advisory style warnings are excluded by `--quiet`.
- Jest: `npx jest --runInBand --testTimeout=15000` — **174 tests across 37 suites passed**.
- New coverage checks theme switching/relaunch/logout persistence, WCAG AA contrast for normal text and semantic status labels, Settings toggle behavior, fixed header placement, Android tab rendering, tab navigation/cancelled presses, keyboard hiding, the 2.5-second launch interval, concurrent profile loading, same-screen OTP drawer opening after Firebase supplies a verification ID, six-digit automatic submission, Firebase instant/late automatic verification, wrong-code recovery, resend cooldown, dismissal during verification, fresh phone attempts, account-scoped key storage, native secure-random initialization, and bottom map controls.
- Source inspection confirmed shared headers are outside ScrollView/FlatList content.
- Android production JavaScript bundle and 20 assets generated successfully with Metro. A transitive `@noble/hashes/crypto.js` package-exports warning remains; Metro resolved it using its file fallback. This check does not compile native Android code or create an APK.
- Android native debug compilation passed: `:app:compileDebugKotlin` and `:react-native-get-random-values:compileDebugJavaWithJavac`, with `.env.production` and `arm64-v8a`. The offline attempt needed two uncached Gradle artifacts; downloading them allowed compilation to complete. An SDK tooling XML-version advisory remains. These tasks compile native code; they do not assemble or sign an APK.

## 9 October: sign-in drawer and wallet correction

- The phone-entry screen has one background and an integrated title, without a separate highlighted header. The OTP route and old screen are removed. OTP entry is a native Modal bottom drawer with six visual cells backed by one autofill-compatible input. Complete input submits automatically. Firebase onAuthStateChanged also handles instant/automatic verification without code entry.
- The drawer can close to change numbers, including during verification. Abandoned phone intents are invalidated; a short-lived listener rejects late Android auto-verification for a dismissed number. Old responses cannot overwrite a new verification session or commit a profile after dismissal.
- The screenshot warning was generated by background wallet setup, rather than KYC validation. The app called ethers.Wallet.createRandom without initializing React Native crypto.getRandomValues. Add react-native-get-random-values 2.0.0 before ethers/uuid load; reject its insecure legacy Chrome-debugger fallback when generating wallet keys.
- Scope newly generated Keychain services and concurrent setup to Firebase UID. Preserve the old unscoped credentials. Recovery candidates use a separate service so an approval request does not replace the active key. Only public addresses go to the server.
- Replace the global wallet banner with non-persisted wallet setup status, bounded automatic retries, foreground/reconnect retries, and a Profile retry action. Account loading and KYC remain independent of wallet generation. Demo account 1 opening KYC is correct per the demo specification: its checkpoint deliberately has no KYC or wallet.
- React Native CLI detects Android and iOS native linking for the new dependency, and Android native debug compilation passed. iOS compilation was not run in this Windows workspace. A fresh native build is required; an old APK cannot gain a new native module from JavaScript changes alone.

## Device checks still required

No physical phone UI session was available here. A new signed APK has not been built. On the Realme 6 Pro, verify:

1. Cold launch holds the logo for about 2.5 seconds; Firebase/network work may take longer. After Send OTP receives a verification ID, an OTP drawer opens over the same uniform phone-entry screen. Firebase SMS/app verification itself remains network-dependent.
2. Scroll dashboard, lands/details, history, profile/settings/recovery, document forms, and audit screens: title/back controls stay fixed and bottom actions remain reachable.
3. Switch light/dark mode, navigate through forms and sheets, relaunch, then log out: the preference and readable colors remain consistent.
4. Check the floating bar against photos and long content. Android should have no live blur, grey veil, tab shadow, or dimmed foreground labels; open the keyboard and confirm the bar hides.
5. Close the OTP drawer, change numbers, resend, try an incorrect code, use SMS autofill, and confirm native auto-verification when supported. Demo account 1 should enter KYC without a permanent wallet banner; confirm wallet registration after setup.
6. Check keyboard entry, increased font size, landscape/short displays, status-bar cutouts, camera-to-manual-measure transitions, document capture, and audit exit/save confirmations.

Implementation references: [React Native Firebase automatic verification](https://rnfirebase.io/auth/phone-auth), [ethers React Native crypto support](https://docs.ethers.org/v6/cookbook/react-native/), [secure-random polyfill](https://github.com/LinusU/react-native-get-random-values), [NativeWind variables and dark mode](https://www.nativewind.dev/docs/core-concepts/dark-mode), [React Navigation headers](https://reactnavigation.org/docs/headers/), and the installed `@react-native-community/blur` 4.4.1 Android source. The secure-random dependency is pinned in package.json and package-lock.json.
