# Quickstart: Land Verification Module

**Feature**: `003-land-verification-module`  
**Branch**: `003-land-verification-module`  
**Generated**: 2026-03-21  
**Prerequisites**: Feature 002 (auth-kyc-screens) merged — farmer is authenticated
and KYC-completed before entering this flow.

---

## New Dependencies to Install

Before implementing screens, install the two new packages identified in research:

```powershell
# From repo root — run in pwsh
npm install react-native-document-picker @react-native-community/netinfo
```

After install, for Android you may need:

```powershell
cd android; ./gradlew clean; cd ..
```

> `react-native-document-picker` — gallery/file picker (NOT react-native-image-picker)  
> `@react-native-community/netinfo` — live connectivity detection for offline banner

---

## File Inventory

### Modified (already scaffolded — minor change only)

| File                                      | Change                                          |
| ----------------------------------------- | ----------------------------------------------- |
| `src/features/land/store/landSlice.ts`   | `boundary_geojson: GeoJSONPolygon \| null`       |

### Implemented (placeholder stubs → full screens)

| File                                                             | Screen                    |
| ---------------------------------------------------------------- | ------------------------- |
| `src/features/land/screens/LandListScreen.tsx`                  | Land parcel list          |
| `src/features/land/screens/DocumentUploadScreen.tsx`            | Document capture + OCR    |
| `src/features/land/screens/BoundaryConfirmScreen.tsx`           | Satellite + polygon confirm |
| `src/features/land/screens/ManualUploadGuideScreen.tsx`         | Manual 4-step guide       |

### Verified (no changes expected)

| File                                                | Status                  |
| --------------------------------------------------- | ----------------------- |
| `src/store/index.ts`                                | `land.currentDraft` blacklisted ✅; `land.parcels` persisted ✅ |
| `src/services/api.ts`                               | 60s timeout, JWT interceptor, 401/500 handlers ✅ |
| `src/common/utils/units.ts`                         | `hectaresToAcres()` must exist |
| `src/types/navigation.ts`                           | Must include LandList, DocumentUpload, BoundaryConfirm, ManualUploadGuide params |

---

## Implementation Order

Work through screens in this dependency order — each step can be independently
tested before the next begins.

### Step 1 — Fix type gap in `landSlice.ts` (5 min)

**File**: `src/features/land/store/landSlice.ts`

Change `boundary_geojson: GeoJSONPolygon` → `boundary_geojson: GeoJSONPolygon | null`
in the `LandParcel` interface. This unblocks correct TypeScript compilation when
constructing parcels from the list API response.

Verify: `npx tsc --noEmit` passes.

---

### Step 2 — `LandListScreen` (P1)

**File**: `src/features/land/screens/LandListScreen.tsx`

**Stitch MCP**: Generate the design then implement from HTML/CSS output.

**Key requirements**:
- On mount: call `GET /api/v1/land/list`; on success dispatch `setParcels(merged)`.
- **Offline-first**: Use MMKV-persisted `land.parcels` from Redux for immediate
  render (< 200 ms offline read — SC-004). Show "Last synced [time]" in header
  if data is from cache.
- Each parcel card shows:
  - Farm name
  - Area in acres: `hectaresToAcres(parcel.area_hectares)` — Roboto Mono font
  - Status badge with **exact** fixed strings: `"✓ Verified"`, `"⏳ Pending"`, `"✗ Rejected"`
  - Last audit date (from `last_audit_year`, null displays `"No audit yet"`)
  - **Sentinel-2 thumbnail**: `<Image source={{ uri: parcel.thumbnail_url }} />` —
    static Image component only, no map component (constitution Map Rules).
  - "Start Audit" button if `parcel.is_verified && parcel.last_audit_year !== currentYear`
- **Empty state**: illustration + "Add your first land parcel" CTA (FR-003)
- **Floating "+" button** at bottom-right to navigate to `DocumentUploadScreen`
- `<FlatList>` for performance on 10+ parcels
- Offline banner when network call fails (`!error.response`)

**Satellite thumbnail caching**: The `<Image>` component uses Android Fresco disk cache
automatically. The `thumbnail_url` value itself is cached in MMKV via `land.parcels`
persistence. No extra caching logic needed in LandListScreen.

