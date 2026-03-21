# Feature Specification: Land Verification Module

**Feature Branch**: `003-land-verification-module`  
**Created**: 2026-03-21  
**Status**: Draft  
**Input**: User description: "Land verification module. Build LandListScreen, DocumentUploadScreen, BoundaryConfirmScreen, ManualUploadGuideScreen. landSlice with currentDraft state. API calls to POST /api/v1/land/verify-document, GET /api/v1/land/fetch-boundary, POST /api/v1/land/register, GET /api/v1/land/list. Frontend only."

## Overview

The Land Verification Module establishes a farmer's legal ownership of a land parcel before any carbon credit audit can begin. It transforms a paper government land document (7/12 Extract or Record of Rights) into a verified digital boundary stored in the system. This boundary becomes the immutable spatial boundary that gates all future satellite analysis and AR tree scanning.

The module covers the complete front-end journey: viewing registered parcels, submitting a document for automated boundary extraction, visually confirming the boundary on a satellite image, and falling back to a guided manual upload when automated extraction is unavailable. All verified parcels are stored in Redux and persisted locally, allowing offline viewing.

---

## User Scenarios & Testing _(mandatory)_

### User Story 1 - View and Start Land Registration (Priority: P1)

A KYC-completed farmer opens the app and arrives at LandListScreen. They see all their previously registered land parcels (or an empty state encouraging them to add their first parcel). They tap the "+" button to begin registering a new parcel, which takes them to DocumentUploadScreen.

**Why this priority**: Without the ability to navigate to and from LandListScreen, no other story in this module can be reached. It is the entry point to the entire land flow and is also the screen other modules (HomeScreen, AuditStartScreen) link back to.

**Independent Test**: Can be tested by rendering LandListScreen with mocked Redux state containing zero, one, and three parcels. Delivers a usable read-only land dashboard before any upload functionality exists.

**Acceptance Scenarios**:

1. **Given** the farmer is authenticated and has no registered parcels, **When** LandListScreen loads, **Then** an empty-state illustration and "Add your first land parcel" call-to-action are displayed.
2. **Given** the farmer has two registered parcels, **When** LandListScreen loads, **Then** each parcel is shown as a card with farm name, area in acres, status badge (Verified/Pending/Rejected), last audit date, and a cached Sentinel-2 satellite thumbnail.
3. **Given** a parcel has status "Verified" and no audit for the current year, **When** the farmer views its card, **Then** a "Start Audit" button is visible and tappable on that card.
4. **Given** LandListScreen is loaded, **When** the farmer taps the "+" floating button, **Then** navigation to DocumentUploadScreen occurs.

---

### User Story 2 - Upload Document and Receive OCR Extraction (Priority: P1)

A farmer on DocumentUploadScreen takes a photo of their 7/12 Extract or uploads one from gallery. The app sends the image to the backend. While waiting, a loading state is shown. On success, the extracted fields (Survey Number, Owner Name, Village, Taluka, District) are displayed for the farmer to review and confirm before proceeding.

**Why this priority**: Document upload and OCR extraction is the trigger for the entire automated boundary pipeline. Nothing downstream (boundary fetch, registration) can happen without the extracted survey number and location fields.

**Independent Test**: Can be tested end-to-end with a real or mock backend that returns a fixed OCR result. Delivers confirmed extracted fields the farmer can verify, even before boundary fetch is wired.

**Acceptance Scenarios**:

1. **Given** the farmer is on DocumentUploadScreen, **When** they tap "Take Photo", **Then** the camera opens via react-native-vision-camera for high-quality capture.
2. **Given** the farmer is on DocumentUploadScreen, **When** they tap "Upload from Gallery", **Then** the device gallery picker opens.
3. **Given** a photo has been captured or selected, **When** the farmer taps "Confirm and Process", **Then** a loading state appears with the text "Reading your document…" and the image is sent to `POST /api/v1/land/verify-document`.
4. **Given** the backend returns extracted fields successfully, **When** the app receives the response, **Then** Survey Number, Owner Name, Village, Taluka, and District are displayed in a review card with "This is correct — Continue" and "Try Again" buttons.
5. **Given** the extracted owner name does not match the farmer's KYC name (as reported by the backend on a later call), **When** the error is returned during registration, **Then** a red error message is shown: "The name on this document does not match your registered name. Please use the land document where you are listed as the owner."
6. **Given** the farmer taps "Try Again", **When** the action fires, **Then** the current draft is cleared and the screen resets to the initial upload state.

