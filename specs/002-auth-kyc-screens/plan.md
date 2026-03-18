# Implementation Plan: Authentication and KYC Screens

**Branch**: `002-auth-kyc-screens` | **Date**: 2026-03-18 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-auth-kyc-screens/spec.md`

## Summary

Implement the four authentication and KYC screens (SplashScreen, LoginScreen, OTPScreen, KYCScreen) with full Supabase phone OTP auth, silent ethers.js wallet creation stored exclusively in react-native-keychain with `ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE`, on-device SHA-256 Aadhaar hashing via react-native-quick-crypto before any Redux storage, wired React Navigation v6 native stack with authenticated-screen back-nav prevention, and the pre-scaffolded authSlice wired to all screens. SplashScreen routing: session valid + KYC done → HomeScreen; session valid + no KYC → KYCScreen; no session → LoginScreen.

## Technical Context

**Language/Version**: TypeScript 5.0+ strict mode (`"strict": true`). React Native 0.84.1. NOT Expo.  
**Primary Dependencies**: @supabase/supabase-js (phone OTP auth), ethers v6 (wallet creation), react-native-keychain (private key ONLY), react-native-quick-crypto (SHA-256 Aadhaar hash), react-hook-form + zod (form validation), React Navigation v6 native stack, NativeWind 4.0, Redux Toolkit 2.0, lottie-react-native, axios (api.ts with JWT interceptor)  
**Storage**: `react-native-mmkv` via redux-persist (auth slice — all fields persisted, no blacklist). `react-native-keychain` for private key ONLY (never MMKV/Redux/logs). Supabase session persisted via MMKV adapter in `src/services/supabase.ts` (`persistSession: true`, `autoRefreshToken: true`).  
**Testing**: Jest + React Native Testing Library (RNTL). Unit tests for authSlice reducers and zod validation schemas. Integration tests for SplashScreen routing logic. Physical device required for Keychain + Supabase OTP integration.  
**Target Platform**: Android 13+ (API 33 minimum), API 34 target. Physical device preferred for Keychain; emulator acceptable for UI smoke tests.  
**Project Type**: mobile-app (React Native CLI, Android-only, field operations tool)  
**Performance Goals**: SplashScreen routing decision < 1s on Snapdragon 680 class (SC-007). MMKV session read synchronous < 1ms. Returning farmer on HomeScreen < 2s cold start (SC-002).  
**Constraints**: Private key NEVER in Redux/MMKV/AsyncStorage/logs (FR-013, non-negotiable). Raw Aadhaar discarded after API call — SHA-256 hash computed on-device before dispatching to Redux (user requirement). Supabase Auth only — no Firebase (user requirement). Back navigation to SplashScreen/Login/OTP blocked from authenticated screens (FR-022). All touch targets ≥ 48×48px (FR-023).  
**Scale/Scope**: 4 screens, 1 Redux slice (authSlice — already scaffolded in 001), 2 backend API endpoints, 1 Supabase OTP flow.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

Verify ALL of the following before proceeding:

- [x] **Scope** (Principle I): This feature is frontend-only React Native.
      No backend, Python, Solidity, or GEE code is written here.
      Both API endpoints (`POST /api/v1/auth/kyc` and
      `POST /api/v1/auth/register-wallet`) verified against
      `SRS_TerraTrust_v3.1.txt §5.2, §5.3, §8.2` and BSDD §4.2.
      See `contracts/api-contracts.md`.
- [x] **Security** (Principle II): Private key stored in
      `react-native-keychain` with `ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE`
      (FR-013). Existing `wallet.ts` uses `accessible` only — must be
      updated to add `accessControl` per FR-013 (gap identified in
      research.md Decision D-002). Raw Aadhaar is sent to API once
      (FR-018) then immediately SHA-256 hashed on-device via
      `react-native-quick-crypto` before Redux dispatch (FR-020).
      Only the hash is stored in Redux `auth.user.aadhaar_hash`.
      Evidence photos: not in scope for this feature. Mock GPS: not
      in scope for auth screens. `.env` in `.gitignore` (established
      in 001). `SUPABASE_SERVICE_KEY` absent from app (uses ANON_KEY).
- [x] **Offline-first** (Principle III): SplashScreen session check
      reads `supabase.auth.getSession()` from MMKV (synchronous,
      offline-capable — `persistSession: true` in supabase.ts).
      Routing reads `auth.isAuthenticated` and `auth.kycCompleted`
      from MMKV-persisted Redux — no network call required for routing
      decision (verified in research.md Decision D-001). Auth itself
      requires internet for OTP; no offline mode for first login
      (by design — phone OTP is inherently online).
      Tree scan offline-first: not in scope for this feature.
- [x] **AR Tier integers** (Principle IV): Not in scope for auth/KYC
      screens. Tier types already defined in auditSlice (001 output).
      No AR tier references appear in auth code.
- [x] **Boundary authority** (Principle V): Not in scope for auth/KYC
      screens. No map, polygon, or boundary UI here.
- [x] **Persistence discipline** (Principle VI): `auth` slice has no
      blacklist in `src/store/index.ts` — all fields persisted:
      `auth.walletAddress` ✅, `auth.isAuthenticated` ✅,
      `auth.kycCompleted` ✅, `auth.user` ✅. `audit.uploadStatus`
      and `land.currentDraft` blacklisted (established in 001 — not
      touched by this feature).
- [x] **Stitch-first UI** (Principle VII): Stitch MCP UI designs
      generated before implementing each of the four screens.
      NativeWind only — no `StyleSheet.create`. All touch targets
      ≥ 48×48px (OTP digit boxes, Send OTP button, Continue button).
      `spinning_leaf.json` used on SplashScreen. No Roboto Mono needed
      (auth screens contain no numerical measurement values). No
      status badge strings appear in auth flow.

## Project Structure

### Documentation (this feature)

```text
specs/002-auth-kyc-screens/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output — 6 decisions resolved
├── data-model.md        # Phase 1 output — AuthUser, AuthState, FarmerWallet, form schemas
├── quickstart.md        # Phase 1 output — dev setup, test flows, common issues
├── contracts/
│   └── api-contracts.md # Phase 1 output — Supabase OTP + register-wallet + KYC contracts
└── tasks.md             # Phase 2 output (/speckit.tasks command — NOT created by /speckit.plan)
```

### Source Code (repository root)

Files created or modified by this feature (relative to workspace root):

```text
# Modified (content implemented — stubs upgraded to full screens)
src/features/auth/screens/SplashScreen.tsx   # Session check + Lottie + routing
src/features/auth/screens/LoginScreen.tsx    # +91 prefix phone input + zod + Supabase OTP
src/features/auth/screens/OTPScreen.tsx      # 6 digit boxes + auto-verify + 28s countdown
src/features/auth/screens/KYCScreen.tsx      # Name + Aadhaar + on-device SHA-256 hash