---

### Step 3 — `DocumentUploadScreen` (P1)

**File**: `src/features/land/screens/DocumentUploadScreen.tsx`

**Stitch MCP**: Generate design then implement from HTML/CSS output.

**Key requirements**:
- **Two capture methods**:
  1. "Take Photo" → open `react-native-vision-camera` v4 camera in full-screen.
     `Camera.takePhoto({ qualityPrioritization: 'speed', flash: 'off' })`.
  2. "Upload from Gallery" → `DocumentPicker.pickSingle({ type: [types.images] })`.
- **File size guard** (FR pre-upload, spec Edge Cases):
  - Camera: `fetch('file://' + photo.path).then(r => r.blob()).then(b => b.size)`
  - Gallery: `result.size` from document picker result
  - If > 10 MB: show `"Image is too large. Please take a clearer, smaller photo."`
- **Camera permission denied**: show `"Camera access is needed to photograph your document"` + "Go to Settings" link (spec edge case).
- **Preview + overlay**: After capture, show image preview with instruction overlay
  `"Make sure all text is clearly visible and the document is not tilted"` and
  `"Confirm and Process"` / `"Retake"` buttons.
- **Upload (Confirm and Process)**:
  - `Lottie spinning_leaf.json` with text `"Reading your document…"`
  - Send via multipart/form-data to `POST /api/v1/land/verify-document` (see contracts)
  - On success: display 5-field OCR review card with
    `"This is correct — Continue"` and `"Try Again"` buttons
  - On `"Try Again"`: `dispatch(clearCurrentDraft())`; reset screen to initial state
- **"This is correct — Continue"**:
  1. Attempt GPS acquisition (5s timeout, best-effort)
  2. `dispatch(setCurrentDraft({ fetch_status: 'fetching' }))`
  3. Call `GET /api/v1/land/fetch-boundary` with OCR fields + optional GPS
  4. On `status: 'success'` → navigate to `BoundaryConfirmScreen`
  5. On `status: 'manual_required'` → navigate to `ManualUploadGuideScreen`
- **Offline**: Check connectivity before upload. Show offline banner. Preserve photo
  preview in local state (not Redux — draft is screen-local until OCR succeeds).
- **422 error**: show `"Could not extract required fields. Image quality too low. Please retake photo."` — display `"Retake"` button.

---

### Step 4 — `BoundaryConfirmScreen` (P1)

**File**: `src/features/land/screens/BoundaryConfirmScreen.tsx`

**Stitch MCP**: Generate design then implement from HTML/CSS output.

**Key requirements**:
- **Full-screen satellite image**: Absolute-fill `<Image>` with
  `source={{ uri: currentDraft.satellite_thumbnail_url }}` (research D-003).
- **Fallback if PNG fails to load**: Plain colour background (e.g., `bg-green-100`)
  so the polygon overlay remains visible (spec edge case SC-003 + FDD).
- **MapView overlay**: `<MapView mapType="none" region={computedRegion}>` with
  `<Polygon>` from `currentDraft.boundary.coordinates`. Region is computed from
  GeoJSON bounding box + 30% padding (research D-003 pattern).
- **Bottom sheet** (`<BottomSheet>` from `src/common/components/BottomSheet.tsx`):
  - Survey Number: `currentDraft.ocr_result.survey_number`
  - Area in acres: `hectaresToAcres(sqmToHectares(geojson.properties.area_sqm))`
    displayed in Roboto Mono
  - Owner Name: `currentDraft.ocr_result.owner_name`
  - **Primary button**: `"Yes, this is my land — Confirm"` (min 48×48px)
  - **Destructive action**: `"This boundary is wrong — Report and Try Again"`
  - **Inline error area**: `registerError: string | null` local state for 400/409. 
- **"Confirm" tap flow**:
  1. Show `Lottie spinning_leaf.json` loading overlay
  2. Call `POST /api/v1/land/register` (see contracts — full payload)
  3. On 200: build `LandParcel`, `dispatch(addParcel())`, `dispatch(clearCurrentDraft())`,
     navigate back to `LandListScreen`
  4. On 400: `setRegisterError(spec_display_string)` (research D-004)
  5. On 409: `setRegisterError("This land parcel is already registered in your account.")`
