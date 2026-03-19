<!--
SYNC IMPACT REPORT
==================
Version change:    N/A → 1.0.0 (initial ratification from blank template)
Templates updated:
  - .specify/templates/plan-template.md  ✅ (Constitution Check gates filled)
  - .specify/templates/spec-template.md  ✅ (SRS hierarchy note + constraints callout)
  - .specify/templates/tasks-template.md ✅ (Mobile path conventions updated)
Modified principles:  N/A (first version)
Added sections:       Core Principles (I–VII), Technology Constraints,
                      Development Workflow, Governance
Removed sections:     N/A
Deferred TODOs:       None — all fields resolved from project documents
-->

# TerraTrust-AR Constitution

## Core Principles

### I. Frontend-Only Scope (NON-NEGOTIABLE)

This workspace builds ONLY the React Native Android frontend.

- No Python, FastAPI, Celery, Solidity, GEE, or any backend code is
  ever written here.
- The BSDD (`TerraTrust_Backend_System_Design_v3.1.txt`) is READ-ONLY
  reference material for API shapes, request/response types, and data
  contracts. It is NEVER a build target.
- When the SRS (`SRS_TerraTrust_v3.1.txt`) and the FDD
  (`TerraTrust_Frontend_Design_Document_v3.1.txt`) conflict, **SRS wins**.
- Every API call, request body, response shape, and data type MUST match
  the SRS exactly. Never guess at a contract — read the source files first.
- Out-of-scope for v1: carbon credit trading, market pricing engine,
  buyer-facing web dashboard.

**Rationale**: Carbon credit verification requires tamper-proof, auditable
evidence. Any deviation from the specified backend contract corrupts the
verification pipeline and can void issued credits.

### II. Security-First (NON-NEGOTIABLE)

- **Private key**: MUST reside ONLY in `react-native-keychain`
  (Android Keystore hardware-backed encryption). It MUST NEVER appear in
  Redux state, MMKV, AsyncStorage, console logs, error reports, or any
  network payload — in any form.
- **Aadhaar**: MUST be SHA-256 hashed before any storage, Redux state,
  or API call. Plain-text Aadhaar MUST NEVER persist anywhere post-input.
- **Evidence photos**: SHA-256 MUST be computed on-device via
  `react-native-quick-crypto` before upload. Both hash and base64 MUST
  be sent to the API together.
- **Mock GPS**: MUST be detected via `ARModule.checkMockLocation()` and
  MUST block audit start with a full blocking screen. This is not a
  warning — the audit CANNOT proceed while mock location is enabled.
- **Rooted device**: MUST show a warning banner via
  `react-native-device-info`. App continues — NOT blocked — because
  legitimate custom ROM users exist.
- **JWT tokens**: Stored in MMKV (encrypted), never in AsyncStorage
  (plain text).
- **Maps API key**: Stored in `android/local.properties` only, injected
  into `AndroidManifest.xml` via `build.gradle`. NEVER hardcoded in the
  manifest or in any source file.
- **`.env` files**: MUST be in `.gitignore` before first commit.
  `SUPABASE_SERVICE_KEY` MUST NEVER appear in mobile app code.

**Rationale**: This app handles biometric identity (Aadhaar), financial
assets (blockchain wallet), and regulatory evidence (carbon audit). A
single security violation can invalidate all credits issued from that
audit and expose the farmer to identity risk.

### III. Offline-First Field Operations

- All field operations — AR diameter measurement, GPS zone navigation,
  on-device species identification — MUST function without internet.
- Tree scan data MUST be saved to Redux + MMKV immediately after each
  individual tree scan. **Never batch-saved.** Losing scan data forces
  the farmer to repeat the entire audit.
- `audit.scannedTrees` is the MOST CRITICAL persisted slice. It MUST
  survive app crash, battery death, and device restart.
- Pending audit submission MUST auto-retry via
  `react-native-background-fetch` when connectivity restores. This is
  reconnect-triggered — NOT a recurring timer.
