# Implementation Plan: React Native Project Foundation

**Branch**: `001-rn-project-foundation` | **Date**: 2026-03-18 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/001-rn-project-foundation/spec.md`

## Summary

Bootstrap the complete React Native CLI 0.73+ TypeScript workspace for TerraTrustAR (Android only). Installs all 23 production npm packages from FDD Table 1.2, creates the full `src/` folder structure per FDD Section 2, wires Redux Toolkit 2.0 store with per-reducer MMKV persistence (7 keys persisted, 2 explicit blacklists), configures NativeWind 4.0 with Tailwind preset and Metro wrapper, registers all 16 screen stubs in React Navigation v6 native stack, initialises a typed Supabase client, creates an Axios instance with JWT auto-attach interceptor, and outputs a `.env.development` template for environment-specific config via react-native-config. No backend code. No Expo.

## Technical Context

**Language/Version**: TypeScript 5.0+ strict mode (`"strict": true`). React Native 0.73+. NOT Expo.  
**Primary Dependencies**: NativeWind 4.0, Redux Toolkit 2.0, react-redux, redux-persist, react-native-mmkv, React Navigation v6 (native stack), @supabase/supabase-js, axios, react-native-config, react-hook-form, zod, ethers v6, react-native-vision-camera v4, react-native-maps, react-native-keychain, react-native-quick-crypto, lottie-react-native, react-native-reanimated, react-native-geolocation-service, react-native-device-info, react-native-background-fetch, react-native-haptic-feedback, react-native-chart-kit, react-native-svg  
**Storage**: `react-native-mmkv` as redux-persist `Storage` adapter — synchronous reads/writes < 1ms. Per-reducer `persistReducer` with field-level `blacklist`. `react-native-keychain` for private key ONLY (Keychain, never MMKV/Redux/logs).  
**Testing**: Jest + React Native Testing Library (RNTL). Unit tests for utils and selectors. Integration tests for slice reducers. No E2E in this feature (foundation only).  
**Target Platform**: Android 13+ (API 33 minimum), Android 14 (API 34 target). Physical device required for ARCore/GPS; emulator acceptable for UI smoke test.  
**Project Type**: mobile-app (React Native CLI, Android-only, field operations tool)  
**Performance Goals**: MMKV state save < 1ms synchronous (vs AsyncStorage ~60ms). Redux state hydration from MMKV on cold start < 50ms. NativeWind class resolution at build time (no runtime penalty). Metro bundler warm reload < 3s.  
**Constraints**: Offline-first — all field data captured without connectivity. No Expo SDK. No `StyleSheet.create` for layout (NativeWind only). Private key never leaves Keychain. `.env` files in `.gitignore`.  
**Scale/Scope**: 16 screens MVP, 4 Redux slices, 1 Android native module (AR bridge stub), 11 approved species.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

Verify ALL of the following before proceeding:

- [x] **Scope** (Principle I): This feature is frontend-only React Native.
      No backend, Python, Solidity, or GEE code is written here.
      All 9 API endpoint contracts verified against
      `TerraTrust_Backend_System_Design_v3.1.txt` — see
      `contracts/api-contracts.md`. Foundation feature only creates
      the project skeleton and wiring; no business logic.
- [x] **Security** (Principle II): Private key flows through
      `react-native-keychain` only — never Redux, never MMKV, never
      logs. Aadhaar hashing via `react-native-quick-crypto` SHA-256
      defined in `src/common/utils/hash.ts` before any state contact.
      Evidence photo hashing pattern established in `src/services/api.ts`.
      Mock GPS detection via `ARModule.checkMockLocation()` blocks audit
      start. `.env.*` in `.gitignore`. `SUPABASE_ANON_KEY` only (never
      service key).
- [x] **Offline-first** (Principle III): MMKV synchronous storage means
      each tree scan (`audit.scannedTrees`) is durable < 1ms after Redux
      dispatch. `react-native-background-fetch` initialised in
      `App.tsx` for pending upload retry on reconnect (not a timer).
      This feature establishes the persistence architecture; GEE PNG
      caching is handled in the land and AR-audit features.
- [x] **AR Tier integers** (Principle IV): `ARTier` type defined as
      `1 | 2 | 3` in `data-model.md` and in `src/features/ar-audit/store/auditSlice.ts`.
      Redux key is `audit.arTier`. API field is `ar_tier_used` (integer).
      No A/B/C anywhere in this codebase.
- [x] **Boundary authority** (Principle V): No map interaction in the
      foundation feature. `LandParcel.boundary_source` typed as
      `'WMS_AUTO' | 'SCRAPE' | 'MANUAL'` at the type level. No draw/walk
      mode UI is scaffolded.
- [x] **Persistence discipline** (Principle VI): Exact blacklists applied:
      `auditPersistConfig.blacklist = ['uploadStatus']`;
      `landPersistConfig.blacklist = ['currentDraft']`.
      Persisted: `auth` (full), `land.parcels`, `audit.scannedTrees`,
      `audit.activeAuditId`, `audit.currentZoneIndex`, `audit.arTier`,
      `audit.zones`. Not persisted: `audit.uploadStatus`,
      `land.currentDraft`.
- [x] **Stitch-first UI** (Principle VII): Foundation feature creates
      screen stubs only — no UI implementation. Stitch MCP will be
      invoked per screen in the screen-specific features. NativeWind
      4.0 is configured here; `StyleSheet.create` is not used anywhere.

## Project Structure

### Documentation (this feature)

```text
specs/001-rn-project-foundation/
├── plan.md              # This file
├── research.md          # Phase 0: NativeWind, MMKV, react-native-config, Navigation types, RTK hooks
├── data-model.md        # Phase 1: All TypeScript interfaces — AuthState, LandState, AuditState, CreditsState
├── quickstart.md        # Phase 1: Setup commands from zero to running app
├── contracts/
│   └── api-contracts.md # Phase 1: All 9 API endpoint request/response types
└── tasks.md             # Phase 2 output (speckit.tasks — NOT created here)
```

### Source Code (repository root)

Full directory tree created by this feature — exactly per FDD Section 2 and `.specify/memory/constitution.md`.

```text
# Root config files
.env.development               # git-ignored; template committed as .env.example
.env.production                # git-ignored
babel.config.js                # NativeWind 4.0 babel plugin
metro.config.js                # NativeWind withNativeWind() wrapper
tailwind.config.js             # NativeWind preset + src/** content paths
global.css                     # @tailwind base/components/utilities
tsconfig.json                  # strict: true

