# Tasks: React Native Project Foundation

**Feature**: `001-rn-project-foundation`  
**Branch**: `001-rn-project-foundation`  
**Input**: `specs/001-rn-project-foundation/plan.md`, `spec.md`, `data-model.md`, `contracts/api-contracts.md`, `research.md`  
**Generated**: 2026-03-18

## Format: `- [ ] [ID] [P?] [Story?] Description — file/path`

- **[P]**: Parallelisable — different files, no dependency on an in-progress task
- **[Story]**: User story label (US1 / US2 / US3)
- Every file path is absolute relative to the repo root

---

## Phase 1: Setup

**Purpose**: Initialise the React Native CLI project and install all dependencies so the build toolchain is ready for configuration.

- [ ] T001 Initialise React Native CLI 0.73+ project with TypeScript template (`react-native-template-typescript`) at repo root — produces `android/`, `ios/`, `index.js`, `package.json`
- [ ] T002 Install all 23 npm packages from FDD Table 1.2 — `@reduxjs/toolkit react-redux redux-persist react-native-mmkv nativewind tailwindcss @react-navigation/native @react-navigation/native-stack react-native-screens react-native-safe-area-context @supabase/supabase-js axios react-native-config react-hook-form zod @hookform/resolvers react-native-vision-camera react-native-maps ethers@6 react-native-keychain react-native-quick-crypto react-native-device-info react-native-geolocation-service lottie-react-native react-native-reanimated react-native-chart-kit react-native-svg react-native-background-fetch react-native-haptic-feedback`
- [ ] T003 [P] Configure `tsconfig.json` — set `strict: true`, `baseUrl: "src"`, add `paths` aliases (`@features/*`, `@services/*`, `@common/*`, `@store/*`, `@types/*`, `@assets/*`), set `moduleResolution: bundler`
- [ ] T004 [P] Add `.env.development` and `.env.production` entries to `.gitignore`; create `.env.example` with the four required placeholder key names: `API_BASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `GOOGLE_MAPS_API_KEY`

**Checkpoint**: `npm install` completes with zero dependency errors. `npx react-native doctor` shows no blocking issues.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared infrastructure that ALL user stories depend on. Must be complete before any Phase 3+ work begins.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T005 Create the complete `src/` directory tree — mkdir all subdirectories: `src/app/`, `src/assets/fonts/`, `src/assets/images/`, `src/assets/lottie/`, `src/assets/tflite/`, `src/features/auth/screens/`, `src/features/auth/store/`, `src/features/land/screens/`, `src/features/land/store/`, `src/features/ar-audit/screens/`, `src/features/ar-audit/store/`, `src/features/dashboard/screens/`, `src/features/dashboard/store/`, `src/services/`, `src/common/components/`, `src/common/hooks/`, `src/common/utils/`, `src/common/constants/`, `src/store/`, `src/types/`
- [ ] T006 [P] Configure NativeWind 4.0 — write `tailwind.config.js` (`nativewind/preset`, content `./src/**/*.{js,jsx,ts,tsx}`), `global.css` (`@tailwind base/components/utilities`), update `babel.config.js` (add `nativewind/babel` plugin), update `metro.config.js` (`withNativeWind(config, { input: './global.css' })`)
- [ ] T007 [P] Create `src/types/navigation.ts` — define `RootStackParamList` with all 16 screen names and their param types (`OTPScreen: { phone: string }`, all others `undefined`); add `declare global { namespace ReactNavigation { interface RootParamList extends RootStackParamList {} } }`
- [ ] T008 [P] Create `src/types/nativewind.d.ts` — add `/// <reference types="nativewind/types" />`; create `src/types/env.d.ts` — declare `module "react-native-config"` with `NativeConfig` interface: `API_BASE_URL: string; SUPABASE_URL: string; SUPABASE_ANON_KEY: string; GOOGLE_MAPS_API_KEY: string`
- [ ] T009 [P] Create `src/common/constants/species.ts` — export `Species` interface, `APPROVED_SPECIES` array (exactly 11 entries with scientific names and wood densities per SRS §7.4: Teak 0.60, Eucalyptus 0.55, Neem 0.56, Mango 0.54, Bamboo 0.70, Pongamia 0.67, Subabul 0.56, Casuarina 0.69, Indian Rosewood 0.75, Drumstick 0.39, Amla 0.74), `APPROVED_SPECIES_NAMES: string[]`, `getWoodDensity(name: string): number | null`
- [ ] T010 [P] Create `src/common/constants/colors.ts` — export colour token constants (forest greens `#2D6A4F / #40916C / #74C69D`, earth neutrals `#A08060 / #6B4F3A`, sky blues `#1B4332 / #52B788`, status `#E63946 / #F4A261 / #2DC653`)
- [ ] T011 Create `src/store/mmkvStorage.ts` — instantiate `new MMKV({ id: 'terratrust-store' })`, implement the redux-persist `Storage` interface (`getItem`, `setItem`, `removeItem`) using synchronous MMKV calls wrapped in Promises, export as `mmkvStorage`
- [ ] T012 Create Android AR bridge stubs — `android/app/src/main/java/com/terratrustar/ar/ARModule.kt` (stub `@ReactMethod` functions: `checkMockLocation`, `startARSession`, `getArTier`), `ARPackage.kt` (`ReactPackage` implementation), update `android/app/src/main/java/com/terratrustar/MainApplication.kt` to add `ARPackage()` in `getPackages()`

