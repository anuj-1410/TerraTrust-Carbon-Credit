# Tasks: Dashboard Module (005)

**Branch**: `005-dashboard-module`  
**Input**: Design documents from `specs/005-dashboard-module/`  
**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Data model**: [data-model.md](data-model.md) | **Contracts**: [contracts/api-contracts.md](contracts/api-contracts.md)

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no incomplete-task dependencies)
- **[US1/2/3/4]**: Which user story this task belongs to
- Exact file paths are included in every task description

---

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: State slice update and shared utility that BOTH screens depend on. No HomeScreen or CreditHistoryScreen code can be written until these are complete.

**⚠️ CRITICAL**: T001 → T002 must complete before any screen task. T003 must complete before US2 land card work.

- [X] T001 Add `lastFetchedAt: string | null` to `CreditsState` interface, set initial value `null`, and add `setLastFetchedAt(state, action: PayloadAction<string>)` reducer in `src/features/dashboard/store/creditsSlice.ts`
- [X] T002 Add `fetchCreditsThunk` using `createAsyncThunk` to `src/features/dashboard/store/creditsSlice.ts` — calls `GET /api/v1/credits/balance?wallet_address=` via `src/services/api.ts`; dispatches `setHistory`; calls `getCTTBalance` from `src/services/blockchain.ts` (primary balance source); falls back to `balance_ctt` on RPC failure; dispatches `setPendingMint(false)` when `pendingMint === true`; dispatches `setLastFetchedAt(new Date().toISOString())`
- [X] T003 [P] Add `getLandStatus(parcel: LandParcel): 'green' | 'orange' | 'red'` pure utility function to `src/common/utils/getLandStatus.ts` — derives colour from `parcel.last_audit_year` vs current calendar year per rules: null → orange; current year → green; 2+ year gap → red; prior year + before March 1 of current year → orange; prior year + on/after March 1 of current year → red
- [X] T004 Write unit tests for `fetchCreditsThunk` in `src/features/dashboard/store/__tests__/creditsSlice.test.ts` — covers: blockchain primary path; API `balance_ctt` fallback when `getCTTBalance` throws; `pendingMint` is set to `false` when it was `true`; `lastFetchedAt` is stamped; `history` is populated from API response
- [X] T005 [P] Write unit tests for `getLandStatus` in `src/common/utils/__tests__/getLandStatus.test.ts` — covers all 5 branch paths: null `last_audit_year`; current year; 2-year gap; prior year before March 1; prior year on/after March 1

**Checkpoint**: Foundational complete — `fetchCreditsThunk` is tested, `getLandStatus` is tested. Screen implementation may now begin.

---

## Phase 2: User Story 1 — CTT Balance on Home Screen (Priority: P1) 🎯 MVP

**Goal**: Farmer lands on HomeScreen and immediately sees their CTT balance fetched from Polygon blockchain. Offline fallback shows cached balance with staleness badge. `credit_earned.json` celebrates new tokens.

**Independent Test**: Launch as authenticated farmer; HomeScreen shows blockchain-sourced balance. Kill network; relaunch — cached balance shows with "Last updated [time]" badge. With `pendingMint` toggling true→false + balance increase, `credit_earned.json` plays once.

