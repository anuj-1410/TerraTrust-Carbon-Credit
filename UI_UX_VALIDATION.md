# UI and appearance changes — 8 October 2026

## Findings and fixes

| Issue | Change |
| --- | --- |
| The logo disappeared quickly after the earlier startup optimizations. | Keep the launch logo and wordmark visible for 2.5 seconds. Firebase restoration and profile loading run concurrently. The delay applies once per app process; OTP handoff and authentication retries do not replay it. |
| The floating bar had a full-width native blur layer and a large pill shadow. Android's installed blur implementation captures the activity root, creating a rendering risk beyond the intended pill. | Remove Android live blur and pill shadows/elevation. Keep the surroundings transparent, the pill opaque, and foreground icons/labels undimmed. On iOS, clip optional blur inside the pill. Phone verification is still needed to confirm the reported visual artifact is gone. |
| Native navigation headers were disabled, while many custom title/back rows were inside scrolling content. | Add a shared fixed ScreenHeader outside scroll/list content, with safe-area spacing, readable themed colors, and 48dp back controls. Preserve audit cancellation, rescan, and save/discard handlers. Camera controls remain fixed over the preview. |
| Several forms, chart labels, status cards, and sheets used hard-coded white backgrounds or dark text. | Add semantic light and dark palettes, NativeWind variables, and navigation/status-bar theming. Update forms, OTP cells, chart colors, badges, alerts, cards, sheets, tabs, and recovery UI. Camera imagery, document photos, and camera reticles keep their original colors. |
| There was no saved appearance preference. | Add Settings → Dark Mode. Save appearance_mode in MMKV, apply it immediately, restore it on relaunch, and preserve it when account data is cleared on logout. Native appearance follows the selected mode. |
| Multiple GPS warnings or long boundary details could crowd controls on small displays. | Make the zone navigation body scrollable and bound the boundary-confirmation panel with scrolling. Apply safe bottom spacing to audit and camera controls, and remove excessive Lands list footer spacing. |

Light mode uses restrained forest accents and bright surfaces. Dark mode uses deep forest surfaces with pale green accents and readable status colors. Primary button backgrounds stay dark green in both modes so white labels retain contrast.

## Completed verification

- TypeScript: `npx tsc --noEmit` passed.
- ESLint: `npx eslint src --ext .ts,.tsx --quiet` passed with no errors. Existing advisory style warnings are excluded by `--quiet`.
- Jest: `npx jest --runInBand --testTimeout=15000` — **159 tests across 34 suites passed**.
- New coverage checks theme switching/relaunch/logout persistence, WCAG AA contrast for normal text and semantic status labels, Settings toggle behavior, fixed header placement, Android tab rendering, tab navigation/cancelled presses, keyboard hiding, the 2.5-second launch interval, concurrent profile loading, and immediate phone-to-OTP navigation after Firebase supplies a verification ID.
- Source inspection confirmed shared headers are outside ScrollView/FlatList content.
- Android production JavaScript bundle and 20 assets generated successfully with Metro. A transitive `@noble/hashes/crypto.js` package-exports warning remains; Metro resolved it using its file fallback. This check does not compile native Android code or create an APK.

## Device checks still required

No physical phone UI session was available here. A new signed APK has not been built. On the Realme 6 Pro, verify:

1. Cold launch holds the logo for about 2.5 seconds; Firebase/network work may take longer. After Send OTP receives a verification ID, the OTP screen opens immediately. Firebase SMS/app verification itself remains network-dependent.
2. Scroll dashboard, lands/details, history, profile/settings/recovery, document forms, and audit screens: title/back controls stay fixed and bottom actions remain reachable.
3. Switch light/dark mode, navigate through forms and sheets, relaunch, then log out: the preference and readable colors remain consistent.
4. Check the floating bar against photos and long content. Android should have no live blur, grey veil, tab shadow, or dimmed foreground labels; open the keyboard and confirm the bar hides.
5. Check keyboard entry, increased font size, landscape/short displays, status-bar cutouts, camera-to-manual-measure transitions, document capture, and audit exit/save confirmations.

Implementation references: [NativeWind variables and dark mode](https://www.nativewind.dev/docs/core-concepts/dark-mode), [React Navigation headers](https://reactnavigation.org/docs/headers/), and the installed `@react-native-community/blur` 4.4.1 Android source. These changes use existing dependencies.
