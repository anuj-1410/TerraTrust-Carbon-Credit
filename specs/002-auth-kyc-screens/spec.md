# Feature Specification: Authentication and KYC Screens

**Feature Branch**: `002-auth-kyc-screens`  
**Created**: 2026-03-18  
**Status**: Draft  
**Input**: User description: "Authentication and KYC. Build SplashScreen, LoginScreen, OTPScreen, KYCScreen. Supabase phone OTP auth. Silent ethers.js wallet creation after first login. authSlice. All four screens with navigation wired. Frontend only."

## User Scenarios & Testing _(mandatory)_

### User Story 1 — First-Time Farmer Login and KYC Registration (Priority: P1)

A new farmer opens the app for the first time. The app shows the TerraTrust logo while silently checking for a saved session. Finding none, it navigates to the phone number entry screen. The farmer types their 10-digit Indian mobile number, taps "Send OTP", and receives a 6-digit SMS code. They enter the code into six individual digit boxes — each box automatically advancing focus to the next as they type. After successful verification, a blockchain wallet is silently created and its public address saved to the server. The farmer is then taken to the KYC screen where they enter their full legal name (which will later be matched against their land document) and their 12-digit Aadhaar number. Tapping "Continue" sends the data to the backend, which stores the name and a hash of the Aadhaar — never the raw number. The farmer lands on the Home screen.

**Why this priority**: No other feature in the app can function without a verified identity. This is the entry gate — every farmer must pass through it exactly once.

**Independent Test**: Install a fresh build on a test device. Open the app, enter a Supabase test phone number, enter the configured test OTP code, fill in name and Aadhaar, tap Continue. Verify the farmer lands on HomeScreen with `isAuthenticated=true` and `kycCompleted=true` in Redux, and that `wallet_address` has been registered on the backend.

**Acceptance Scenarios**:

1. **Given** the app has no stored session, **When** the app launches, **Then** SplashScreen appears showing the app logo with a Lottie loading indicator, then automatically navigates to LoginScreen.
2. **Given** the farmer is on LoginScreen, **When** they enter exactly 10 digits and tap "Send OTP", **Then** `supabase.auth.signInWithOtp` is called and the farmer is navigated to OTPScreen.
3. **Given** the farmer is on OTPScreen, **When** they tap each of the 6 digit boxes, **Then** focus automatically advances to the next box, and backspace returns focus to the previous box.
4. **Given** the farmer has entered all 6 digits on OTPScreen, **When** the last digit is entered, **Then** `supabase.auth.verifyOtp` is called automatically without requiring a button tap.
5. **Given** OTP verification succeeds and no wallet exists, **When** the verification completes, **Then** a new ethers.js wallet is generated silently, the private key is stored only in react-native-keychain, and the public address is sent to `POST /api/v1/auth/register-wallet`.
6. **Given** wallet creation completes and KYC is not done, **When** navigating forward, **Then** the farmer is taken to KYCScreen and not HomeScreen.
7. **Given** the farmer is on KYCScreen, **When** they enter their full name and a valid 12-digit Aadhaar then tap "Continue", **Then** `POST /api/v1/auth/kyc` is called, `kycCompleted` is set to `true` in Redux, and the farmer is navigated to HomeScreen.

---

### User Story 2 — Returning Farmer Bypasses Login (Priority: P2)

A farmer who completed login and KYC yesterday opens the app again. The Splash screen checks MMKV-persisted Redux state and finds a valid Supabase session with KYC already complete. The farmer is taken directly to HomeScreen with no login steps required.

**Why this priority**: Forcing a returning farmer to re-enter their phone number and OTP every time is a critical usability failure on a farming app. Session persistence is required for the app to be usable in day-to-day operations.

**Independent Test**: Complete the full first-time login (User Story 1). Close and reopen the app. Verify the farmer lands on HomeScreen immediately, with no LoginScreen or OTPScreen shown, and Redux `isAuthenticated` and `kycCompleted` remain `true`.

**Acceptance Scenarios**:

1. **Given** the app has a persisted valid Supabase session and `kycCompleted=true` in MMKV, **When** the app launches, **Then** SplashScreen navigates directly to HomeScreen without showing LoginScreen.
2. **Given** the app has a persisted valid session but `kycCompleted=false`, **When** the app launches, **Then** SplashScreen navigates to KYCScreen, not LoginScreen.
3. **Given** the persisted session has expired or the user logged out, **When** the app launches, **Then** SplashScreen navigates to LoginScreen.

---

### User Story 3 — OTP Resend and Timer (Priority: P3)

A farmer on OTPScreen does not receive the SMS in time. They watch a 28-second countdown. When it reaches zero, a "Resend OTP" button appears. Tapping it sends a new OTP and restarts the countdown.

**Why this priority**: SMS delivery can fail or be delayed. Without a resend path, a farmer with a lost SMS is permanently locked out of that login attempt.

**Independent Test**: Navigate to OTPScreen. Observe the "Resend in 28s" countdown. Wait for it to reach 0. Verify the "Resend OTP" link appears. Tap it. Verify a new OTP is sent and the countdown restarts.