---

### User Story 3 - Automatic Boundary Fetch and Confirmation (Priority: P1)

After the farmer confirms the OCR-extracted fields, the app automatically fetches the official government boundary polygon from the backend. On success, BoundaryConfirmScreen shows a full-screen Sentinel-2 satellite image of the farm with the polygon drawn on top. The farmer reviews the boundary information card and either confirms (registering the parcel) or rejects (restarting the upload flow).

**Why this priority**: This is the primary happy-path completion of the module and the step that produces the verified boundary stored in the system. It delivers the highest user value — official boundary without manual drawing.

**Independent Test**: Can be tested with mocked `GET /api/v1/land/fetch-boundary` and `POST /api/v1/land/register` responses. Delivers a complete first-time land registration flow from capture to confirmed parcel.

**Acceptance Scenarios**:

1. **Given** the farmer confirms OCR fields, **When** the app calls `GET /api/v1/land/fetch-boundary`, **Then** a loading indicator is shown with "Fetching your land boundary…" text.
2. **Given** the boundary fetch returns `status: "success"`, **When** BoundaryConfirmScreen renders, **Then** the Sentinel-2 PNG is displayed as the background with `mapType="none"` and the GeoJSON polygon is overlaid as a semi-transparent green shape.
3. **Given** BoundaryConfirmScreen is shown, **When** the farmer views the bottom information card, **Then** Survey Number, Area in acres (calculated from polygon), and Owner Name are all visible.
4. **Given** the farmer taps "Yes, this is my land — Confirm", **When** the app calls `POST /api/v1/land/register` and it succeeds, **Then** the new parcel is added to the Redux `land.parcels` array with status "Verified", `land.currentDraft` is cleared, and the farmer is navigated back to LandListScreen where the new parcel appears.
5. **Given** the farmer taps "This boundary is wrong — Report and Try Again", **When** the action fires, **Then** `land.currentDraft` is cleared and the farmer is navigated back to DocumentUploadScreen.
6. **Given** `POST /api/v1/land/register` returns HTTP 409 (duplicate survey number), **When** the error is received, **Then** an error message is shown: "This land parcel is already registered in your account."

---

### User Story 4 - Manual Upload Fallback (Priority: P2)

When both Layer 1 (WMS) and Layer 2 (scraping) boundary fetch methods fail, the backend returns `status: "manual_required"`. The app navigates to ManualUploadGuideScreen, which shows a four-step progress indicator guiding the farmer to download their own map from the government portal and upload it. After upload, the same confirmation flow as Story 3 occurs.

**Why this priority**: Automated boundary fetch covers the majority of Maharashtra parcels but will fail for some states, downed portals, or undigitised rural areas. Without this fallback, a significant portion of Indian farmers would be blocked from registering land at all.

**Independent Test**: Can be tested by forcing `status: "manual_required"` in a mock fetch-boundary response and verifying ManualUploadGuideScreen renders with all four steps and that a file upload triggers the same `POST /api/v1/land/verify-document` → `POST /api/v1/land/register` pipeline.

**Acceptance Scenarios**:

1. **Given** `GET /api/v1/land/fetch-boundary` returns `{ status: "manual_required" }`, **When** the app receives the response, **Then** navigation to ManualUploadGuideScreen occurs automatically.
2. **Given** the farmer is on ManualUploadGuideScreen, **When** the screen renders, **Then** four sequential steps are shown:
   - Step 1: "Open bhunaksha.mahabhumi.gov.in" (tappable link)
   - Step 2: "Select your District, Taluka, Village from the menus"
   - Step 3: "Find your Survey Number and tap Download"
   - Step 4: "Come back here and upload the downloaded image"
3. **Given** the farmer taps the upload button on ManualUploadGuideScreen, **When** they select a map image from gallery, **Then** the image is submitted to the same `POST /api/v1/land/verify-document` endpoint and the same boundary confirmation flow continues.
4. **Given** the farmer is on ManualUploadGuideScreen, **When** they tap "Back", **Then** they are returned to DocumentUploadScreen.