# React Native source
src/
├── app/
│   └── App.tsx                # Root: Navigation container + redux Provider + global.css import
│
├── assets/
│   ├── fonts/                 # Roboto-Regular, Roboto-Bold, RobotoMono-Regular (numerical values)
│   ├── images/                # Static PNGs (splash, logo)
│   ├── lottie/
│   │   ├── spinning_leaf.json # Loading state
│   │   ├── scan_success.json  # Tree scan confirmed
│   │   └── credit_earned.json # Token mint
│   └── tflite/
│       └── species_model.tflite  # On-device species classification
│
├── features/
│   ├── auth/
│   │   ├── screens/
│   │   │   ├── SplashScreen.tsx
│   │   │   ├── LoginScreen.tsx
│   │   │   ├── OTPScreen.tsx
│   │   │   └── KYCScreen.tsx
│   │   └── store/
│   │       └── authSlice.ts     # AuthState | persistReducer (full, no blacklist)
│   │
│   ├── land/
│   │   ├── screens/
│   │   │   ├── LandListScreen.tsx
│   │   │   ├── DocumentUploadScreen.tsx
│   │   │   ├── BoundaryConfirmScreen.tsx
│   │   │   └── ManualUploadGuideScreen.tsx
│   │   └── store/
│   │       └── landSlice.ts     # LandState | persistReducer blacklist: ['currentDraft']
│   │
│   ├── ar-audit/
│   │   ├── screens/
│   │   │   ├── AuditStartScreen.tsx
│   │   │   ├── ZoneNavigationScreen.tsx
│   │   │   ├── ARCameraScreen.tsx
│   │   │   ├── ManualMeasureScreen.tsx
│   │   │   ├── TreeResultScreen.tsx
│   │   │   └── AuditCompleteScreen.tsx
│   │   └── store/
│   │       └── auditSlice.ts    # AuditState | persistReducer blacklist: ['uploadStatus']
│   │
│   └── dashboard/
│       ├── screens/
│       │   ├── HomeScreen.tsx
│       │   └── CreditHistoryScreen.tsx
│       └── store/
│           └── creditsSlice.ts  # CreditsState | persistReducer (full)
│
├── services/
│   ├── api.ts               # Axios instance + JWT interceptor + 401 handler
│   ├── supabase.ts          # Supabase client (SUPABASE_URL + SUPABASE_ANON_KEY)
│   ├── wallet.ts            # ethers.js wallet creation → Keychain storage
│   ├── blockchain.ts        # contract.balanceOf read from Polygon RPC
│   └── ar-bridge.ts         # TypeScript interface to ARModule.kt (NativeModule)
│
├── common/
│   ├── components/
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Badge.tsx
│   │   ├── BottomSheet.tsx
│   │   └── Loader.tsx       # Lottie spinning_leaf.json
│   ├── hooks/
│   │   ├── useGeofence.ts
│   │   └── useARTier.ts     # Returns ARTier (1 | 2 | 3) based on hardware capability
│   ├── utils/
│   │   ├── geoJson.ts
│   │   ├── units.ts
│   │   └── hash.ts          # SHA-256 via react-native-quick-crypto
│   └── constants/
│       ├── colors.ts
│       └── species.ts       # APPROVED_SPECIES — exactly 11 entries with wood densities
│
├── store/
│   ├── index.ts             # persistStore + persistReducer composition + Redux store export
│   ├── hooks.ts             # useAppDispatch, useAppSelector typed wrappers
│   └── mmkvStorage.ts       # MMKV redux-persist Storage adapter
│
└── types/
    ├── env.d.ts             # NativeConfig interface for react-native-config
    ├── navigation.ts        # RootStackParamList + global RootParamList augmentation
    └── nativewind.d.ts      # /// <reference types="nativewind/types" />