**Acceptance Scenarios**:

1. **Given** the farmer has just arrived at OTPScreen, **When** it loads, **Then** a countdown timer shows "Resend in 28s" and counts down to 0.
2. **Given** the countdown has reached 0, **When** the timer expires, **Then** the countdown is replaced by a "Resend OTP" interactive link.
3. **Given** the farmer taps "Resend OTP", **When** the link is tapped, **Then** `supabase.auth.signInWithOtp` is called again with the same phone number and the countdown restarts from 28 seconds.

---

### User Story 4 — Input Validation Prevents Invalid Submissions (Priority: P3)

A farmer accidentally types 8 digits instead of 10 on LoginScreen, or enters 11 digits for Aadhaar on KYCScreen. The app shows a clear inline error message and does not call any API.

**Why this priority**: Validation prevents failed API calls and provides immediate feedback to farmers with limited smartphone experience.

**Independent Test**: On LoginScreen, enter 8 digits and tap "Send OTP". Verify "Please enter a valid 10-digit number" appears and no API call is made. On KYCScreen, leave the name empty and tap "Continue". Verify a name-required error appears.

**Acceptance Scenarios**:

1. **Given** the farmer is on LoginScreen, **When** they tap "Send OTP" with fewer or more than 10 digits, **Then** the error "Please enter a valid 10-digit number" is shown inline and no API call is made.
2. **Given** the farmer is on KYCScreen, **When** they tap "Continue" with an empty name field, **Then** an error indicates the name is required.
3. **Given** the farmer is on KYCScreen, **When** they tap "Continue" with an Aadhaar number that is not exactly 12 digits, **Then** an error indicates the format is invalid and no API call is made.

---

### Edge Cases

- What happens when OTP verification fails (wrong code)? Show "Incorrect code. Please try again." inline error. Keep the farmer on OTPScreen.
- What happens when `POST /api/v1/auth/kyc` returns a 400 error? Show the backend error message inline on KYCScreen without leaving the screen.
- What happens when `POST /api/v1/auth/register-wallet` fails (network error)? The farmer should still proceed to KYCScreen/HomeScreen. The wallet registration can be retried on next launch by checking `walletAddress === null` in the session check on SplashScreen.
- What happens when the farmer minimises the app mid-OTP entry? The 6-digit inputs retain their values. The countdown timer continues in the background and accurately reflects elapsed time when the farmer returns.
- What happens if ethers.js wallet creation fails? Show a non-blocking error toast. The farmer proceeds through KYC. Wallet creation is retried on the next launch (same SplashScreen check).

## Requirements _(mandatory)_

### Functional Requirements

**FR-001**: The app MUST display SplashScreen with the TerraTrust logo and a Lottie `spinning_leaf.json` animation on every launch while performing session checks.

**FR-002**: SplashScreen MUST check MMKV-persisted Redux state for a valid Supabase auth session and route the farmer to exactly one destination: `HomeScreen` (session valid + KYC done), `KYCScreen` (session valid + KYC not done), or `LoginScreen` (no valid session).

**FR-003**: LoginScreen MUST display a phone number input field with a non-editable `+91` prefix showing the Indian country code by default.

**FR-004**: LoginScreen MUST validate that the user-entered number is exactly 10 digits. On invalid input, it MUST display "Please enter a valid 10-digit number" and prevent the API call.

**FR-005**: LoginScreen MUST call `supabase.auth.signInWithOtp({ phone: '+91XXXXXXXXXX' })` on valid submission and navigate to OTPScreen on success.

**FR-006**: OTPScreen MUST present exactly 6 individual single-digit input boxes arranged horizontally.

**FR-007**: OTPScreen digit boxes MUST auto-focus the next box when a digit is entered and return focus to the previous box when the Backspace key is pressed.

**FR-008**: OTPScreen MUST display the farmer's masked phone number in the instruction text (e.g., "Enter the 6-digit code sent to +91 XXXXXX1234").

**FR-009**: OTPScreen MUST display a countdown timer starting at 28 seconds showing "Resend in Xs". When the timer reaches 0, a "Resend OTP" tappable link MUST replace the countdown.

**FR-010**: Tapping "Resend OTP" MUST call `supabase.auth.signInWithOtp` again with the same phone number and restart the 28-second countdown.

**FR-011**: OTPScreen MUST call `supabase.auth.verifyOtp({ phone, token, type: 'sms' })` automatically when all 6 digits are filled, without requiring a separate "Verify" button tap.

**FR-012**: After successful OTP verification, the app MUST check whether a `wallet_address` exists on the authenticated user profile. If it is null or absent, silent wallet creation MUST be performed immediately before any navigation.

**FR-013**: Silent wallet creation MUST use `ethers.Wallet.createRandom()` to generate a private key and public address. The private key MUST be stored exclusively in `react-native-keychain` using `ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE`. The private key MUST NEVER be placed in Redux state, MMKV, AsyncStorage, or any log output.

**FR-014**: After silent wallet creation, the public wallet address MUST be sent to `POST /api/v1/auth/register-wallet` with the Supabase JWT in the Authorization header.