**Checkpoint**: Foundation ready — directory tree exists, NativeWind configured, type declarations present, AR bridge registered in Android. User story implementation can now begin.

---

## Phase 3: User Story 1 — Developer Onboards and Runs the App (Priority: P1) 🎯 MVP

**Goal**: A developer can `npm install` + `npx react-native run-android` and see a running app with all 16 placeholder screens reachable via the navigation stack. Redux DevTools shows all 4 slices with correct initial state. Zero TypeScript errors in strict mode.

**Independent Test**: `npx tsc --noEmit` produces zero errors. App launches on Android emulator with a visible placeholder screen. All 16 screens are navigable without crashes (no server required).

### Implementation for User Story 1

- [ ] T013 [P] [US1] Create `src/features/auth/store/authSlice.ts` — define `AuthUser` + `AuthState` interfaces (from data-model.md §1), export `authInitialState`, create `authSlice` with `createSlice`, export reducer and actions
- [ ] T014 [P] [US1] Create `src/features/land/store/landSlice.ts` — define `BoundarySource`, `LandStatus`, `GeoJSONPolygon`, `LandParcel`, `OCRResult`, `LandDraft`, `LandState` (from data-model.md §2), export `landInitialState` + slice reducer
- [ ] T015 [P] [US1] Create `src/features/ar-audit/store/auditSlice.ts` — define `ARTier = 1 | 2 | 3`, `UploadStatus`, `GPS`, `SamplingZone`, `TreeSample`, `AuditState` (from data-model.md §3), export `auditInitialState` (`arTier: 3`, `uploadStatus: 'idle'`) + slice reducer
- [ ] T016 [P] [US1] Create `src/features/dashboard/store/creditsSlice.ts` — define `AuditRecord` + `CreditsState` (from data-model.md §4), export `creditsInitialState` + slice reducer
- [ ] T017 [US1] Create `src/store/index.ts` — import `mmkvStorage`, define `auditPersistConfig` (`key: 'audit'`, `storage: mmkvStorage`, `blacklist: ['uploadStatus']`) and `landPersistConfig` (`key: 'land'`, `storage: mmkvStorage`, `blacklist: ['currentDraft']`), compose root reducer with `persistReducer` for audit and land slices (auth and credits use top-level persist), `configureStore`, `persistStore`, export `RootState = ReturnType<typeof rootReducer>` and `AppDispatch = typeof store.dispatch`
- [ ] T018 [P] [US1] Create `src/store/hooks.ts` — export `useAppDispatch: () => AppDispatch` = `useDispatch<AppDispatch>` and `useAppSelector: TypedUseSelectorHook<RootState>` = `useSelector` typed; no screen should ever call untyped `useSelector` or `useDispatch`
- [ ] T019 [P] [US1] Create auth screen stubs — `src/features/auth/screens/SplashScreen.tsx`, `LoginScreen.tsx`, `OTPScreen.tsx`, `KYCScreen.tsx` — each is a functional component with a `<View className="flex-1 items-center justify-center bg-white">` + `<Text className="text-xl font-bold">{ScreenName}</Text>` (NativeWind classes only, no StyleSheet.create); `OTPScreen` accepts `route.params.phone: string`
- [ ] T020 [P] [US1] Create land screen stubs — `src/features/land/screens/LandListScreen.tsx`, `DocumentUploadScreen.tsx`, `BoundaryConfirmScreen.tsx`, `ManualUploadGuideScreen.tsx` — same stub pattern as T019
- [ ] T021 [P] [US1] Create ar-audit screen stubs — `src/features/ar-audit/screens/AuditStartScreen.tsx`, `ZoneNavigationScreen.tsx`, `ARCameraScreen.tsx`, `ManualMeasureScreen.tsx`, `TreeResultScreen.tsx`, `AuditCompleteScreen.tsx` — same stub pattern as T019
- [ ] T022 [P] [US1] Create dashboard screen stubs — `src/features/dashboard/screens/HomeScreen.tsx`, `CreditHistoryScreen.tsx` — HomeScreen stub uses `className="flex-1 bg-green-900 items-center justify-center"` to validate NativeWind (SC-006)
- [ ] T023 [P] [US1] Create `src/services/ar-bridge.ts` — declare `ARModuleInterface` with method signatures (`checkMockLocation(): Promise<boolean>`, `startARSession(tier: ARTier): Promise<void>`, `getArTier(): Promise<ARTier>`); export `ARBridge` as `NativeModules.ARModule as ARModuleInterface`
- [ ] T024 [P] [US1] Create `src/services/wallet.ts` stub — export `createWallet(): Promise<string>` (uses `ethers.Wallet.createRandom()`, stores private key via `Keychain.setGenericPassword`, returns public address only — private key never returned); export `getWalletAddress(): Promise<string | null>`
- [ ] T025 [P] [US1] Create `src/services/blockchain.ts` stub — export `getCTTBalance(walletAddress: string): Promise<number>` (connects to Polygon RPC via `ethers.JsonRpcProvider`, calls `balanceOf` on CTT contract, returns parsed token balance)
- [ ] T026 [P] [US1] Create `src/common/components/` stubs — `Button.tsx` (NativeWind, min `h-12 px-6`, `onPress` prop), `Card.tsx` (NativeWind container), `Badge.tsx` (accepts `label: string`, `variant: 'verified' | 'pending' | 'rejected'`), `BottomSheet.tsx` (wrapper with `visible` + `onClose` props), `Loader.tsx` (renders `spinning_leaf.json` via `lottie-react-native`)
- [ ] T027 [P] [US1] Create hook stubs — `src/common/hooks/useGeofence.ts` (accepts `centre: GPS, radius_metres: number`, returns `isInsideZone: boolean` using `react-native-geolocation-service`); `src/common/hooks/useARTier.ts` (calls `ARBridge.getArTier()` once on mount, returns `ARTier`, stores in Redux `audit.arTier` via dispatch)
- [ ] T028 [P] [US1] Create utility files — `src/common/utils/hash.ts` (export `sha256(data: string): Promise<string>` using `react-native-quick-crypto`); `src/common/utils/geoJson.ts` (export `isClosedPolygon`, `calculateAreaHectares` stubs); `src/common/utils/units.ts` (export `circumferenceToDiameter(cm: number): number` = `cm / Math.PI`, `dbhToHeight` stub)
- [ ] T029 [P] [US1] Add placeholder Lottie JSON stubs — `src/assets/lottie/spinning_leaf.json`, `scan_success.json`, `credit_earned.json` (minimal valid Lottie v5 JSON with `{"v":"5.0","nm":"placeholder","layers":[]}`); add placeholder `src/assets/tflite/species_model.tflite` (empty file); add `.gitkeep` to `src/assets/fonts/` and `src/assets/images/`
- [ ] T030 [US1] Create `src/app/App.tsx` — import `../../global.css`, wrap in `<Provider store={store}><PersistGate loading={<Loader />} persistor={persistor}>`, wrap in `<NavigationContainer>`, create `RootStack = createNativeStackNavigator<RootStackParamList>()`, register all 16 screens by name matching `RootStackParamList` keys; configure `react-native-background-fetch` with `BackgroundFetch.configure({ minimumFetchInterval: 15, stopOnTerminate: false }, onEvent, onTimeout)` for pending upload retry

