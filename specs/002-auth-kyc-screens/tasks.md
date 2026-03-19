# Tasks: Authentication and KYC Screens

**Input**: Design documents from `/specs/002-auth-kyc-screens/`
**Branch**: `002-auth-kyc-screens`
**Generated**: 2026-03-18
**Prerequisites**: Feature 001 (React Native Project Foundation) complete and app builds on Android.
**Sources**: plan.md, spec.md, data-model.md, contracts/api-contracts.md, research.md, quickstart.md

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1–US4)
- Exact file paths included in all descriptions

---

## Phase 1: Setup (Verify 001 Prerequisites)

**Purpose**: Confirm that the scaffolding from Feature 001 is correct before writing any new code.
No new files created here — read, inspect, and fix-in-place only.

- [X] T001 Verify `src/app/App.tsx` React Navigation v6 stack — confirm Auth stack contains SplashScreen, LoginScreen, OTPScreen, KYCScreen registered in that order; App stack contains HomeScreen; `gestureEnabled: false` and `headerBackVisible: false` set on post-auth screens (FR-022)
- [X] T002 Verify `src/features/auth/store/authSlice.ts` exported state shape matches data-model.md `AuthState` — fields `{ user: AuthUser | null, walletAddress: string | null, isAuthenticated: boolean, kycCompleted: boolean }` present; confirm `setUser`, `setWalletAddress`, `setKycCompleted`, `logout` reducers exported
- [X] T003 [P] Verify `src/types/navigation.ts` `RootStackParamList` — confirm `OTPScreen: { phone: string }` entry exists; confirm `SplashScreen`, `LoginScreen`, `KYCScreen`, `HomeScreen` entries match plan.md contracts

**Checkpoint**: All 001 prerequisites confirmed — ready for foundational work

---

## Phase 2: Foundational (Blocking Security Fix)

**Purpose**: One critical security gap (D-002) identified in `wallet.ts` must be closed before `OTPScreen` or `SplashScreen` can call wallet creation. This is a non-negotiable FR-013 requirement.

**⚠️ CRITICAL**: OTPScreen and SplashScreen wallet-creation code MUST NOT be written until T004 is complete.

- [X] T004 Fix `src/services/wallet.ts` — add `accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE` and `securityLevel: Keychain.SECURITY_LEVEL.SECURE_HARDWARE` to the `setGenericPassword` call (D-002 gap, FR-013). Keep existing `accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY`. Verify `getGenericPassword` call needs no signature change.

**Checkpoint**: `wallet.ts` is now FR-013 compliant. User story implementation can begin.

---

## Phase 3: User Story 1 — First-Time Farmer Login and KYC (Priority: P1) 🎯 MVP

**Goal**: A brand-new farmer can open the app, enter their phone number, verify the OTP, have a blockchain wallet silently created, complete KYC with name and Aadhaar, and land on HomeScreen — all in a single session.

**Independent Test**: Fresh install. Open app → SplashScreen (no session) → LoginScreen → enter `9999999999` → Send OTP → OTPScreen → enter `123456` (one digit per box, 6th digit auto-triggers verify) → wallet created silently → KYCScreen → enter name + `123456789012` → Continue → HomeScreen. Verify: Redux `isAuthenticated=true`, `kycCompleted=true`, `walletAddress` populated, `aadhaar_hash` is a 64-char hex string, raw Aadhaar absent from all logs and Redux state.

### Tests for User Story 1 ⚠️

- [X] T005 [P] [US1] Write `src/features/auth/store/__tests__/authSlice.test.ts` — unit tests covering: initial state shape, `setUser` sets `user` + `isAuthenticated=true`, `setWalletAddress` sets `walletAddress`, `setKycCompleted(true)` sets `kycCompleted=true`, `logout` resets all fields to initial state; confirm `aadhaar_hash` field is stored and raw Aadhaar is never a reducer argument
- [X] T006 [P] [US1] Write `src/features/auth/screens/__tests__/validation.test.ts` — unit tests for `loginSchema` (10-digit pass, 9-digit fail, 11-digit fail, non-numeric fail with message "Please enter a valid 10-digit number") and `kycSchema` (empty name fail, too-long name fail, 12-digit Aadhaar pass, 11-digit fail, non-numeric Aadhaar fail with message "Aadhaar number must be exactly 12 digits")