# Modified (gaps fixed per implementation plan)
src/services/wallet.ts                       # Add ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE

# Already complete (from 001) — verified, no changes needed
src/features/auth/store/authSlice.ts         # setUser, setWalletAddress, setKycCompleted, logout
src/services/supabase.ts                     # Supabase client with MMKV session storage
src/services/api.ts                          # Axios instance + JWT interceptor
src/store/index.ts                           # redux-persist + auth slice (no blacklist)
src/app/App.tsx                              # React Navigation stack (verify back-nav prevention)
src/types/navigation.ts                      # RootStackParamList (OTPScreen: { phone: string })

# Test files (new)
src/features/auth/store/__tests__/authSlice.test.ts
src/features/auth/screens/__tests__/SplashScreen.test.tsx
```

**Structure Decision**: Single React Native app (no monorepo). All auth code lives in `src/features/auth/`. Existing services (`api.ts`, `supabase.ts`, `wallet.ts`) in `src/services/` are shared across features per the constitution's mandatory folder structure.

## Complexity Tracking

> No Constitution Check violations. All gates pass. No justification table needed.

## Post-Design Constitution Re-Check

_Completed after Phase 1 (data-model.md, contracts/api-contracts.md, quickstart.md)._

| Principle              | Status     | Notes                                                                                                                                                                                                                                                                                                   |
| ---------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I — Scope              | ✅ PASS    | Only `src/features/auth/screens/`, `src/services/wallet.ts`. All API contracts in `contracts/api-contracts.md` verified against SRS §5.2, §5.3, §8.2.                                                                                                                                                   |
| II — Security          | ✅ PASS    | `wallet.ts` gap (D-002) identified and resolution specified: add `accessControl: BIOMETRY_ANY_OR_DEVICE_PASSCODE`. Aadhaar hash flow documented in data-model.md §KYCFormValues and contracts/api-contracts.md §POST /api/v1/auth/kyc. Raw Aadhaar discarded after API call — call-stack variable only. |
| III — Offline-First    | ✅ PASS    | SplashScreen reads MMKV (D-001). First-time OTP inherently requires internet — documented in quickstart.md. No offline-first gap introduced.                                                                                                                                                            |
| IV — AR Tier integers  | ✅ N/A     | No AR tier code in auth feature.                                                                                                                                                                                                                                                                        |
| V — Boundary authority | ✅ N/A     | No map or boundary UI in auth feature.                                                                                                                                                                                                                                                                  |
| VI — Persistence       | ✅ PASS    | auth slice full-persist confirmed in data-model.md §AuthState. `audit.uploadStatus` and `land.currentDraft` blacklists not touched.                                                                                                                                                                     |
| VII — Stitch-first UI  | ⬜ PENDING | Stitch MCP designs must be generated at the start of each screen's implementation task. This plan documents the requirement; tasks.md will enforce it as the first task for each screen.                                                                                                                |