- Google Maps road tiles for `ZoneNavigationScreen` MUST be cached when
  the screen first loads so walking navigation works offline.
- GEE Sentinel-2 PNG thumbnails MUST be cached in MMKV after first
  fetch per land parcel so `LandListScreen` and `BoundaryConfirmScreen`
  work offline after the first load.
- `audit.uploadStatus` MUST reset to `'idle'` on every app launch
  (never persisted across launches).

**Rationale**: Farmers operate in rural areas with intermittent
connectivity. Data loss or a blocked scanning workflow destroys trust in
the system and invalidates a year's worth of field work. The farmer must
be unaffected by network absence during the scanning session.

### IV. AR Tier Integrity (NON-NEGOTIABLE)

- AR tiers are ALWAYS integers: **1**, **2**, or **3**. Never A, B, or C.
- **Tier 1** — `RAW_DEPTH_ONLY`: hardware ToF depth sensor, ±2–3 cm
  accuracy, RANSAC cylinder fitting. UI badge: `"◉ High Precision"`.
- **Tier 2** — SLAM motion scan: 5-second left-right movement, ±4–5 cm
  accuracy. UI badge: `"◉ Standard Precision"`.
- **Tier 3** — Manual circumference entry: DBH = circumference ÷ π.
  UI badge: `"◎ Manual Measurement"`.
- Redux key: `audit.arTier` — TypeScript type `1 | 2 | 3`.
- API payload key: `ar_tier_used` — integer value `1`, `2`, or `3`.
- Tier detection MUST run once on app startup via
  `ARModule.checkDepthSupport()`. Result stored in Redux and persisted
  in MMKV.
- After 3 consecutive Tier 1/2 failures, Tier 3 MUST be offered
  automatically.

**Rationale**: Carbon market integrity requires consistent, auditable
measurement metadata. Mixed naming (A/B/C vs 1/2/3) causes lookup
failures in backend biomass calculation and IPFS certificate generation.

### V. Official Boundary Authority (NON-NEGOTIABLE)

- Land boundaries MUST originate from government records only.
- **Farmer-drawn polygons are NOT acceptable** for carbon credit
  verification under any carbon market standard (Verra, Gold Standard,
  etc.). They are permanently removed as a farmer-facing feature.
- The 3-layer boundary system MUST be implemented in sequence:
  - **Layer 1**: BhuNaksha WMS via LGD API (`WMS_AUTO`)
  - **Layer 2**: Headless browser web-scraping fallback (`SCRAPE`)
  - **Layer 3**: Farmer downloads official map image; OpenCV extracts
    boundary polygon (`MANUAL`)
- Draw Mode and Walk Mode from design versions prior to v3.0 are
  permanently removed. They MUST NOT appear in any screen, navigation
  flow, or Redux state.
- `boundary_source` MUST be stored per land parcel: `'WMS_AUTO'`,
  `'SCRAPE'`, or `'MANUAL'`. This value affects audit credibility
  scoring on the backend.

**Rationale**: Carbon markets explicitly require legally surveyed
government boundaries as evidence. Using farmer-drawn polygons would
void all credits issued for that parcel under audit review.

### VI. Data Persistence Discipline

Redux Persist with the MMKV adapter is mandatory for all field data.
MMKV is 30× faster than AsyncStorage and synchronous — the tree scan
save operation MUST complete before the UI returns control to the farmer.

**MUST persist to MMKV:**

| Slice key                | Reason                                         |
| ------------------------ | ---------------------------------------------- |
| `audit.scannedTrees`     | Survives crash / battery death mid-audit       |
| `audit.activeAuditId`    | Knows an audit is in progress on relaunch      |
| `audit.currentZoneIndex` | Resumes at correct zone without re-walking     |
| `audit.arTier`           | Avoids re-running ARCore check on every launch |
| `auth.walletAddress`     | Avoids round-trip to backend on every launch   |
| `auth.isAuthenticated`   | Avoids forcing re-login on every launch        |
| `land.parcels`           | Offline access to land list and thumbnails     |