### Implementation for User Story 1

- [X] T007 [P] [US1] Design SplashScreen in Stitch MCP — generate NativeWind React Native layout: full-screen dark background, centred TerraTrust logo (Image), `spinning_leaf.json` Lottie animation below logo, no interactive elements; export as `src/features/auth/screens/SplashScreen.tsx` shell
- [X] T008 [US1] Implement `src/features/auth/screens/SplashScreen.tsx` (no-session routing path only — US2 adds session paths): mount Lottie `spinning_leaf.json`; in `useEffect` call `supabase.auth.getSession()`; if `session === null` call `navigation.replace('LoginScreen')`; keep `isAuthenticated` + `kycCompleted` values from Redux available for US2 extension
- [X] T009 [P] [US1] Design LoginScreen in Stitch MCP — generate NativeWind React Native layout: non-editable `+91` prefix badge + 10-digit phone `TextInput` side-by-side, "Send OTP" primary button (≥48×48px), inline error text slot below input, TerraTrust logo header; export as `src/features/auth/screens/LoginScreen.tsx` shell
- [X] T010 [US1] Implement `src/features/auth/screens/LoginScreen.tsx` — `useForm` with `loginSchema` (zod); `+91` prefix rendered as non-editable `Text` beside controlled `TextInput` (`keyboardType="phone-pad"`, `maxLength={10}`); on valid submit call `supabase.auth.signInWithOtp({ phone: '+91' + phoneNumber })`; on success `navigation.navigate('OTPScreen', { phone: '+91' + phoneNumber })`; on error show Supabase error message inline; loading state + disabled button during API call (FR-024)
- [X] T011 [P] [US1] Design OTPScreen in Stitch MCP — generate NativeWind React Native layout: instruction text row with masked phone ("Enter the 6-digit code sent to +91 XXXXXX1234"), 6 individual digit `TextInput` boxes horizontally arranged (each ≥48×48px), countdown/resend row below boxes, inline error text slot; export as `src/features/auth/screens/OTPScreen.tsx` shell
- [X] T012 [US1] Implement `src/features/auth/screens/OTPScreen.tsx` — 6 controlled single-char `TextInput` refs with auto-focus-next on digit entry and focus-prev on Backspace (FR-006, FR-007); display masked phone from `route.params.phone` (show last 4 digits, FR-008); `useEffect([otpValue])` auto-calls `supabase.auth.verifyOtp({ phone, token: otpValue, type: 'sms' })` when `otpValue.length === 6` with `loading` guard (D-004, FR-011); on verify success: check `auth.walletAddress === null` → if so call `wallet.ts createWallet()` + `api.post('/api/v1/auth/register-wallet', { wallet_address })` + `dispatch(setWalletAddress(address))` (failure-resilient per D-005); check `auth.kycCompleted` → if false `navigation.navigate('KYCScreen')`, if true `navigation.reset({ index: 0, routes: [{ name: 'HomeScreen' }] })` (D-006, FR-012–FR-015); on verify error show "Incorrect code. Please try again." inline and clear all digit boxes; loading indicator during verify (FR-024)
- [X] T013 [P] [US1] Design KYCScreen in Stitch MCP — generate NativeWind React Native layout: "Full Name" TextInput with hint text "Enter your name exactly as written on your land document (7/12 Extract)", "Aadhaar Number" numeric TextInput (`keyboardType="number-pad"`, `maxLength={12}`), "Continue" primary button (≥48×48px), inline error slots below each field; export as `src/features/auth/screens/KYCScreen.tsx` shell
- [X] T014 [US1] Implement `src/features/auth/screens/KYCScreen.tsx` — `useForm` with `kycSchema` (zod); on valid submit: call `api.post('/api/v1/auth/kyc', { full_name: fullName, aadhaar_number: aadhaarNumber })`; on HTTP 200: compute `aadhaarHash = await sha256(aadhaarNumber)` using `src/common/utils/hash.ts`; dispatch `setUser({ id: response.data.user_id, name: fullName, phone: auth.user?.phone ?? '', aadhaar_hash: aadhaarHash })`; dispatch `setKycCompleted(true)`; `navigation.reset({ index: 0, routes: [{ name: 'HomeScreen' }] })`; allow `aadhaarNumber` to go out of scope — never stored (D-003, FR-018–FR-020); on HTTP 400 show `response.data.error` inline; loading state + disabled button during submit (FR-024)

