# UI and appearance changes — updated 9 October 2026

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

## Completed verification

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