- [X] T006 [US1] Design HomeScreen in Stitch MCP — call `generate_screen_from_text` with full layout description: top CTT balance card (large Roboto Mono number, subtitle, CO2 line, PolygonScan link, pendingMint banner), middle land parcel list, bottom credit history preview, earthy green TerraTrust theme; then call `get_screen` to retrieve screen details and download URL; fetch the HTML/CSS from the download URL; confirm output before proceeding
- [X] T007 [US1] Scaffold `src/features/dashboard/screens/HomeScreen.tsx` from Stitch HTML/CSS — convert to NativeWind utility classes; wire `useAppSelector` for `credits` (`balance`, `history`, `pendingMint`, `lastFetchedAt`), `land.parcels`, and `auth.walletAddress`; dispatch `fetchCreditsThunk(walletAddress)` inside `useEffect` on mount; no `StyleSheet.create`
- [X] T008 [US1] Implement CTT balance card in `src/features/dashboard/screens/HomeScreen.tsx` — large Roboto Mono `balance` value with " CTT" suffix; "Carbon Ton Tokens earned" subtitle; "= {balance} tonnes of CO2 stored on your land" explanation line; "View on PolygonScan" `TouchableOpacity` calling `Linking.openURL('https://polygonscan.com/address/' + walletAddress)`; minimum 48×48 dp touch target on link
- [X] T009 [US1] Implement `pendingMint` "Minting in progress…" inline indicator in `src/features/dashboard/screens/HomeScreen.tsx` balance card area — rendered below the balance number only when `credits.pendingMint === true`; hidden otherwise
- [X] T010 [US1] Implement `credit_earned.json` Lottie celebration overlay in `src/features/dashboard/screens/HomeScreen.tsx` — track `pendingMint` and `balance` in `useRef`; trigger `showCelebration = true` only when `pendingMint` transitions `true → false` AND new `balance > prevBalance`; render `lottie-react-native` `LottieView` using `src/assets/lottie/credit_earned.json`; auto-dismiss via `onAnimationFinish` callback; does NOT play on cold launch with pre-existing balance
- [X] T011 [US1] Implement "Last updated [time]" staleness badge in `src/features/dashboard/screens/HomeScreen.tsx` — displayed when `lastFetchedAt` is non-null and the live `fetchCreditsThunk` is not currently pending; format `lastFetchedAt` ISO string as human-readable relative time (e.g., "Last updated 14 Mar 2026 09:31")

**Checkpoint**: US1 complete — balance card fully functional, offline badge works, celebration animation fires correctly.

---

## Phase 3: User Story 2 — Land Parcel List and Audit Status (Priority: P2)

**Goal**: Below the balance card on HomeScreen, farmer sees all registered parcels with colour-coded status and can launch an audit directly from an overdue parcel.

**Independent Test**: Pre-populate `land.parcels` with parcels having different `last_audit_year` values. Render HomeScreen — verify green/orange/red badge assignment, "Start Audit" button appears only on orange and red, tapping it navigates to `AuditStartScreen` with the correct `landId` and `landName`.

- [X] T012 [US2] Implement land parcel list section in `src/features/dashboard/screens/HomeScreen.tsx` — render `land.parcels` using `FlatList` or `ScrollView` / `map`; call `getLandStatus(parcel)` per card; use `thumbnail_url` in `<Image>` for satellite thumbnail; section is placed between balance card and history preview per Stitch layout
- [X] T013 [US2] Implement land parcel card inline in `src/features/dashboard/screens/HomeScreen.tsx` — satellite thumbnail (`<Image source={{uri: parcel.thumbnail_url}}`), `farm_name`, `area_hectares` with " ha" suffix, colour-coded status badge (`"✓ Verified"` on green, `"⏳ Pending"` on orange, `"⏳ Pending"` with red background on red); conditional "Start Audit" `TouchableOpacity` rendered only on orange/red cards — calls `navigation.navigate('AuditStartScreen', { landId: parcel.id, landName: parcel.farm_name })`; all touch targets ≥48×48 dp

**Checkpoint**: US2 complete — land cards with correct status colours and Start Audit CTA are functional.

---

## Phase 4: User Story 4 — Full Credit History Screen (Priority: P2)

**Goal**: CreditHistoryScreen shows the complete year-over-year audit history with bar chart and per-entry IPFS/PolygonScan deep links.

**Independent Test**: With 3+ `AuditRecord` entries spanning 2+ years in Redux state, render CreditHistoryScreen — bar chart shows one bar per year with correct heights; each entry displays land name, year, "+X.X CTT", "View Certificate" (opens device browser), truncated tx hash (opens PolygonScan). Offline: cached data shown with staleness badge. Empty state: message shown when `history` is empty.

> ⚡ **Parallel opportunity**: Phase 4 can run alongside Phase 3 — entirely different file.