**Checkpoint**: Full first-time flow (SplashScreen → Login → OTP → KYC → HomeScreen) is functional and independently testable

---

## Phase 4: User Story 2 — Returning Farmer Bypasses Login (Priority: P2)

**Goal**: A farmer who previously completed KYC opens the app and lands directly on HomeScreen in ≤ 2 seconds, with no login interaction.

**Independent Test**: Complete User Story 1 flow. Close the app. Reopen. Verify: SplashScreen appears briefly → HomeScreen loads without showing LoginScreen or OTPScreen. Redux `isAuthenticated` and `kycCompleted` remain `true`. Also test the KYC-incomplete returning path: force-quit after OTP verify but before KYC → reopen → app navigates to KYCScreen, not LoginScreen.

### Implementation for User Story 2

- [X] T015 [US2] Extend `src/features/auth/screens/SplashScreen.tsx` with session-exists routing paths — after `supabase.auth.getSession()`: if `session !== null && kycCompleted === true` → `navigation.replace('HomeScreen')`; if `session !== null && kycCompleted === false` → check `walletAddress === null` (retry wallet creation: `createWallet()` + `registerWallet()` if null, D-005) → `navigation.replace('KYCScreen')`; if Supabase session exists but Redux `isAuthenticated` is false, treat as unauthenticated → `navigation.replace('LoginScreen')` (D-001 dual-check); all three paths use `replace`/`reset` so SplashScreen is removed from back stack (FR-002)
- [X] T016 [US2] Verify/patch `src/app/App.tsx` back-navigation prevention — confirm authenticated screens (KYCScreen, HomeScreen and beyond) have `gestureEnabled: false` on their `Screen` options OR that `navigation.reset()` calls in T012 and T014 eliminate auth screens from stack; add `android:hardwareAccelerated="true"` check is out-of-scope; document any required App.tsx edit, apply minimal fix if missing (FR-022, D-006)

### Tests for User Story 2

- [X] T017 [P] [US2] Write `src/features/auth/screens/__tests__/SplashScreen.test.tsx` — integration tests using RNTL + mocked `supabase.auth.getSession()` and mocked Redux store: (a) no session → navigates to `LoginScreen`; (b) session + kycCompleted=true → navigates to `HomeScreen`; (c) session + kycCompleted=false → navigates to `KYCScreen`; (d) session + walletAddress=null → triggers wallet creation before routing to KYCScreen; all routing calls use `replace` not `navigate`

**Checkpoint**: Returning farmer landed on HomeScreen < 2 s. All three SplashScreen routing paths verified by tests.

---

## Phase 5: User Story 3 — OTP Resend and Timer (Priority: P3)

**Goal**: A farmer on OTPScreen sees a 28-second countdown and, once it reaches zero, can request a new OTP that restarts the timer.

**Independent Test**: Navigate to OTPScreen. Confirm "Resend in 28s" text appears immediately. Wait for countdown to reach 0. Confirm "Resend OTP" interactive link replaces the countdown text. Tap "Resend OTP". Confirm countdown restarts from 28. Confirm `supabase.auth.signInWithOtp` is called again with the same phone number.

### Implementation for User Story 3

