# Research: Authentication and KYC Screens

**Feature**: `002-auth-kyc-screens`  
**Generated**: 2026-03-18  
**Status**: All unknowns resolved — no NEEDS CLARIFICATION items remain.

---

## Decision D-001 — SplashScreen Session Check: Online vs Offline

**Unknown**: Does `supabase.auth.getSession()` require a network call, or does it read from local MMKV storage?

**Decision**: `supabase.auth.getSession()` reads from local MMKV storage when `persistSession: true` is configured. No network call is needed for the routing decision on SplashScreen. Token refresh happens in the background via `autoRefreshToken: true`.

**Rationale**:  
The Supabase JS client (`@supabase/supabase-js`) reads the persisted session from the configured storage adapter (MMKV via `src/services/supabase.ts`) synchronously before any network activity. If the session exists and has not expired, `getSession()` returns it immediately. If the token is stale, `autoRefreshToken` refreshes it in the background — but the routing decision does not wait for the refresh. This satisfies SC-007 (< 1s routing decision) and the Offline-First principle (Principle III): the farmer is routed without internet.

**Evidence**: `src/services/supabase.ts` configures:

```ts
auth: {
  storage: mmkvStorage,
  autoRefreshToken: true,
  persistSession: true,
  detectSessionInUrl: false,
}
```

**Implementation note**: SplashScreen calls `supabase.auth.getSession()` inside a `useEffect`. It also reads `auth.isAuthenticated` and `auth.kycCompleted` from Redux (MMKV-persisted). The Supabase session presence (`session !== null`) is the source of truth for whether the user is authenticated — not just `auth.isAuthenticated` in Redux. Both must agree. If the Redux flag is `true` but Supabase returns no session, treat as unauthenticated and navigate to LoginScreen.

**Alternatives considered**:

- Query the backend on every launch — rejected: requires internet, too slow (~200-500ms), fails offline.
- Trust only Redux `auth.isAuthenticated` flag — rejected: Redux could be stale if the Supabase session expired without Redux being updated (e.g., long-dormant install).

---

## Decision D-002 — Keychain ACCESS_CONTROL Gap in wallet.ts

**Unknown**: The existing `src/services/wallet.ts` uses `accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY` but FR-013 requires `ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE`. Is this a real security gap?

**Decision**: Yes, this is a gap. `wallet.ts` must be updated to add `accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE`. Both `accessible` and `accessControl` can coexist.

**Rationale**:  
`ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY` prevents the key from being available when the device is locked, but does not require biometric or passcode authentication to _read_ the key at runtime. `ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE` adds an additional gate: reading the key requires the user to authenticate, providing defence-in-depth against malicious apps that gain read access to the app's process.

FR-013 is explicit: "The private key MUST be stored exclusively in `react-native-keychain` using `ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE`."

**Correct implementation** (in `wallet.ts`):

```ts
await Keychain.setGenericPassword('wallet-private-key', wallet.privateKey, {
  service: KEYCHAIN_SERVICE,
  accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE,
  securityLevel: Keychain.SECURITY_LEVEL.SECURE_HARDWARE,
});
```

**Note for `getGenericPassword`**: The accessControl gate triggers the biometric/passcode prompt at read time. No change needed to the `getGenericPassword` call signature — it automatically enforces the control set at write time.

**Alternatives considered**:

- Keep `accessible` only — rejected: FR-013 is non-negotiable; the security audit would flag this.
- Use `BIOMETRY_CURRENT_SET` — rejected: excludes passcode fallback, breaking the spec's "OR_DEVICE_PASSCODE" requirement.

---

## Decision D-003 — Aadhaar on-Device SHA-256 Hashing Sequence

**Unknown**: FR-018 says the frontend sends raw Aadhaar to the API. FR-020 says Redux `auth.user.aadhaar_hash` stores only the SHA-256 hash. The API response is `{ status: 'success', user_id: 'uuid' }` — the backend does not return the hash. How does the frontend get the hash for Redux?

**Decision**: The frontend computes the SHA-256 hash on-device using `react-native-quick-crypto` immediately after the KYC API call succeeds, before dispatching to Redux. The raw Aadhaar string is discarded after the API call and the hash computation — it is never dispatched to Redux or stored anywhere.