- [X] T014 [US4] Design CreditHistoryScreen in Stitch MCP — call `generate_screen_from_text` with: back-arrow header, bar chart section, scrollable audit record list with year/CTT/certificate/tx fields, `spinning_leaf.json` loading state, "Last updated" offline badge, empty state; call `get_screen` → fetch download URL → retrieve HTML/CSS → confirm before coding
- [X] T015 [US4] Scaffold `src/features/dashboard/screens/CreditHistoryScreen.tsx` from Stitch HTML/CSS — NativeWind only; wire `useAppSelector` for `credits` (`history`, `lastFetchedAt`); dispatch `fetchCreditsThunk(walletAddress)` on mount; show `lottie-react-native` `LottieView` with `src/assets/lottie/spinning_leaf.json` while `fetchCreditsThunk` is in pending state (track via `useSelector` on thunk `requestStatus` or local `isLoading` state); no `StyleSheet.create`
- [X] T016 [P] [US4] Implement bar chart in `src/features/dashboard/screens/CreditHistoryScreen.tsx` — `useMemo` that groups `credits.history` by `audit_year` summing `credits_issued`, sorts years ascending, produces `{ labels: string[], datasets: [{ data: number[] }] }`; renders `react-native-chart-kit` `BarChart` with `fromZero: true`, `showBarTops: true`, `width: Dimensions.get('window').width - 32`, Roboto Mono axis font via `chartConfig.propsForLabels`; wrapped in `<View className="...">` for positioning
- [X] T017 [P] [US4] Implement audit record list in `src/features/dashboard/screens/CreditHistoryScreen.tsx` — `useMemo` sorts `credits.history` descending by `audit_year`; each row renders: `land_name`, `audit_year`, `"+" + credits_issued + " CTT"` in Roboto Mono font; "View Certificate" `TouchableOpacity` hidden when `ipfs_certificate_url` is falsy; truncated tx hash `"0x" + tx_hash.slice(2, 8) + "…" + tx_hash.slice(-4)` in `TouchableOpacity` hidden when `tx_hash` is falsy
- [X] T018 [US4] Wire `Linking.openURL` calls in `src/features/dashboard/screens/CreditHistoryScreen.tsx` — "View Certificate" tap calls `Linking.openURL(record.ipfs_certificate_url)`; tx hash tap calls `Linking.openURL('https://polygonscan.com/tx/' + record.tx_hash)`; both touch targets ≥48×48 dp; no WebView used
- [X] T019 [US4] Implement offline and empty states in `src/features/dashboard/screens/CreditHistoryScreen.tsx` — "Last updated [time]" badge rendered using `lastFetchedAt` when fetch is not in flight; empty state `<Text>` "No audits yet. Complete your first audit to see your history." shown when `history.length === 0` and not loading

**Checkpoint**: US4 complete — CreditHistoryScreen fully usable independently of HomeScreen.

---

## Phase 5: User Story 3 — Credit History Preview on Home Screen (Priority: P3)

**Goal**: Bottom of HomeScreen shows the 2 most recent audit entries as a compact preview with "View Certificate" and a link to CreditHistoryScreen.

**Independent Test**: With 2+ audit records in Redux, HomeScreen shows exactly the 2 most recent entries (sorted desc). "View Certificate" opens device browser. With only 1 record, only 1 entry is shown. "View All History →" navigates to CreditHistoryScreen.

- [X] T020 [US3] Implement credit history preview section in `src/features/dashboard/screens/HomeScreen.tsx` — `useMemo` selects last 2 entries from `credits.history` sorted descending by `audit_year`; each row renders: `audit_year`, `"+" + credits_issued + " CTT"` in Roboto Mono, "View Certificate" `TouchableOpacity` calling `Linking.openURL(record.ipfs_certificate_url)` hidden when `ipfs_certificate_url` is falsy; section is placed below land parcel list per Stitch layout; touch targets ≥48×48 dp
- [X] T021 [US3] Implement "View All History →" `TouchableOpacity` in `src/features/dashboard/screens/HomeScreen.tsx` credit history preview section — calls `navigation.navigate('CreditHistoryScreen')`; touch target ≥48×48 dp; rendered below the preview entries

**Checkpoint**: US3 complete — all four user stories are independently functional.

---

## Final Phase: Polish & Cross-Cutting Concerns