**Checkpoint**: `npx tsc --noEmit` = 0 errors. App launches on emulator. All 16 screens navigable via `navigation.navigate()`. Redux DevTools shows all 4 slices with correct empty initial state.

---

## Phase 4: User Story 2 — State Survives App Restart (Priority: P2)

**Goal**: Redux state survives a force-close and relaunch exactly as left. `audit.uploadStatus` resets to `'idle'` on every launch. `land.currentDraft` resets to its initial empty state. Schema mismatches from future upgrades are handled gracefully (no crash).

**Independent Test**: Dispatch `{ scannedTrees: [testTree], activeAuditId: 'test-123' }` to audit slice. Force-close. Relaunch. Verify `scannedTrees` contains the test tree and `activeAuditId === 'test-123'`. Verify `uploadStatus === 'idle'` regardless of what was stored.

### Implementation for User Story 2

- [ ] T031 [US2] Add migration config to `src/store/index.ts` — set `version: 1` on all persist configs, add `migrate: createMigrate({}, { debug: false })` (empty initial migrations, ready for future schema changes), add `stateReconciler: autoMergeLevel2` from `redux-persist/lib/stateReconciler/autoMergeLevel2` to handle partial schema mismatches without crashing
- [ ] T032 [P] [US2] Verify persistence blacklists are type-safe — ensure `auditPersistConfig.blacklist` only contains keys that exist on `AuditState` (TypeScript will error if a key name is wrong); run `npx tsc --noEmit` and confirm zero errors; confirm `audit.uploadStatus` key appears in the blacklist array