---

### Edge Cases

- What happens when the device has no internet during document upload? The app must surface an offline banner and not lose any data the farmer has already entered. The draft is preserved in Redux but not submitted.
- What happens when the camera permission is denied? The app must show an error message explaining that camera access is needed and offer a "Go to Settings" link.
- What happens when the uploaded image file exceeds 10 MB? The app must show a validation error before attempting the upload: "Image is too large. Please take a clearer, smaller photo."
- What happens if `GET /api/v1/land/list` fails on LandListScreen load? The cached `land.parcels` from MMKV must be shown with a "Last synced [time]" indicator.
- What happens if the Sentinel-2 PNG URL fails to load on BoundaryConfirmScreen? A plain-colour fallback background must be shown with the GeoJSON polygon still visible so the farmer can still confirm or reject.
- What happens if the farmer has already registered 10+ parcels? The list must remain scrollable and performant; no hard cap is enforced on the frontend.

---

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The app MUST display all of the farmer's registered land parcels on LandListScreen, loaded via `GET /api/v1/land/list`, with farm name, area in acres, status badge, last audit date, and a Sentinel-2 satellite thumbnail per parcel.
- **FR-002**: LandListScreen MUST show a "Start Audit" button on any parcel card where the parcel is Verified and no audit has been completed for the current year.
- **FR-003**: LandListScreen MUST show an empty-state view (illustration + call-to-action) when the farmer has no registered parcels.
- **FR-004**: LandListScreen MUST persist the fetched parcel list in `land.parcels` via MMKV so the list is viewable offline with a "Last synced" indicator.
- **FR-005**: DocumentUploadScreen MUST accept document capture via react-native-vision-camera and via gallery picker.
- **FR-006**: DocumentUploadScreen MUST show a capture preview with the overlay instruction "Make sure all text is clearly visible and the document is not tilted" before processing.
- **FR-007**: The app MUST send the captured image as a base64 string to `POST /api/v1/land/verify-document` and show a loading state ("Reading your document…") during the request.
- **FR-008**: On successful OCR, DocumentUploadScreen MUST display all five extracted fields (Survey Number, Owner Name, Village, Taluka, District) in a review card with "This is correct — Continue" and "Try Again" actions.
- **FR-009**: On "This is correct — Continue", the app MUST automatically call `GET /api/v1/land/fetch-boundary` with the extracted fields plus the farmer's current GPS coordinates, storing the in-progress state in `land.currentDraft`.
- **FR-010**: BoundaryConfirmScreen MUST render the Sentinel-2 PNG received from the backend as the map background (`mapType="none"`) with the GeoJSON polygon drawn on top as a semi-transparent green overlay.
- **FR-011**: BoundaryConfirmScreen MUST show a bottom sheet with Survey Number, area in acres (from GeoJSON), and Owner Name, plus the "Yes, this is my land — Confirm" (primary) and "This boundary is wrong — Report and Try Again" (destructive) actions.
- **FR-012**: On boundary confirmation, the app MUST call `POST /api/v1/land/register` with all required fields and, on success, navigate to LandListScreen with the new parcel reflected as Verified.
- **FR-013**: On successful registration, `land.currentDraft` MUST be cleared from Redux (and MUST NOT be persisted to MMKV).
- **FR-014**: When `GET /api/v1/land/fetch-boundary` returns `{ status: "manual_required" }`, the app MUST navigate to ManualUploadGuideScreen.
- **FR-015**: ManualUploadGuideScreen MUST display a four-step progress indicator with step-by-step guide text and tappable government portal link, plus an upload button at the bottom.
- **FR-016**: ManualUploadGuideScreen's upload action MUST feed into the same OCR and boundary confirmation pipeline as the primary flow.
- **FR-017**: `landSlice` MUST manage: `parcels: LandParcel[]`, `currentDraft.ocrResult`, `currentDraft.boundary`, and `currentDraft.fetchStatus` (`'idle' | 'fetching' | 'success' | 'manual_required' | 'error'`).
- **FR-018**: `land.parcels` MUST be persisted to MMKV. `land.currentDraft` MUST NOT be persisted.
- **FR-019**: All API calls in this module MUST use the central Axios instance from `services/api.ts` which auto-attaches the Supabase JWT.
- **FR-020**: If the device has no internet connection when a network call is attempted, the app MUST show an offline banner and preserve any captured/entered data in the current draft.