**MUST NOT persist (reset on each launch):**

| Slice key            | Why                                                   |
| -------------------- | ----------------------------------------------------- |
| `audit.uploadStatus` | MUST reset to `'idle'` — prior upload state is stale  |
| `land.currentDraft`  | MUST clear — belongs to a single registration session |

**Rationale**: Batching or delaying tree saves creates a window for data
loss. Stale upload status causes silent duplicate-submission bugs.

### VII. UI Fidelity via Stitch MCP

## STITCH MCP — MANDATORY WORKFLOW
When implementing any screen:
1. Call generate_screen_from_text to create the design in Stitch
2. MUST call get_screen on the result to retrieve the screen details
   and download URL
3. Fetch the HTML/CSS from that download URL
4. Convert that exact HTML/CSS into React Native + NativeWind code
Do NOT write screen code from the spec alone. The code MUST come
from the Stitch-generated HTML/CSS. Never skip step 2 and 3.

**Stitch MCP Usage Rules**

- ALL new screen UI MUST be designed using the Stitch MCP server before
  any implementation.
- `NativeWind 4.0+` Tailwind utility classes are the ONLY accepted
  styling mechanism. `StyleSheet.create()` and inline style objects MUST
  NOT be used for screen-level layout.
- Touch targets on ALL interactive elements MUST be minimum **48×48 px**
  (Android accessibility — non-negotiable).
- Lottie animation file names are FIXED and MUST NOT be renamed:
  - `spinning_leaf.json` — loading states (OCR, satellite, submission)
  - `scan_success.json` — tree scan confirmed
  - `credit_earned.json` — token mint celebration
- **Roboto Mono** MUST be used for all numerical measurement display
  values: DBH (cm), tree height (m), CTT balance.
- Status badge label strings are FIXED — do not paraphrase:
  - `"✓ Verified"`, `"⏳ Pending"`, `"✗ Rejected"`
  - `"◉ High Precision"`, `"◉ Standard Precision"`,
    `"◎ Manual Measurement"`

**Rationale**: Indian agroforestry farmers may have limited smartphone
literacy. Consistent, high-quality UI with fixed language prevents
confusion. Minimum touch targets are required by Android accessibility
guidelines. Stitch ensures premium visual quality without improvisation.

## Technology Constraints

These constraints are locked. Changes require explicit user approval.

### Core Stack

| Concern          | Technology                    | Key Rule                                           |
| ---------------- | ----------------------------- | -------------------------------------------------- |
| Framework        | React Native CLI 0.73+        | NOT Expo — ARCore Depth API requires native bridge |
| Language         | TypeScript 5.0+ strict        | `strict: true` always on                           |
| Styling          | NativeWind 4.0+               | No `StyleSheet.create` for layout                  |
| State            | Redux Toolkit 2.0+            | Slices in `src/features/*/store/`                  |
| Persistence      | redux-persist + MMKV          | See Principle VI                                   |
| Navigation       | React Navigation v6           | Native stack navigator only                        |
| Camera           | react-native-vision-camera v4 | NOT react-native-image-picker                      |
| Maps             | react-native-maps             | Screen-specific rules below                        |
| Wallet storage   | react-native-keychain         | Private key ONLY — nowhere else                    |
| HTTP             | axios                         | Base URL from `Config.API_BASE_URL`                |
| Blockchain       | ethers.js v6                  | Public address only to Redux/API                   |
| Auth             | @supabase/supabase-js         | Phone OTP only                                     |
| Forms            | Zod + React Hook Form         | All user-facing form inputs                        |
| Background sync  | react-native-background-fetch | Reconnect-triggered, not timer                     |
| On-device crypto | react-native-quick-crypto     | SHA-256 photo hashing                              |
| Species model    | TensorFlow Lite               | On-device, `species_model.tflite`                  |
| Environment      | react-native-config           | All env vars via `Config.*`                        |