- [X] T022 [P] Constitution compliance sweep — confirm no `StyleSheet.create` in `HomeScreen.tsx` or `CreditHistoryScreen.tsx`; all CTT/biomass numerical values use Roboto Mono font class; all `TouchableOpacity` elements have `minHeight`/`minWidth` of 48; Lottie source paths reference exactly `src/assets/lottie/credit_earned.json` and `src/assets/lottie/spinning_leaf.json`; no `AuditCertificateScreen` added or referenced
- [X] T023 [P] TypeScript strict-mode validation — run `npx tsc --noEmit` from repo root and fix any type errors in `creditsSlice.ts`, `HomeScreen.tsx`, `CreditHistoryScreen.tsx`, and `getLandStatus.ts`; ensure `fetchCreditsThunk` is typed with `createAsyncThunk<void, string, { state: RootState }>`
- [ ] T024 Run the quickstart.md testing checklist — manually verify all 15 scenarios on emulator or physical device: balance display, blockchain primary/fallback, pendingMint animation, offline badge, certificate links, tx hash links, bar chart single/multi year, land status colours, Start Audit navigation, empty states, MMKV persistence across app kill

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: No dependencies — start immediately
  - T001 → T002 (sequential: T002 uses reducers from T001)
  - T003 [P]: independent of T001/T002 — may run concurrently
  - T004: after T002 (tests the thunk)
  - T005 [P]: after T003 (tests the utility) — runs alongside T004
- **US1 (Phase 2)**: Requires T001 + T002 complete; T006 must gate T007, T007 must gate T008–T011
- **US2 (Phase 3)**: Requires T003 (`getLandStatus`) and T007 (HomeScreen scaffold)
- **US4 (Phase 4)**: Requires T001 + T002 complete; T014 must gate T015, T015 must gate T016–T019
- **US3 (Phase 5)**: Requires T007 (HomeScreen scaffold) and T020 depends on the section layout from T007
- **Polish (Final)**: All prior user story phases complete

### User Story Dependencies

| Story | Priority | Depends On | Can Parallelise With |
|---|---|---|---|
| US1 — CTT Balance Card | P1 🎯 | Foundational Phase 1 | — |
| US2 — Land Parcel List | P2 | Foundational (T003), US1 scaffold (T007) | US4 (different additions to HomeScreen, same file — serialise) |
| US4 — CreditHistoryScreen | P2 | Foundational (T001, T002) | US2 (different file — fully parallel) |
| US3 — History Preview | P3 | US1 scaffold (T007) | US4 polish tasks |

### Parallel Opportunities

```
# Phase 1 — Foundational parallel tracks
Track A: T001 → T002 → T004
Track B: T003 → T005
(Tracks A and B can run in parallel from start)

# Phase 3 + Phase 4 — fully parallel (different files)
Track A: T012 → T013  (US2 — HomeScreen land list)
Track B: T014 → T015 → T016 [P] + T017 [P] → T018 → T019  (US4 — CreditHistoryScreen)

# Within Phase 4 — T016 + T017 in parallel (bar chart vs list, same file but non-overlapping sections)

# Final Phase — T022 + T023 in parallel (review vs compiler check)
```

---

## Implementation Strategy

### MVP Scope (US1 Only — 11 tasks)

Complete Phase 1 Foundational (T001–T005) → Phase 2 US1 (T006–T011).  
Result: Authenticated farmer sees their blockchain CTT balance, offline fallback, and minting celebration. HomeScreen is the app landing screen with working Redux wiring.

### Full Feature (All 24 tasks)

1. Phase 1: Foundational (T001–T005)
2. Phase 2: US1 Balance Card (T006–T011) — MVP
3. Phase 3: US2 Land List (T012–T013) **parallel** with Phase 4: US4 CreditHistoryScreen (T014–T019)
4. Phase 5: US3 History Preview (T020–T021)
5. Final: Polish (T022–T024)

---

## Task Summary

| Phase | Story | Tasks | Parallel Opportunities |
|---|---|---|---|
| Foundational | — | T001–T005 (5) | T003 alongside T001/T002; T005 alongside T004 |
| US1 (P1) 🎯 | Balance Card | T006–T011 (6) | T006 gates T007 gates rest |
| US2 (P2) | Land Parcel List | T012–T013 (2) | Phase 3 ‖ Phase 4 |
| US4 (P2) | CreditHistoryScreen | T014–T019 (6) | T016 ‖ T017 within phase |
| US3 (P3) | History Preview | T020–T021 (2) | — |
| Polish | — | T022–T024 (3) | T022 ‖ T023 |
| **Total** | | **24 tasks** | |
