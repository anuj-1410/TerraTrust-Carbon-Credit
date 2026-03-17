# Feature Specification: React Native Project Foundation

**Feature Branch**: `001-rn-project-foundation`  
**Created**: 2026-03-18  
**Status**: Draft  
**Input**: User description: "React Native project foundation for TerraTrustAR. Set up: complete src/ folder structure per FDD Section 2, all npm dependencies from FDD Section 1.2, Redux store with MMKV persistence adapter, NativeWind 4.0 config, React Navigation v6 skeleton, Supabase client, Axios instance with JWT interceptor, and .env.development template. Android only. Frontend only."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Developer Onboards and Runs the App (Priority: P1)

A developer clones the repository, installs dependencies, and launches the app on an Android emulator or physical device. The app displays a placeholder home screen, confirming the full build pipeline is wired up correctly — no crashes, no missing module errors, no blank screens.

**Why this priority**: Every subsequent feature depends on being able to build and run the app. Nothing can be developed or tested until this foundation exists. This is the critical-path blocker for the entire project.

**Independent Test**: Running `npm install` followed by the Android build command should produce a running app on a connected device or emulator with a visible placeholder screen — no additional setup steps should be required beyond what is documented in the project README.

**Acceptance Scenarios**:

1. **Given** a fresh clone of the repository on a properly configured Android development machine, **When** the developer installs dependencies and builds for Android, **Then** the app launches on device/emulator within 5 minutes with no build errors, showing a placeholder home screen.
2. **Given** the app is running, **When** the developer navigates between placeholder screens using the navigation skeleton, **Then** all 16 screens (SplashScreen, LoginScreen, OTPScreen, KYCScreen, LandListScreen, DocumentUploadScreen, BoundaryConfirmScreen, ManualUploadGuideScreen, AuditStartScreen, ZoneNavigationScreen, ARCameraScreen, ManualMeasureScreen, TreeResultScreen, AuditCompleteScreen, HomeScreen, CreditHistoryScreen) are reachable with no crash.
3. **Given** the app is running, **When** the developer inspects the Redux store via developer tools, **Then** the initial state for auth, land, audit, and credits slices is correctly populated with the correct shape.

---

### User Story 2 - State Survives App Restart (Priority: P2)

A developer confirms that critical application state — specifically the authenticated user's identity, their land parcels, their active audit progress, and their scanned tree data — is restored exactly as left when the app is closed and reopened, without requiring any server call.

**Why this priority**: The SRS identifies data loss of scanned trees as the single most critical failure scenario. A farmer who scans 8 trees and reopens the app after it crashes must see all 8 trees. This persistence requirement must be validated as part of the foundation before any screen logic is built on top of it.

**Independent Test**: Can be tested by dispatching test actions to the Redux store, force-closing the app, relaunching, and verifying that the predefined persisted slices contain the test values while the excluded slices (upload status, current draft) reset to their initial values.

**Acceptance Scenarios**:

1. **Given** the Redux store contains test values in `audit.scannedTrees`, `audit.activeAuditId`, `auth.walletAddress`, and `land.parcels`, **When** the app is force-closed and relaunched, **Then** all four values are restored with no data loss.
2. **Given** `audit.uploadStatus` contains the value `'uploading'` before the app is closed, **When** the app relaunches, **Then** `audit.uploadStatus` resets to `'idle'`.
3. **Given** `land.currentDraft` contains partial OCR data before the app is closed, **When** the app relaunches, **Then** `land.currentDraft` is cleared to its initial empty state.

---

### User Story 3 - Backend Communication Is Environment-Aware (Priority: P3)

A developer confirms that all outbound API calls use the correct base URL for the current environment (development vs production), and that the Supabase authentication token is automatically attached to every request without manual intervention in any screen component.

**Why this priority**: Without a correctly configured API layer, every screen that communicates with the backend will fail. Establishing this once in the foundation removes a category of bugs from all future features.

**Independent Test**: Can be tested by making a test API call from the running app and verifying the request headers in a network inspector (Flipper, Charles Proxy) contain the correct `Authorization: Bearer <token>` header and the correct base URL, without any screen-level code managing the token.

**Acceptance Scenarios**:

1. **Given** the app is running in development mode with a valid Supabase session, **When** any API call is dispatched, **Then** the request URL is prefixed with the `API_BASE_URL` value from the `.env.development` file and the `Authorization` header contains the current Supabase JWT.
2. **Given** the Supabase session token has expired, **When** an API call returns a 401 response, **Then** the interceptor automatically attempts a session refresh before retrying the request, without any action required from the screen component.
3. **Given** the `.env.development` file specifies `API_BASE_URL=http://10.0.2.2:8000`, **When** the app is built in development mode, **Then** all API calls target that address and not any hardcoded production URL.

---

### Edge Cases

