# Tasks: Land Verification Module

**Input**: Design documents from `/specs/003-land-verification-module/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/api-contracts.md ✅, quickstart.md ✅

**Tests**: Unit tests for `landSlice` reducers and `units.ts` functions included per plan.md §Testing.
Integration test for `LandListScreen` included per plan.md Independent Test criteria.

**Organization**: Tasks are grouped by user story (US1–US4) to enable independent implementation and testing.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files / no blocking dependency)
- **[US\*]**: Which user story this task belongs to

---

## Phase 1: Setup

**Purpose**: Install new packages, verify utility functions, and confirm navigation types before any screen work begins.

- [ ] T001 Install react-native-document-picker and @react-native-community/netinfo via npm in repo root (`npm install react-native-document-picker @react-native-community/netinfo`)
- [ ] T002 [P] Implement `hectaresToAcres(h: number): number` and `sqmToHectares(sqm: number): number` in `src/common/utils/units.ts`
- [ ] T003 [P] Audit `BoundaryConfirmScreen` navigation params in `src/types/navigation.ts` — align with Redux `currentDraft` pattern from plan.md (screen reads `currentDraft` from Redux; simplify or remove redundant nav params if confirmed)

**Checkpoint**: Two new packages installed; unit conversion helpers present; navigation types consistent.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core Redux state fixes that MUST be complete before any land screen can be fully implemented.

**⚠️ CRITICAL**: All screen work depends on this phase being complete.

- [ ] T004 Fix `boundary_geojson: GeoJSONPolygon` → `GeoJSONPolygon | null` in `LandParcel`, add `lastSyncedAt: string | null` to `LandState`, and add `setLastSynced(state, action: PayloadAction<string>)` reducer + export in `src/features/land/store/landSlice.ts`
- [ ] T005 [P] Write Jest unit tests for all `landSlice` reducers (`setParcels`, `addParcel`, `setCurrentDraft`, `clearCurrentDraft`, `setLastSynced`) in `src/features/land/store/__tests__/landSlice.test.ts`
- [ ] T006 [P] Write Jest unit tests for `hectaresToAcres()` and `sqmToHectares()` in `src/common/utils/__tests__/units.test.ts` (verify `hectaresToAcres(1) === 2.471`, `sqmToHectares(10000) === 1`)

**Checkpoint**: Foundation ready — `npx tsc --noEmit` passes; user story screens can now be implemented.

---

## Phase 3: User Story 1 — View and Start Land Registration (Priority: P1) 🎯 MVP

**Goal**: Farmer can view their registered land parcels (or empty state) and tap "+" to begin registering a new parcel. This is the entry point to the entire land flow and the screen other modules (HomeScreen, AuditStartScreen) link back to.

**Independent Test**: Render `LandListScreen` with mocked Redux state containing zero, one, and three parcels. Verify: empty-state illustration appears with no parcels; parcel cards show farm name, area in acres (Roboto Mono), status badge, last audit date, and thumbnail; "Start Audit" button visible only on Verified parcels without current-year audit; "+" FAB navigates to `DocumentUploadScreen`. No backend call needed.

- [ ] T007 [US1] Generate `LandListScreen` design via Stitch MCP — call `generate_screen_from_text` with the LandListScreen spec, then call `get_screen` on the result to retrieve screen details and download URL, then fetch the HTML/CSS from the download URL
- [ ] T008 [US1] Implement `LandListScreen.tsx` UI from Stitch HTML/CSS — `<FlatList>` of parcel cards (farm name, area in acres in Roboto Mono, status badge with exact fixed strings `"✓ Verified"` / `"⏳ Pending"` / `"✗ Rejected"`, last audit year or `"No audit yet"`, `<Image>` Sentinel-2 thumbnail), empty-state illustration + "Add your first land parcel" CTA, floating "+" FAB at bottom-right, all touch targets ≥ 48×48px in `src/features/land/screens/LandListScreen.tsx`
- [ ] T009 [US1] Wire `LandListScreen.tsx` network + offline logic — call `GET /api/v1/land/list` on mount, dispatch `setParcels` + `setLastSynced` on success, render immediately from MMKV-persisted Redux (`land.parcels`) for < 200ms offline load (SC-004), show `"Last synced [time]"` in header when serving from cache, show offline banner when network call fails, show "Start Audit" button if `parcel.is_verified && parcel.last_audit_year !== currentYear`, navigate to `DocumentUploadScreen` on "+" tap in `src/features/land/screens/LandListScreen.tsx`
- [ ] T010 [P] [US1] Write RNTL integration test for `LandListScreen` with mocked Redux store (0 parcels → empty state, 1 verified parcel → card + "Start Audit", 3 mixed-status parcels → correct badge strings) in `src/features/land/screens/__tests__/LandListScreen.test.tsx`

**Checkpoint**: `LandListScreen` fully functional and independently testable. Offline load < 200ms from MMKV cache (SC-004). MVP deliverable confirmed.

---

## Phase 4: User Story 2 — Upload Document and OCR Extraction (Priority: P1)

**Goal**: Farmer photographs or picks their 7/12 Extract, the app sends it for OCR, and the extracted five fields (Survey Number, Owner Name, Village, Taluka, District) are displayed for confirmation before the boundary fetch is triggered.

**Independent Test**: Render `DocumentUploadScreen` with mocked `POST /api/v1/land/verify-document` returning a fixed `VerifyDocumentResponse`. Verify: camera and gallery modes open; loading state shows `"Reading your document…"` with `spinning_leaf.json`; OCR review card shows all five fields; "Try Again" resets screen; "This is correct — Continue" dispatches `setCurrentDraft` and triggers `fetch-boundary` (mocked to `status: 'success'`), navigating to `BoundaryConfirmScreen`.

- [ ] T011 [US2] Generate `DocumentUploadScreen` design via Stitch MCP — call `generate_screen_from_text` with the DocumentUploadScreen spec, then call `get_screen` to retrieve details and download URL, then fetch the HTML/CSS
- [ ] T012 [US2] Implement `DocumentUploadScreen.tsx` capture UI from Stitch HTML/CSS — "Take Photo" opens VisionCamera v4 (`Camera.takePhoto({ qualityPrioritization: 'speed', flash: 'off' })`), "Upload from Gallery" opens `DocumentPicker.pickSingle({ type: [types.images] })`, show error `"Camera access is needed to photograph your document"` + "Go to Settings" link on permission denial (CAMERA permission), validate file size ≤ 10 MB before upload (show `"Image is too large. Please take a clearer, smaller photo."` if over limit), all touch targets ≥ 48×48px in `src/features/land/screens/DocumentUploadScreen.tsx`
- [ ] T013 [US2] Implement `DocumentUploadScreen.tsx` preview + OCR flow — show image preview with overlay `"Make sure all text is clearly visible and the document is not tilted"` and "Confirm and Process" / "Retake" buttons; on "Confirm and Process" send `multipart/form-data` `POST /api/v1/land/verify-document` with `{ image: { uri, type, name } }`; display `Lottie spinning_leaf.json` with text `"Reading your document…"` during request; on 200 show 5-field OCR review card (Survey Number, Owner Name, Village, Taluka, District); "Try Again" dispatches `clearCurrentDraft()` and resets to initial upload state in `src/features/land/screens/DocumentUploadScreen.tsx`
- [ ] T014 [US2] Implement boundary fetch trigger in `DocumentUploadScreen.tsx` — on "This is correct — Continue", attempt GPS via `Geolocation.getCurrentPosition()` with 5 s timeout (best-effort, proceed without if unavailable per research D-005), dispatch `setCurrentDraft({ fetch_status: 'fetching' })`, call `GET /api/v1/land/fetch-boundary` with OCR fields + optional `user_lat`/`user_lng`, on `status: 'success'` dispatch `setCurrentDraft({ boundary, boundary_source, satellite_thumbnail_url, fetch_status: 'success' })` and navigate to `BoundaryConfirmScreen`; on `status: 'manual_required'` dispatch `setCurrentDraft({ fetch_status: 'manual_required' })` and navigate to `ManualUploadGuideScreen`; on error dispatch `setCurrentDraft({ fetch_status: 'error' })` and show retry toast in `src/features/land/screens/DocumentUploadScreen.tsx`
- [ ] T015 [US2] Implement offline and error states in `DocumentUploadScreen.tsx` — use `@react-native-community/netinfo` to check connectivity before upload; show offline banner and preserve photo preview in local component state (not Redux) if offline; on HTTP 422 show error `"Could not extract required fields. Image quality too low. Please retake photo."` with "Retake" button in `src/features/land/screens/DocumentUploadScreen.tsx`

**Checkpoint**: `DocumentUploadScreen` fully functional. Farmer can reach `BoundaryConfirmScreen` (success path) or `ManualUploadGuideScreen` (fallback path) from this screen.

---

## Phase 5: User Story 3 — Automatic Boundary Fetch and Confirmation (Priority: P1)

**Goal**: Farmer sees a full-screen Sentinel-2 satellite image with the GeoJSON polygon overlay, reviews parcel details in a bottom sheet, and either confirms (registering the parcel as Verified and returning to `LandListScreen`) or rejects (restarting the upload flow).

**Independent Test**: Render `BoundaryConfirmScreen` with mocked `land.currentDraft` containing a sample `boundary` GeoJSON, `satellite_thumbnail_url`, and `ocr_result`. Verify: satellite PNG renders as background; Polygon overlay appears; bottom sheet shows Survey Number, area in acres (Roboto Mono), Owner Name; "Confirm" triggers mocked `POST /api/v1/land/register` → dispatches `addParcel` + `clearCurrentDraft` → navigates to `LandListScreen`; "Try Again" clears draft + navigates to `DocumentUploadScreen`; HTTP 400 shows inline owner-name error; HTTP 409 shows duplicate parcel error.

- [ ] T016 [US3] Generate `BoundaryConfirmScreen` design via Stitch MCP — call `generate_screen_from_text` with the BoundaryConfirmScreen spec (full-screen satellite + polygon + bottom sheet), then call `get_screen` to retrieve details and download URL, then fetch the HTML/CSS
- [ ] T017 [US3] Implement `BoundaryConfirmScreen.tsx` map view from Stitch HTML/CSS — absolute-fill `<Image source={{ uri: currentDraft.satellite_thumbnail_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />` with green fallback background (`bg-green-100`) on load error (SC-003); `<MapView style={StyleSheet.absoluteFill} mapType="none" backgroundColor="transparent" region={computedRegion} scrollEnabled={false} zoomEnabled={false}>` with `<Polygon coordinates={...} fillColor="rgba(34,197,94,0.3)" strokeColor="rgba(34,197,94,0.9)" strokeWidth={2} />`; compute `region` from GeoJSON coordinate extremes + 30% padding per research D-003; `StyleSheet.absoluteFill` is the only permitted `StyleSheet` use (geometry constant, not layout) in `src/features/land/screens/BoundaryConfirmScreen.tsx`
- [ ] T018 [US3] Implement `BoundaryConfirmScreen.tsx` bottom sheet — use `<BottomSheet>` from `src/common/components/BottomSheet.tsx`; display Survey Number, area in acres (`hectaresToAcres(sqmToHectares(geojson.properties.area_sqm))` in Roboto Mono), Owner Name from `currentDraft.ocr_result`; primary button `"Yes, this is my land — Confirm"` (≥ 48×48px); destructive action `"This boundary is wrong — Report and Try Again"`; `registerError: string | null` local state for inline error display below buttons in `src/features/land/screens/BoundaryConfirmScreen.tsx`
- [ ] T019 [US3] Implement `POST /api/v1/land/register` flow in `BoundaryConfirmScreen.tsx` — build full request payload (`farm_name` defaults to `"Survey ${survey_number}"`, `geojson: { type: 'Feature', geometry: currentDraft.boundary, properties: {...} }`, `ocr_owner_name`, `boundary_source`); show `Lottie spinning_leaf.json` loading overlay during request; on HTTP 200 build `LandParcel` locally (set `created_at = new Date().toISOString()`, `thumbnail_url = currentDraft.satellite_thumbnail_url`, `status = 'verified'`, `is_verified = true`), dispatch `addParcel` + `clearCurrentDraft`, navigate to `LandListScreen`; on HTTP 400 set `registerError("The name on this document does not match your registered name. Please use the land document where you are listed as the owner.")`; on HTTP 409 set `registerError("This land parcel is already registered in your account.")`; on no-internet show offline banner without clearing draft in `src/features/land/screens/BoundaryConfirmScreen.tsx`

**Checkpoint**: Full primary registration flow end-to-end — document capture → OCR → boundary confirm → new Verified parcel on `LandListScreen`. SC-001 (< 3 min on 4G) achievable.

---

## Phase 6: User Story 4 — Manual Upload Fallback (Priority: P2)

**Goal**: When `GET /api/v1/land/fetch-boundary` returns `status: "manual_required"`, the farmer is guided step-by-step to download their government map and upload it, feeding back into the same OCR → boundary confirm pipeline.

**Independent Test**: Force `currentDraft.fetch_status === 'manual_required'` in mocked Redux state. Verify: all four step labels render; Step 1 tapping opens `bhunaksha.mahabhumi.gov.in` via `Linking.openURL`; upload button opens `DocumentPicker` and triggers the `verify-document` → `fetch-boundary` → `BoundaryConfirmScreen` flow (mocked); Back button navigates to `DocumentUploadScreen`. SC-007 satisfied.

- [ ] T020 [US4] Generate `ManualUploadGuideScreen` design via Stitch MCP — call `generate_screen_from_text` with the ManualUploadGuideScreen spec (4-step progress indicator + portal link + upload button), then call `get_screen` to retrieve details and download URL, then fetch the HTML/CSS
- [ ] T021 [P] [US4] Implement `ManualUploadGuideScreen.tsx` UI from Stitch HTML/CSS — 4 numbered progress steps with visual indicators; Step 1 `"Open bhunaksha.mahabhumi.gov.in"` as `<TouchableOpacity>` calling `Linking.openURL('https://bhunaksha.mahabhumi.gov.in')`; Steps 2–4 as static text; upload button at bottom opens `DocumentPicker.pickSingle({ type: [types.images] })`; "Back" button navigates to `DocumentUploadScreen` (FR-015); all touch targets ≥ 48×48px in `src/features/land/screens/ManualUploadGuideScreen.tsx`
- [ ] T022 [US4] Wire `ManualUploadGuideScreen.tsx` upload action — on file pick apply same 10 MB size guard, then call `POST /api/v1/land/verify-document` with `multipart/form-data`, show `spinning_leaf.json` `"Reading your document…"` loading, on OCR success dispatch `setCurrentDraft({ ocr_result })`, then call `GET /api/v1/land/fetch-boundary` (same GPS best-effort + dispatch pattern as `DocumentUploadScreen`), navigate to `BoundaryConfirmScreen` on success in `src/features/land/screens/ManualUploadGuideScreen.tsx`

**Checkpoint**: `ManualUploadGuideScreen` functional — 100% of farmers with failed auto-boundary are routed here and can complete registration (SC-007).

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: TypeScript validation, accessibility audit, and end-to-end quickstart verification.

- [ ] T023 [P] Run `npx tsc --noEmit`; resolve any TypeScript strict-mode errors in `src/features/land/` and `src/common/utils/units.ts` introduced during this feature (pay particular attention to `GeoJSONPolygon | null` usage and `LandParcel` construction sites)
- [ ] T024 [P] Audit all four land screens against design constraints — verify every interactive element ≥ 48×48px; verify Roboto Mono font applied to all numeric values (area in acres, survey numbers displayed as data); verify status badge strings exactly match `"✓ Verified"`, `"⏳ Pending"`, `"✗ Rejected"` with no variation
- [ ] T025 Run quickstart.md validation scenarios end-to-end — (a) offline `LandListScreen` loads in < 200ms from MMKV (SC-004); (b) empty state with zero parcels; (c) full registration flow from photo capture to Verified parcel on list; (d) `manual_required` routing to `ManualUploadGuideScreen` (SC-007); (e) Sentinel-2 PNG failure fallback on `BoundaryConfirmScreen` still shows polygon (SC-003)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately in parallel after branch checkout
- **Foundational (Phase 2)**: T001 must complete before T004 (slice fix needs packages installed for TS checks) — BLOCKS all screen work
- **US1 (Phase 3)**: Unblocked after Phase 2 — no dependency on US2/US3/US4
- **US2 (Phase 4)**: Unblocked after Phase 2 — no dependency on US1 (but logically flows after US1 in UX)
- **US3 (Phase 5)**: Depends on US2 completing (BoundaryConfirmScreen receives navigation trigger from DocumentUploadScreen)
- **US4 (Phase 6)**: Depends on US2 completing (ManualUploadGuideScreen shares the same upload pipeline); can proceed in parallel with US3
- **Polish (Phase 7)**: All user story phases must be complete

### User Story Dependencies

| Story | Depends On | Can Parallel With |
|-------|-----------|-------------------|
| US1 (LandListScreen) | Phase 2 complete | US2 (different files) |
| US2 (DocumentUploadScreen) | Phase 2 complete | US1 (different files) |
| US3 (BoundaryConfirmScreen) | US2 complete | US4 (different files) |
| US4 (ManualUploadGuideScreen) | US2 complete | US3 (different files) |

### Within Each User Story

- Stitch design task (T007, T011, T016, T020) must complete before implementation tasks
- UI implementation tasks before API wiring tasks
- API wiring before offline/error state tasks
- All story tasks complete before moving to next phase

### Parallel Opportunities

| When | What can run in parallel |
|------|--------------------------|
| Phase 1 | T002 and T003 |
| Phase 2 | T005 and T006 (after T004 lands) |
| Phase 3+4 | T007–T010 (US1) and T011–T015 (US2) simultaneously with different engineers |
| Phase 5+6 | T016–T019 (US3) and T020–T022 (US4) simultaneously after US2 completes |
| Phase 7 | T023 and T024 simultaneously |

---

## Implementation Strategy

**MVP scope** (minimum viable: US1 + US2 + US3):
Complete Phases 1–5 (T001–T019) for a fully functional primary land registration path.
US4 (manual fallback) can be deferred to a follow-up sprint if time-boxed.

**Suggested execution order (single engineer)**:
T001 → T002+T003 (parallel) → T004 → T005+T006 (parallel) → T007 → T008 → T009 → T010 → T011 → T012 → T013 → T014 → T015 → T016 → T017 → T018 → T019 → T020 → T021 → T022 → T023+T024 (parallel) → T025

**Total tasks**: 25 (T001–T025)
**Per story**: US1 = 4, US2 = 5, US3 = 4, US4 = 3, Setup = 3, Foundational = 3, Polish = 3