### Key Entities

- **LandParcel**: A verified land holding registered to a farmer. Key attributes: `id` (UUID), `farm_name`, `survey_number`, `area_hectares`, `is_verified`, `last_audit_year`, `thumbnail_url`, `status` (Verified/Pending/Rejected).
- **LandDraft**: Transient state for a registration in progress. Contains `ocrResult` (five extracted fields + state + confidence), `boundary` (GeoJSON polygon or null), and `fetchStatus`. Only lives in Redux; never persisted.
- **OCRResult**: The five location identifiers extracted from the document: `surveyNumber`, `ownerName`, `village`, `taluka`, `district`, `state`, `extraction_confidence`.
- **BoundaryFetchResponse**: Backend response after boundary lookup, containing `status`, `boundary_source` (`WMS_AUTO` | `SCRAPE` | `MANUAL`), `geojson`, and `satellite_thumbnail_url`.

---

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A farmer with a valid 7/12 Extract photo can complete land registration (from DocumentUploadScreen to a Verified parcel appearing on LandListScreen) in under 3 minutes on a standard 4G connection.
- **SC-002**: OCR field extraction correctly populates all five fields without requiring manual correction for at least 90% of clearly photographed 7/12 documents (measured against a test set of 20 real documents).
- **SC-003**: The Sentinel-2 satellite background on BoundaryConfirmScreen loads and renders correctly for 100% of completed boundary fetches — the farmer never sees a blank screen at this step.
- **SC-004**: The land parcel list loads from local cache within 200ms when the device is offline, showing all previously synced parcels without a network call.
- **SC-005**: No farmer personal data (Aadhaar plain text, full document image beyond the upload step) is retained in Redux state, MMKV, or logs at any point during or after the registration flow.
- **SC-006**: On a Tier-3 device (low-end Android, no ARCore), the complete land verification flow completes without crashes or degraded functionality — only the camera capture library differs; all other steps are identical.
- **SC-007**: When both Layer 1 and Layer 2 boundary fetch fail, 100% of farmers are routed to ManualUploadGuideScreen with the four-step instructions visible and the upload button functional.

---

## Assumptions

- The backend is responsible for all OCR, boundary fetching (all three layers), name fuzzy-matching, and area calculation. The frontend sends data and displays results — no document processing occurs on-device.
- The farmer is already authenticated (Supabase JWT present) and KYC-completed before entering this module. The auth guard is handled by the navigation stack set up in the Auth/KYC feature (002).
- `GET /api/v1/land/fetch-boundary` is called automatically after OCR confirmation, not via an explicit farmer tap. The farmer sees a loading state but does not initiate the boundary fetch manually.
- The `satellite_thumbnail_url` returned by `GET /api/v1/land/list` points to a GEE-generated Sentinel-2 PNG. The app fetches it once, displays it, and caches it within the parcel record for offline viewing.
- Image capture size must be validated client-side (≤ 10 MB) before upload to avoid server-side rejection without user feedback.
- The `area_hectares` to acres conversion (1 hectare = 2.471 acres) is handled in the frontend display layer using `common/utils/units.ts`.
- The government portal URL shown in ManualUploadGuideScreen is `bhunaksha.mahabhumi.gov.in` for Maharashtra. The backend may return a `portal_url` field for other states in future iterations; for now the Maharashtra URL is used as default.
- GPS coordinates for `GET /api/v1/land/fetch-boundary` are obtained from react-native-geolocation-service at the moment the farmer confirms OCR fields. A best-effort reading is used; if GPS is unavailable, the call proceeds without coordinates (backend handles the missing param gracefully per BSDD).

---

## Out of Scope

- Manual polygon drawing (Draw Mode / Walk Mode) — explicitly removed per SRS §6.1 and FDD §4.2.
- Multi-owner / joint land parcels — single owner per parcel at MVP.
- Editing a registered parcel boundary after verification — not supported; farmer must contact support.
- Deleting a registered parcel from the app — admin operation only.
- Any backend logic (OCR engine, WMS calls, GEE PNG generation, fuzzy name matching, PostGIS storage) — frontend only per feature scope.