- What happens when the developer runs the app without a `.env.development` file present? The build must fail with a clear, actionable error message rather than silently defaulting to undefined values.
- What happens when the MMKV storage encounters a write failure (low device storage)? The Redux persist middleware must not crash the app — it should log the error and continue running with in-memory state only.
- What happens when a persisted slice contains state from a previous app version that does not match the current slice shape? The persist layer must handle schema mismatches gracefully by resetting the incompatible slice to its initial state rather than crashing.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The project MUST have a complete folder structure matching the layout defined in FDD Section 2 exactly, including all `features/`, `services/`, `common/`, `store/`, and `assets/` subdirectories.
- **FR-002**: All npm packages listed in FDD Section 1.2 MUST be installed and resolvable with no version conflicts, including: Redux Toolkit 2.0+, React Navigation v6, NativeWind 4.0+, MMKV, redux-persist, react-native-vision-camera v4, react-native-maps, react-native-geolocation-service, react-native-background-fetch, react-native-quick-crypto, react-native-keychain, react-native-device-info, react-native-haptic-feedback, react-native-reanimated, react-native-chart-kit, react-native-svg, lottie-react-native, react-native-config, ethers.js v6, @supabase/supabase-js, axios, Zod, React Hook Form.
- **FR-003**: The Redux store MUST be configured with four slices — `authSlice`, `landSlice`, `auditSlice`, `creditsSlice` — each typed with an initial state shape exactly matching the structure defined in SRS Section 13.
- **FR-004**: The Redux persist configuration MUST persist exactly the following state keys: `audit.scannedTrees`, `audit.activeAuditId`, `audit.currentZoneIndex`, `audit.arTier`, `auth.walletAddress`, `auth.isAuthenticated`, and `land.parcels`.
- **FR-005**: The Redux persist configuration MUST NOT persist `audit.uploadStatus` or `land.currentDraft`; these MUST reset to their initial values on every app launch.
- **FR-006**: MMKV MUST be used as the storage adapter for redux-persist. AsyncStorage MUST NOT be used anywhere in the project.
- **FR-007**: NativeWind 4.0 MUST be configured so that Tailwind utility classes work in all `.tsx` files within the `src/` folder.
- **FR-008**: React Navigation v6 MUST provide a single root navigator in `App.tsx` covering all screens across all four feature modules (auth, land, ar-audit, dashboard), with each screen registered by name.
- **FR-009**: The Supabase client MUST be initialised once in `src/services/supabase.ts` using `SUPABASE_URL` and `SUPABASE_ANON_KEY` values from the environment configuration.
- **FR-010**: The Axios instance in `src/services/api.ts` MUST automatically attach the current Supabase JWT as a Bearer token in the `Authorization` header for every outbound request, without any screen-level code managing the token.
- **FR-011**: The Axios instance MUST use `API_BASE_URL` from the environment configuration as its base URL and MUST NOT contain any hardcoded URLs.
- **FR-012**: A `.env.development` template file MUST be present in the project root containing placeholder entries for: `API_BASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `GOOGLE_MAPS_API_KEY`.
- **FR-013**: The `.env.development` file MUST be listed in `.gitignore`. Actual secret values MUST NOT be committed to the repository.
- **FR-014**: Each of the 16 feature screen files MUST exist as a valid TypeScript component file with at minimum a placeholder view and a screen title — the file MUST compile without TypeScript errors.
- **FR-015**: The `src/common/constants/species.ts` file MUST export the complete list of exactly 11 approved species with their wood density values as defined in SRS Section 7.4: Teak (0.60), Eucalyptus (0.55), Neem (0.56), Mango (0.54), Bamboo (0.70), Pongamia (0.67), Subabul (0.56), Casuarina (0.69), Indian Rosewood (0.75), Drumstick (0.39), Amla (0.74).
- **FR-016**: The `src/store/mmkvStorage.ts` file MUST export a redux-persist compatible storage adapter backed by MMKV.

### Key Entities

- **Redux Store**: The single global state container for the entire app. Has four slices: `auth` (authenticated user identity and wallet address), `land` (registered parcels and current registration draft), `audit` (active audit session, scanned tree measurements, AR tier), and `credits` (token balance and audit history).
- **Persisted State**: The subset of Redux store state that survives app restarts. Stored in MMKV on the device. Excludes transient values that should always start fresh (upload status, registration drafts).
- **Navigation Stack**: The complete routing map of the app. All 16 screens must be registered here even if their full logic is not yet implemented.
- **Environment Configuration**: Key-value pairs that change between development and production deployments (API URLs, auth keys, map API keys). Loaded at build time and never committed to source control.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A developer with a correctly configured Android development environment can clone the repo, install dependencies, and see the app running on a device or emulator within 10 minutes, with zero build errors and zero runtime crashes on the initial screen.
- **SC-002**: All 16 screen placeholder components compile without TypeScript errors in strict mode.
- **SC-003**: 100% of the state keys marked as "must persist" in SRS Section 13.2 survive a force-close and relaunch, verified by a manual test using known test values dispatched before closing.
- **SC-004**: 100% of the state keys marked as "must NOT persist" (uploadStatus, currentDraft) reset to their initial typed values on every app launch regardless of what value they held at close.
- **SC-005**: A test API call made from the running app carries the correct `Authorization: Bearer <token>` header as confirmed by network inspection, without any screen-level token management code.
- **SC-006**: The NativeWind configuration correctly applies Tailwind utility classes to at least one component visible on screen, confirming the styling pipeline is functional end-to-end.

## Assumptions

- The developer machine has Android Studio, OpenJDK 17, Node.js v18 LTS, and all Android SDK components installed as described in SRS Section 4.1.
- A Supabase project has been created and its URL and anon key are available to populate `.env.development`. The foundation does not require a live Supabase connection to build — only to test the auth interceptor at runtime.
- NativeWind 4.0 Babel and Metro configuration applies to React Native CLI (not Expo).
- The Kotlin AR module files (`ARModule.kt`, `ARPackage.kt`) are created as empty stubs in this feature to establish the correct Android source directory structure. Full ARCore implementation is a separate feature.
- Lottie animation JSON files and the TensorFlow Lite species model are included as placeholder files. Actual production assets are added in their respective feature tasks.