**FR-015**: After wallet handling, the app MUST check `kycCompleted` and route to `KYCScreen` if false, or `HomeScreen` if true.

**FR-016**: KYCScreen MUST present two input fields: "Full Name" with hint "Enter your name exactly as written on your land document (7/12 Extract)" and "Aadhaar Number" configured as a numeric input limited to 12 digits.

**FR-017**: KYCScreen MUST validate that the Full Name field is not empty and that Aadhaar is exactly 12 digits before enabling the API call.

**FR-018**: On KYCScreen submission, the app MUST call `POST /api/v1/auth/kyc` with `{ full_name, aadhaar_number }` in the request body. The Aadhaar number MUST be sent as the raw 12-digit string — the backend is responsible for hashing it. The frontend MUST NOT log or store the raw Aadhaar after the API call completes.

**FR-019**: On successful KYC response, the app MUST set `kycCompleted = true` in Redux `authSlice` and navigate to HomeScreen.

**FR-020**: The `authSlice` MUST hold the following state shape: `{ user: { id, name, phone, aadhaar_hash }, walletAddress: string, isAuthenticated: boolean, kycCompleted: boolean }`. The `aadhaar_hash` field in Redux MUST only ever store a SHA-256 hash string returned from the backend — never the raw Aadhaar number.

**FR-021**: `auth.walletAddress` and `auth.isAuthenticated` MUST be persisted to MMKV via redux-persist so the farmer is not forced to re-authenticate on every app launch.

**FR-022**: All four screens MUST be connected via React Navigation v6 native stack. The navigation configuration MUST prevent the farmer from pressing the hardware back button to return to SplashScreen, LoginScreen, or OTPScreen once authenticated.

**FR-023**: All interactive elements (buttons, input fields, OTP digit boxes) MUST meet a minimum 48×48px touch target size to satisfy Android accessibility requirements.

**FR-024**: All loading states (OTP send, OTP verify, KYC submit) MUST display a loading indicator and disable the action button to prevent duplicate submissions.

### Key Entities

- **AuthSession**: Supabase session token returned after OTP verification. Stored in Supabase client's internal storage. Persisted indirectly through `auth.isAuthenticated` flag in MMKV.
- **FarmerUser**: `{ id: UUID, name: string, phone: string, aadhaar_hash: string }` — represents the authenticated farmer's identity. `aadhaar_hash` is the SHA-256 hex string received from the backend response; the raw Aadhaar is discarded after the API call.
- **FarmerWallet**: `{ walletAddress: string }` — public Polygon address only. The private key is a device-only secret in Android Keystore via react-native-keychain; it has no representation in any app state store.
- **KYCSubmission**: `{ full_name: string, aadhaar_number: string }` — transient request body constructed on KYCScreen submission, discarded immediately after the HTTP call.

## Success Criteria _(mandatory)_

### Measurable Outcomes

**SC-001**: A new farmer with no prior account can complete the full sign-up flow (phone entry → OTP → KYC) and arrive on HomeScreen in under 90 seconds, assuming SMS delivery within 30 seconds.

**SC-002**: A returning farmer who previously completed KYC is taken directly to HomeScreen within 2 seconds of launching the app, with no login interaction required.

**SC-003**: 100% of OTP digit-box interactions correctly advance or retreat focus without the farmer manually tapping the next box.

**SC-004**: The farmer's Aadhaar number is never present in Redux state, MMKV storage, any log file, or network request body after the single KYC API call completes. Verified by inspecting Redux DevTools, MMKV content, and network logs post-submission.

**SC-005**: The farmer's wallet private key is exclusively present in Android Keystore (via react-native-keychain) and is absent from all other storage mechanisms. Verified by confirming it does not appear in Redux state, MMKV, or any logged output throughout the session.

**SC-006**: All four screens render without layout overflow or truncated text on Android devices from 360dp to 430dp width (covers budget phones at Rs 8,000 upward, released post-2018).

**SC-007**: The SplashScreen routing decision completes in under 1 second on a mid-range device (Snapdragon 680 class), so the farmer experiences no perceptible delay before navigation.

## Assumptions

- Supabase project is configured with Phone Auth provider enabled and a test phone number/OTP pair available for development (as documented in SRS Section 4).
- The backend (`POST /api/v1/auth/kyc` and `POST /api/v1/auth/register-wallet`) is deployed and reachable at the URL configured in `.env` via `react-native-config`.
- The React Navigation v6 stack is already set up in `src/app/App.tsx` with an Auth stack (SplashScreen, LoginScreen, OTPScreen, KYCScreen) and an App stack (HomeScreen and subsequent screens). HomeScreen is a placeholder stub if not yet built.
- `src/store/mmkvStorage.ts` MMKV adapter and `src/store/index.ts` redux-persist configuration already exist and are functional (established in Feature 001).
- The font Roboto is available; numerical CTT balances elsewhere in the app use Roboto Mono, but Auth/KYC screens contain no numerical data values requiring Roboto Mono specifically.