**Checkpoint**: App relaunches with hydrated state. `uploadStatus` is always `'idle'`. `currentDraft` is always the `landInitialState.currentDraft` shape. Future slice changes will not crash existing installations.

---

## Phase 5: User Story 3 — Backend Communication Is Environment-Aware (Priority: P3)

**Goal**: All API calls use `API_BASE_URL` from `.env.development`. The Supabase JWT is automatically attached as `Authorization: Bearer <token>` to every Axios request. 401 responses trigger automatic token refresh. No screen component manages tokens.

**Independent Test**: With Flipper/Charles Proxy connected, trigger any API call from the running app. Inspect the outbound request — URL must use the value from `.env.development`, `Authorization` header must be present with a valid Bearer token, no screen-level code must construct or set the token.

### Implementation for User Story 3

- [ ] T033 [P] [US3] Create `.env.development` in project root — populate with working placeholder values: `API_BASE_URL=http://10.0.2.2:8000`, `SUPABASE_URL=https://placeholder.supabase.co`, `SUPABASE_ANON_KEY=placeholder-anon-key`, `GOOGLE_MAPS_API_KEY=placeholder-maps-key`; verify the file is listed in `.gitignore`
- [ ] T034 [P] [US3] Configure `react-native-config` in `android/app/build.gradle` — add `apply from: project(':react-native-config').projectDir.getPath() + "/dotenv.gradle"` at the top of the file (before the `android {}` block) so environment variables are injected into the native build
- [ ] T035 [US3] Create `src/services/supabase.ts` — import `Config` from `react-native-config`, call `createClient(Config.SUPABASE_URL, Config.SUPABASE_ANON_KEY, { auth: { storage: mmkvStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false } })`, export typed `supabase` client
- [ ] T036 [US3] Create `src/services/api.ts` — create `axiosInstance` with `baseURL: Config.API_BASE_URL` and `timeout: 60000`; add request interceptor: get current Supabase session, if `session?.access_token` exists set `Authorization: Bearer ${token}`; add response interceptor: on 401 call `supabase.auth.refreshSession()`, retry original request once; on network error save payload to `mmkvStorage` under key `'pending_upload'` for background-fetch retry

**Checkpoint**: Network inspector shows correct base URL from `.env.development` on all requests. `Authorization: Bearer ...` header present without any token code in screen components. Session refresh triggers automatically on 401.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation passes that confirm all three user stories work end-to-end.