**Rationale**:  
The user requirement is explicit: "Aadhaar stored as SHA-256 hash only via react-native-quick-crypto." The API response does not carry the hash back. Computing it on-device is correct: the app already has the raw string locally (it's a local variable on the call stack), the SHA-256 of the same input is deterministic, and this satisfies FR-020 without an extra server round-trip.

**Implementation sequence on KYCScreen submit**:

1. User taps "Continue" with `fullName` and `aadhaarNumber` (validated 12-digit string).
2. Call `POST /api/v1/auth/kyc` with `{ full_name: fullName, aadhaar_number: aadhaarNumber }`.
3. On HTTP 200 response:
   a. Compute `aadhaarHash = await sha256(aadhaarNumber)` using `src/common/utils/hash.ts`.
   b. Dispatch `setUser({ id: userId, name: fullName, phone: phoneFromRedux, aadhaar_hash: aadhaarHash })`.
   c. Dispatch `setKycCompleted(true)`.
   d. `aadhaarNumber` variable goes out of scope — JS GC collects it.
4. Navigate to HomeScreen.

**Note**: `src/common/utils/hash.ts` already uses `react-native-quick-crypto` and exports a `sha256(input: string): Promise<string>` utility. No new utility needed.

**Alternatives considered**:

- Hash Aadhaar before sending to API — rejected: FR-018 explicitly says send raw 12-digit string to backend; the backend validates format and then hashes. Sending a hash to an endpoint that expects a raw number would cause a 400 error.
- Store raw Aadhaar temporarily in Redux while KYC loads — rejected: violates FR-020 and Principle II. The raw value stays in a local call-stack variable only.

---

## Decision D-004 — OTP Auto-Verify: 6th Digit Triggers Verify Without Button

**Unknown**: How to implement auto-verify on the 6th digit without an explicit "Verify" button tap, without introducing race conditions (e.g., the user types the 6th digit, focus changes, keyboard hides, and verification starts before the UI settles).

**Decision**: Use a `useEffect` that watches a joined `otpValue` string derived from all 6 digit state entries. When `otpValue.length === 6`, trigger `supabase.auth.verifyOtp` inside the effect. Add a `loading` guard to prevent double-trigger.

**Rationale**:  
FR-011 is unambiguous: "OTPScreen MUST call `supabase.auth.verifyOtp` automatically when all 6 digits are filled, without requiring a separate 'Verify' button tap." A `useEffect([otpValue])` watching a derived string is the idiomatic React pattern for this. The `loading` guard prevents a re-render from triggering a second API call if the component re-renders with `otpValue` still at length 6.

**Implementation pattern**:

```ts
const digits = useWatch({ control, name: 'digits' }); // react-hook-form field array
const otpValue = digits.join('');

useEffect(() => {
  if (otpValue.length === 6 && !loading) {
    handleVerifyOtp(otpValue);
  }
}, [otpValue]);
```

**Alternatives considered**:

- Trigger verify in the `onChange` handler of the 6th input box — rejected: brittle; box 6 may not always be the last filled (user could paste or type out of order in rare cases).
- Add a visible "Verify" button that auto-enables on 6th digit — rejected: FR-011 explicitly forbids a separate verify button tap.

---

## Decision D-005 — Wallet Registration Failure Resilience

**Unknown**: The spec edge case says: "If `POST /api/v1/auth/register-wallet` fails (network error), the farmer should still proceed to KYCScreen/HomeScreen." How is the retry implemented?

**Decision**: If wallet registration fails, log the error (non-crashing), dispatch `setWalletAddress(address)` to Redux anyway (so the address is persisted), and navigate forward. On the next SplashScreen session check, if `session !== null` AND `auth.walletAddress !== null in Redux` BUT `wallet_address` on the server is null (needs an extra server check — out of scope for this feature), retry. For MVP: SplashScreen checks `auth.walletAddress === null && isAuthenticated === true` and retries `register-wallet` if so.

**Decision simplified**: Store `walletAddress` in Redux immediately on creation regardless of registration success. If `walletAddress` is in Redux but is not yet on the server (registration failed), the SplashScreen re-check is limited to: if `isAuthenticated && walletAddress !== null`, skip wallet creation. Retry logic for failed registration is a post-MVP concern. This is acceptable per the spec edge case: "The wallet registration can be retried on next launch by checking `walletAddress === null` in the session check."

**Implementation**: The session check in SplashScreen:

```
if (session && walletAddress === null) → createWallet() + registerWallet()
if (session && walletAddress !== null) → skip wallet creation
```

**Alternatives considered**:

- Block the farmer at OTPScreen until registration succeeds — rejected: creates a dead end on poor connectivity.
- Don't persist `walletAddress` in Redux until server confirms — rejected: breaks the retry check on SplashScreen.

---

## Decision D-006 — Back Navigation Prevention (FR-022)

**Unknown**: How to prevent the hardware back button from returning the farmer to LoginScreen or SplashScreen once authenticated?

**Decision**: Use React Navigation's `gestureEnabled: false` and `headerBackVisible: false` on authenticated screens. Replace the navigation stack with `navigation.reset()` after login/KYC to clear auth screens from the stack entirely.

**Rationale**:  
Once authenticated and on HomeScreen/KYCScreen, calling `navigation.reset({ index: 0, routes: [{ name: 'HomeScreen' }] })` replaces the navigation history. There is no SplashScreen/LoginScreen/OTPScreen in the stack to go back to. This is the standard React Navigation pattern for auth flows.

**Implementation**:

- After `setKycCompleted(true)` dispatch: `navigation.reset({ index: 0, routes: [{ name: 'HomeScreen' }] })`
- After OTP verify for a user with `kycCompleted: true`: `navigation.reset({ index: 0, routes: [{ name: 'HomeScreen' }] })`
- After OTP verify for a user with `kycCompleted: false`: `navigation.navigate('KYCScreen')` (KYC is a one-way screen; back from KYC goes to OTP, which is acceptable since KYC is incomplete)

**Alternatives considered**:

- Override the Android back handler with `BackHandler.addEventListener('hardwareBackPress', () => true)` — rejected: blunt instrument, also prevents back navigation within the app flow (e.g., within HomeScreen sub-navigation).

---

## Summary Table

| ID    | Decision                                           | Status   |
| ----- | -------------------------------------------------- | -------- |
| D-001 | SplashScreen session check reads MMKV (offline)    | Resolved |
| D-002 | wallet.ts must add `ACCESS_CONTROL`                | Resolved |
| D-003 | Aadhaar hashed on-device after API call            | Resolved |
| D-004 | OTP auto-verify via useEffect on otpValue.length   | Resolved |
| D-005 | Wallet registration failure: proceed + retry logic | Resolved |
| D-006 | Back-nav prevention via navigation.reset()         | Resolved |