- [X] T018 [US3] Implement OTPScreen.tsx 28-second countdown timer — add `countdown` state initialised to `28`; `useEffect` with `setInterval` decrements by 1 each second; clears interval at 0; when `countdown > 0` render `"Resend in {countdown}s"` as non-interactive `Text`; when `countdown === 0` render `"Resend OTP"` as tappable `TouchableOpacity` (≥48×48px) in `src/features/auth/screens/OTPScreen.tsx` (FR-009)
- [X] T019 [US3] Implement OTPScreen.tsx Resend OTP tap handler — `handleResend()` calls `supabase.auth.signInWithOtp({ phone: route.params.phone })`; on success resets `countdown` to `28` and restarts the interval; on error shows inline error; clears all 6 digit boxes and resets `otpValue` on resend in `src/features/auth/screens/OTPScreen.tsx` (FR-010)

**Checkpoint**: OTP countdown and resend independently functional. No verify button required.

---

## Phase 6: User Story 4 — Input Validation Prevents Invalid Submissions (Priority: P3)

**Goal**: Submitting LoginScreen with fewer/more than 10 digits, or KYCScreen with empty name or non-12-digit Aadhaar, surfaces a clear inline error and makes no API call.

**Independent Test**: LoginScreen: enter `99999999` (8 digits), tap Send OTP — verify "Please enter a valid 10-digit number" inline error, network inspector shows zero calls. KYCScreen: leave name blank, tap Continue — verify name-required error. KYCScreen: enter `12345678901` (11 digits) as Aadhaar, tap Continue — verify Aadhaar-format error, no API call.

### Implementation for User Story 4

- [X] T020 [P] [US4] Implement LoginScreen.tsx inline validation error display — ensure `react-hook-form` `formState.errors.phoneNumber` is rendered as styled inline `Text` element directly below the phone input using the exact string "Please enter a valid 10-digit number" from `loginSchema`; confirm form `handleSubmit` callback suppresses API call when validation fails in `src/features/auth/screens/LoginScreen.tsx` (FR-004)
- [X] T021 [P] [US4] Implement KYCScreen.tsx inline validation error display — ensure `formState.errors.fullName` and `formState.errors.aadhaarNumber` are each rendered as styled inline `Text` elements below their respective inputs; confirm "Full name is required" and "Aadhaar number must be exactly 12 digits" messages surface from `kycSchema`; confirm `handleSubmit` suppresses API call on validation failure in `src/features/auth/screens/KYCScreen.tsx` (FR-017)

**Checkpoint**: Both P3 stories complete. All four user stories independently testable.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: FR-024 loading states, accessibility touch-target audit, and full manual validation pass.

- [X] T022 [P] Add loading states and disabled buttons — in `src/features/auth/screens/LoginScreen.tsx`: show `Loader` component and disable "Send OTP" button while `isLoading` is true; in `src/features/auth/screens/OTPScreen.tsx`: show loader and disable digit boxes while verify is in progress; in `src/features/auth/screens/KYCScreen.tsx`: show loader and disable "Continue" button during KYC submit; use `spinning_leaf.json` Lottie or the shared `Loader` component from `src/common/components/Loader.tsx` (FR-024)
- [X] T023 [P] Verify ≥ 48 × 48 px touch targets across all auth screens — use Android accessibility inspector or layout bounds to confirm each OTP digit box, "Send OTP" button, "Continue" button, and "Resend OTP" link meets FR-023 minimum; apply `className="min-h-[48px] min-w-[48px]"` NativeWind fixes as needed across `SplashScreen.tsx`, `LoginScreen.tsx`, `OTPScreen.tsx`, `KYCScreen.tsx`
- [ ] T024 Run `quickstart.md` manual testing checklist — execute all 14 checklist items on a physical Android device or emulator with PIN set; confirm: fresh install flow, auto-verify without button tap, wallet address in Redux and not in logs, private key not in logs, persisted session on reopen, countdown/resend, wrong-OTP inline error, 8-digit phone error, 11-digit Aadhaar error, touch targets; mark checklist items complete in `specs/002-auth-kyc-screens/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately; read/verify only
- **Foundational (Phase 2)**: Depends on Phase 1 completion — **BLOCKS all user stories**
- **US1 (Phase 3)**: Depends on Phase 2 (wallet.ts fixed) — **highest priority, start here**
- **US2 (Phase 4)**: Depends on Phase 3 (SplashScreen base + OTPScreen wallet flow must exist to extend)
- **US3 (Phase 5)**: Depends on Phase 3 T012 (OTPScreen must exist to add timer to)
- **US4 (Phase 6)**: Depends on Phase 3 T010 and T014 (screens must exist to wire validation display)
- **Polish (Phase 7)**: Depends on all user story phases being complete

### User Story Dependencies

| Story | Depends On                     | Can Parallelise With                                 |
| ----- | ------------------------------ | ---------------------------------------------------- |
| US1   | Phase 2 only                   | Tests T005, T006; Stitch designs T007/T009/T011/T013 |
| US2   | US1 (SplashScreen exists)      | Tests T017 (new file)                                |
| US3   | US1 T012 (OTPScreen exists)    | US2, US4 in Phase 6                                  |
| US4   | US1 T010, T014 (screens exist) | T020 ‖ T021 (different files)                        |

### Parallel Opportunities per Story

**US1 parallelism** (after wallet.ts fix T004 is done):

```
T005 ‖ T006 ‖ T007 ‖ T009 ‖ T011 ‖ T013   (tests + Stitch designs — all independent)
       ↓