- [ ] T037 [P] Run full TypeScript check — `npx tsc --noEmit` — confirm zero errors across all 16 screen stubs, all 4 slices, all services, all utils (SC-002)
- [ ] T038 [P] Run quickstart.md end-to-end validation — follow all steps from `specs/001-rn-project-foundation/quickstart.md` on a clean environment; confirm app launches on emulator within 10 minutes (SC-001); confirm NativeWind green background visible on HomeScreen (SC-006)

**Checkpoint**: All 6 success criteria from spec.md are satisfied. Feature is ready to commit.

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup) ──────────────────────────────→ Phase 2 (Foundational)
                                                        │
                                 ┌──────────────────────┼─────────────────────┐
                                 ↓                      ↓                     ↓
                        Phase 3 (US1) ──→ Phase 4 (US2) ──→ Phase 5 (US3) ──→ Phase 6 (Polish)
```

- **Phase 1**: No dependencies — start immediately
- **Phase 2**: Requires Phase 1 completion — blocks ALL user stories
- **Phase 3 (US1)**: Requires Phase 2 — T013–T016 (slices) before T017 (store)
- **Phase 4 (US2)**: Requires T017 (store/index.ts exists) — updates it further
- **Phase 5 (US3)**: Requires Phase 2 (`mmkvStorage` available for Supabase init) — T035 requires T034
- **Phase 6 (Polish)**: Requires all prior phases complete

### User Story Dependencies

| Story    | Blocks   | Unblocked By            |
| -------- | -------- | ----------------------- |
| US1 (P1) | US2, US3 | Phase 2 complete        |
| US2 (P2) | Phase 6  | T017 complete           |
| US3 (P3) | Phase 6  | Phase 2 + T034 complete |

### Within Phase 3 (US1)

- T013–T016 (slices) are fully parallel
- T017 (store) depends on T013–T016
- T018 (hooks) depends on T017
- T019–T029 (screens, services, assets) are all parallel with each other and can run alongside T013–T016
- T030 (App.tsx) depends on T017 + T018 + T019–T022 + T023

### Within Phase 5 (US3)

- T033 (create .env file) and T034 (gradle config) are parallel
- T035 (supabase.ts) depends on T034 (gradle) + T011 (mmkvStorage)
- T036 (api.ts) depends on T035 (needs supabase client)

### Parallel Opportunities Per Story

**US1 parallel group** (all of T013–T029 can execute simultaneously):

- Slices: T013, T014, T015, T016
- Screens: T019, T020, T021, T022
- Services/stubs: T023, T024, T025, T026, T027, T028, T029
- Store hooks: T018 (after T017 unblocks it)

**US3 parallel group**: T033 + T034 simultaneously

---

## Implementation Strategy

| Phase            | Deliver                                       | MVP?                             |
| ---------------- | --------------------------------------------- | -------------------------------- |
| Phase 1+2        | Project skeleton, deps, types, NativeWind     | Required                         |
| Phase 3 (US1)    | Runnable app, all screens, Redux store        | ✅ **MVP**                       |
| Phase 4 (US2)    | MMKV persistence validated + migration safety | Required for field use           |
| Phase 5 (US3)    | Supabase + Axios wired up                     | Required for any backend feature |
| Phase 6 (Polish) | Type check + quickstart validation            | Required before merge            |

**Suggested MVP Scope**: Complete Phase 1 → Phase 2 → Phase 3 (US1) first. This gives you a running app with all screens to develop against, even before persistence or API is wired. US1 alone satisfies SC-001 and SC-002.

---

## Task Summary

| Phase                 | Tasks        | Parallelisable        | Story |
| --------------------- | ------------ | --------------------- | ----- |
| Phase 1: Setup        | T001–T004    | T003, T004            | —     |
| Phase 2: Foundational | T005–T012    | T006–T010             | —     |
| Phase 3: US1          | T013–T030    | T013–T022, T024–T029  | US1   |
| Phase 4: US2          | T031–T032    | T032                  | US2   |
| Phase 5: US3          | T033–T036    | T033–T034             | US3   |
| Phase 6: Polish       | T037–T038    | T037, T038            | —     |
| **Total**             | **38 tasks** | **27 parallelisable** |       |

**US1 task count**: 18 (T013–T030)  
**US2 task count**: 2 (T031–T032)  
**US3 task count**: 4 (T033–T036)  
**Setup + Foundational**: 12 (T001–T012)  
**Polish**: 2 (T037–T038)