# Android native module (AR bridge stubs)
android/app/src/main/java/com/terratrustar/
├── ar/
│   ├── ARModule.kt          # Stub: checkMockLocation(), startARSession(), getArTier()
│   └── ARPackage.kt         # ReactPackage registration
└── MainApplication.kt       # Include ARPackage in getPackages()
```

**Structure Decision**: Mobile app (Option 3 variant — Android only, no API layer). Follows FDD Section 2 feature-sliced architecture. Each feature owns its screens and its Redux slice. Shared infrastructure in `src/services/`, `src/common/`, `src/store/`, `src/types/`. Android native AR bridge in `android/.../ar/`. iOS directories are absent (Android-only per SRS Section 4.1).

## Complexity Tracking

No constitution violations. No complexity justifications required.

All architectural decisions are either directly mandated by the FDD/SRS or are the minimum necessary to satisfy them:

- Per-reducer `persistReducer` (vs top-level blacklist): Required because `audit.uploadStatus` and `land.currentDraft` are at the same depth level as persisted keys in each slice — top-level `blacklist` in the root persist config cannot target sub-keys of a nested reducer.
- Two separate Supabase and Axios clients: Required by SRS — Supabase handles phone OTP auth, Axios handles all backend REST API calls. They are separate systems with different auth flows.
- `src/types/` directory: Required to avoid polluting feature directories with cross-cutting declarations (`env.d.ts`, `navigation.ts`, `nativewind.d.ts`).