### Map Rules (Screen-Specific, Enforced)

| Screen                  | Implementation                                                                   |
| ----------------------- | -------------------------------------------------------------------------------- |
| `ZoneNavigationScreen`  | `mapType="standard"` (Google Maps road map)                                      |
| `BoundaryConfirmScreen` | `mapType="none"` + GEE Sentinel-2 PNG `<Image>` background + `<Polygon>` overlay |
| `LandListScreen`        | Static `<Image>` of GEE PNG only — no map component                              |

Google Maps satellite tiles MUST NEVER be used in `BoundaryConfirmScreen`.

### Species List (Fixed — Exactly 11)

Teak (0.60), Eucalyptus (0.55), Neem (0.56), Mango (0.54), Bamboo (0.70),
Pongamia (0.67), Subabul (0.56), Casuarina (0.69), Indian Rosewood (0.75),
Drumstick (0.39), Amla (0.74).

Any species not on this list MUST be rejected at the app level with the
message: `"This species is not eligible for carbon credits."`.

### Folder Structure (Mandatory — Do Not Deviate)

Feature code: `src/features/<feature>/screens/` and
`src/features/<feature>/store/`.
Shared code: `src/common/` (components, hooks, utils, constants).
Services: `src/services/` (api.ts, supabase.ts, wallet.ts, blockchain.ts,
ar-bridge.ts).
Store: `src/store/index.ts` + `src/store/mmkvStorage.ts`.
Native bridge: `android/app/src/main/java/com/terratrustar/ar/`.

See `.github/copilot-instructions.md` for the full canonical tree.

### API Rules

- All endpoints prefixed `/api/v1/`.
- Base URL from `Config.API_BASE_URL` (`.env` via `react-native-config`).
- Supabase JWT auto-attached by the axios request interceptor in
  `src/services/api.ts`.
- Default timeout: 60 seconds (satellite processing calls can be slow).
- 401 responses MUST redirect to `LoginScreen`. 500 responses MUST show
  a maintenance banner. No-response (offline) MUST show an offline banner.

## Development Workflow

### Scripting

ALL scripts in `.specify/scripts` MUST run under **PowerShell 7 (`pwsh`)**.
NEVER use: Windows PowerShell (`powershell.exe`), bash, or sh.

### Screen Implementation Order

1. Design with Stitch MCP → review output against FDD and SRS.
2. Implement using NativeWind utility classes from Stitch output.
3. Wire Redux state and API calls per SRS contracts.
4. Write unit tests for Redux reducers and utility functions (Jest).
5. Test component events with React Native Testing Library.
6. AR and GPS flows require a physical Android device — emulator is
   insufficient for ARCore and real GPS testing.

### Commit Format

One commit per completed SpecKit task.
Format: `[TASK-ID] Short description`
Example: `[T003] Implement OTPScreen 6-box input with resend timer`

### Source of Truth Hierarchy

When documents conflict: \*\*SRS > FDD > BSDD (frontend API sections only)

> this constitution\*\*.

## Governance

- This constitution MUST be consulted before implementing any feature.
- It supersedes all other practices, patterns, linting preferences, and
  conventions in this workspace.
- Every SpecKit task completion MUST verify compliance with the relevant
  principles before marking the task done.
- Any deviation from a **NON-NEGOTIABLE** principle requires written
  approval from the project owner before implementation begins.
- Amendments follow semantic versioning:
  - **MAJOR**: Principle removal, redefinition, or backward-incompatible
    governance change.
  - **MINOR**: New principle, new section, or materially expanded
    guidance added.
  - **PATCH**: Wording clarification, typo fix, or non-semantic
    refinement.
- `LAST_AMENDED_DATE` MUST be updated on every change regardless of
  version bump type.
- The BSDD is reference material only and is NEVER a build target for
  this workspace.

**Version**: 1.0.0 | **Ratified**: 2026-03-17 | **Last Amended**: 2026-03-17