- **"Try Again" tap**: `dispatch(clearCurrentDraft())`; `navigation.navigate('DocumentUploadScreen')`
- **No internet during confirm**: show offline banner; do NOT clear draft.

---

### Step 5 — `ManualUploadGuideScreen` (P2)

**File**: `src/features/land/screens/ManualUploadGuideScreen.tsx`

**Stitch MCP**: Generate design then implement from HTML/CSS output.

**Key requirements**:
- **Shown only when**: `currentDraft.fetch_status === 'manual_required'`
- **4 steps** (spec FR-015, User Story 4):
  1. `"Open bhunaksha.mahabhumi.gov.in"` — `<TouchableOpacity>` that calls
     `Linking.openURL('https://bhunaksha.mahabhumi.gov.in')` (uses
     `bhunaksha.mahabhumi.gov.in` as default Maharashtra URL; spec assumption)
  2. `"Select your District, Taluka, Village from the menus"`
  3. `"Find your Survey Number and tap Download"`
  4. `"Come back here and upload the downloaded image"`
- **Upload button** at bottom: Opens `DocumentPicker.pickSingle({ type: [types.images] })`.
  On pick → same `verify-document` → `fetch-boundary` → `BoundaryConfirmScreen`
  pipeline as DocumentUploadScreen. Re-use the upload logic from DocumentUploadScreen.
- **"Back" button**: Navigate back to `DocumentUploadScreen` (FR-015, User Story 4 §4).
- **Progress indicator**: 4 numbered steps with visual progress dots.

---

### Step 6 — Navigation Stack Verification

**File**: `src/types/navigation.ts` (update param types if missing)

Verify or add the following route definitions:

```typescript
export type LandStackParamList = {
  LandListScreen: undefined;
  DocumentUploadScreen: undefined;
  BoundaryConfirmScreen: undefined;
  ManualUploadGuideScreen: undefined;
};
```

All screens in this module use no route params — state flows via Redux `currentDraft`.

---

## Testing Notes

| Story          | Testable without backend? | Mock approach                            |
| -------------- | -------------------------- | ---------------------------------------- |
| Story 1        | ✅ Yes                     | Mock `setParcels()` with fixture parcels |
| Story 2        | ✅ Partially               | Mock `verify-document` with fixture OCR  |
| Story 3        | ✅ Yes                     | Mock `fetch-boundary` + `register`       |
| Story 4        | ✅ Yes                     | Force `status: 'manual_required'`        |

**Unit tests** (Jest):
- `landSlice` reducers: `setParcels`, `addParcel`, `setCurrentDraft`, `clearCurrentDraft`
- `hectaresToAcres` utility
- Boundary box computation from GeoJSON coordinates

**Component tests** (RNTL):
- LandListScreen: empty state render, parcel card render, "Start Audit" button visibility
- BoundaryConfirmScreen: owner mismatch error display, confirm button disabled during loading

---

## Key Constraints Reminder

| Constraint                              | Implementation Note                                                   |
| --------------------------------------- | --------------------------------------------------------------------- |
| LandListScreen thumbnails: `<Image>` only | No map component. `<Image source={{ uri: thumbnail_url }}>` only.  |
| BoundaryConfirmScreen: no Google Maps tiles | `mapType="none"` + PNG background + Polygon overlay only.        |
| `land.currentDraft` NOT in MMKV         | Already blacklisted in `store/index.ts`. Do not add it.               |
| `land.parcels` persisted               | Already configured. `setParcels()` triggers MMKV write automatically. |
| `satellite_thumbnail_url` caching       | URL stored via `land.parcels[].thumbnail_url` in MMKV.               |
| Status badge strings                    | MUST be exact: `"✓ Verified"`, `"⏳ Pending"`, `"✗ Rejected"`.       |
| Area display                            | Roboto Mono font on numeric values.                                   |
| Touch targets                           | All buttons ≥ 48×48 px.                                               |
| Stitch MCP                              | Design each screen in Stitch before writing any JSX.                  |