T008 (SplashScreen impl)  →  T015 (US2 extends it)
       ↓
T010 (LoginScreen impl)
       ↓
T012 (OTPScreen impl)     →  T018, T019 (US3 extends it)
       ↓
T014 (KYCScreen impl)     →  T021 (US4 extends it)
```

**Post-US1 parallelism**:

```
T015 + T016 + T017   (US2 — SplashScreen extension, App.tsx verify, tests)
T018 ↓ T019          (US3 — serial within OTPScreen file)
T020 ‖ T021          (US4 — different files, fully parallel)
T022 ‖ T023          (Polish — different concerns)
```

---

## Implementation Strategy

**MVP Scope**: Complete Phase 1 → Phase 2 → Phase 3 (US1) only.
This delivers the full new-farmer sign-up flow end-to-end and unblocks all other features.

**Incremental delivery**:

1. **Sprint 1 MVP**: T001–T014 (Setup + Foundation + all US1 screens)
2. **Sprint 2**: T015–T017 (US2 returning farmer), T018–T019 (US3 timer)
3. **Sprint 3**: T020–T021 (US4 validation), T022–T024 (Polish + QA)

**Screen commit cadence** (per COMMIT FORMAT rule — one commit per completed SpecKit task):

```
[T004] Fix wallet.ts ACCESS_CONTROL security gap
[T008] Implement SplashScreen Lottie + no-session routing
[T010] Implement LoginScreen +91 phone input and OTP send
[T012] Implement OTPScreen 6-box auto-verify and wallet creation
[T014] Implement KYCScreen Aadhaar SHA-256 hash and KYC submit
[T015] Implement SplashScreen session-exists routing paths
...
```

---

## Summary

| Metric                       | Value                                       |
| ---------------------------- | ------------------------------------------- |
| Total tasks                  | 24                                          |
| Setup tasks (Phase 1)        | 3 (T001–T003)                               |
| Foundational tasks (Phase 2) | 1 (T004)                                    |
| US1 tasks (Phase 3)          | 10 (T005–T014) — tests + 4 screens          |
| US2 tasks (Phase 4)          | 3 (T015–T017)                               |
| US3 tasks (Phase 5)          | 2 (T018–T019)                               |
| US4 tasks (Phase 6)          | 2 (T020–T021)                               |
| Polish tasks (Phase 7)       | 3 (T022–T024)                               |
| Tasks marked [P]             | 13 — significant parallel opportunities     |
| Test tasks included          | Yes — explicitly required by plan.md        |
| Stitch MCP design tasks      | 4 — one per screen, all [P], before impl    |
| MVP scope                    | US1 only (T001–T014): 14 tasks              |
| Format validation            | ✅ All tasks: checkbox + ID + labels + path |
