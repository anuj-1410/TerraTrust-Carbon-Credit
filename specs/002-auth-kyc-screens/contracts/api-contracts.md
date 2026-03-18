# API Contracts: Authentication and KYC Screens

**Feature**: `002-auth-kyc-screens`  
**Generated**: 2026-03-18  
**Source of truth**: `SRS_TerraTrust_v3.1.txt §5.2, §5.3, §8.2` + `TerraTrust_Backend_System_Design_v3.1.txt §4.2`

All endpoints are called via the axios instance in `src/services/api.ts`.  
Base URL: `Config.API_BASE_URL` (from `.env` via `react-native-config`).  
Auth header: `Authorization: Bearer <supabase-jwt>` — auto-attached by the axios request interceptor.

---

## External Auth Contracts (Supabase SDK)

### `supabase.auth.signInWithOtp` — Send OTP

**Called on**: LoginScreen "Send OTP" button tap (FR-005).  
**Re-called on**: OTPScreen "Resend OTP" link tap (FR-010).

```ts
// Call
await supabase.auth.signInWithOtp({
  phone: '+91' + phoneNumber, // e.g. '+919876543210'
});

// Success: { data: { user: null, session: null }, error: null }
// Failure: { data: { user: null, session: null }, error: AuthError }
```

**On success**: Navigate to `OTPScreen` with `{ phone: '+91' + phoneNumber }` as params.  
**On error**: Show error message inline on LoginScreen. Do not navigate.

---

### `supabase.auth.verifyOtp` — Verify OTP Code

**Called on**: OTPScreen — automatically when all 6 digits are entered (FR-011).

```ts
// Call
await supabase.auth.verifyOtp({
  phone: route.params.phone, // '+91XXXXXXXXXX' passed from LoginScreen
  token: otpToken, // 6-digit string e.g. '123456'
  type: 'sms',
});

// Success: { data: { user: User, session: Session }, error: null }
//   session.access_token — Supabase JWT (persisted internally via MMKV adapter)
//   user.id              — Supabase UUID
//   user.phone           — '+91XXXXXXXXXX'

// Failure: { data: { user: null, session: null }, error: AuthError }
//   error.message — e.g. 'Token has expired or is invalid'
```

**On success**: Run post-OTP flow:

1. Check `auth.walletAddress === null` in Redux.
2. If null → call `createWallet()` from `src/services/wallet.ts` → `registerWallet(address)`.
3. Check `auth.kycCompleted` in Redux.
4. If false → `navigation.navigate('KYCScreen')`.
5. If true → `navigation.reset({ index: 0, routes: [{ name: 'HomeScreen' }] })`.

**On error**: Show "Incorrect code. Please try again." inline on OTPScreen. Clear digit boxes. Do not navigate.

---

### `supabase.auth.getSession` — Session Check on SplashScreen

**Called on**: SplashScreen `useEffect` on mount (FR-002, SC-007).

```ts
// Call
const {
  data: { session },
  error,
} = await supabase.auth.getSession();

// session !== null → authenticated (reads from MMKV — no network call)
// session === null → not authenticated or session expired
```

**Routing logic** (SRS §5.2):

```
if (session !== null && auth.kycCompleted === true)  → navigate HomeScreen
if (session !== null && auth.kycCompleted === false) → navigate KYCScreen
  → also check wallet: if auth.walletAddress === null → trigger wallet creation
if (session === null)                                → navigate LoginScreen
```

All three navigations use `navigation.replace()` (or `navigation.reset()`) to prevent back-navigation to SplashScreen.

---

## Backend API Contracts

### `POST /api/v1/auth/register-wallet`

**Called on**: OTPScreen — after silent wallet creation (FR-014).  
**Precondition**: Supabase session exists (JWT available for interceptor).

```
URL:     POST {API_BASE_URL}/api/v1/auth/register-wallet
Headers: Authorization: Bearer <supabase-jwt>   ← auto by axios interceptor
         Content-Type: application/json
```

**Request body**:

```json
{
  "wallet_address": "0x742d35Cc6634C0532925a3b8D4C9F2B6a84c7B2e"
}
```

| Field            | Type   | Constraints                                            |
| ---------------- | ------ | ------------------------------------------------------ |
| `wallet_address` | string | 42 characters, starts with `0x`, valid Polygon address |

**Success response** (HTTP 200):

```json
{ "status": "success" }
```

**Error responses**:

| HTTP | Body                                           | Frontend action                           |
| ---- | ---------------------------------------------- | ----------------------------------------- |
| 400  | `{ "error": "Invalid wallet address format" }` | Log error, do not block farmer navigation |
| 401  | `{ "error": "Unauthorized" }`                  | Axios interceptor → navigate LoginScreen  |
| 500  | `{ "error": "..." }`                           | Log error, show maintenance banner        |

**Failure resilience**: If this call fails (any error), dispatch `setWalletAddress(address)` to Redux anyway and allow navigation to proceed. The wallet address will be in Redux for SplashScreen retry. The farmer is NOT blocked (spec edge case).

---

### `POST /api/v1/auth/kyc`

**Called on**: KYCScreen "Continue" button tap (FR-018).  
**Precondition**: Supabase session exists. OTP verification complete.

```
URL:     POST {API_BASE_URL}/api/v1/auth/kyc
Headers: Authorization: Bearer <supabase-jwt>   ← auto by axios interceptor
         Content-Type: application/json
```

**Request body**:

```json
{
  "full_name": "Ramesh Shankar Patil",
  "aadhaar_number": "123456789012"
}
```

| Field            | Type   | Constraints                                |
| ---------------- | ------ | ------------------------------------------ |
| `full_name`      | string | Non-empty, max 255 chars                   |
| `aadhaar_number` | string | Exactly 12 decimal digits (raw, no spaces) |

> **CRITICAL SECURITY NOTE**: The frontend sends raw `aadhaar_number` to the backend ONCE. The backend is responsible for format validation and SHA-256 hashing (stored as `aadhaar_hash` in the `users` table). After this call returns, the frontend MUST:
>
> 1. Compute `sha256(aadhaarNumber)` on-device using `react-native-quick-crypto`.
> 2. Dispatch `setUser({ ..., aadhaar_hash: computedHash })` to Redux.
> 3. Allow the `aadhaarNumber` variable to go out of scope — never store it.

**Success response** (HTTP 200):

```json
{ "status": "success", "user_id": "550e8400-e29b-41d4-a716-446655440000" }
```

| Field     | Type   | Description                       |
| --------- | ------ | --------------------------------- |
| `status`  | string | `"success"` on success            |
| `user_id` | string | Supabase UUID of the created user |

**Error responses**:

| HTTP | Body                                           | Frontend action                                   |
| ---- | ---------------------------------------------- | ------------------------------------------------- |
| 400  | `{ "error": "Invalid Aadhaar number format" }` | Show backend error message inline on KYCScreen    |
| 400  | `{ "error": "KYC already completed" }`         | Dispatch `setKycCompleted(true)`, navigate Home   |
| 401  | `{ "error": "Unauthorized" }`                  | Axios interceptor → navigate LoginScreen          |
| 500  | `{ "error": "..." }`                           | Show maintenance banner, keep farmer on KYCScreen |

**On HTTP 200**:

1. `userId = response.data.user_id`
2. `aadhaarHash = await sha256(aadhaarNumber)` — on-device, react-native-quick-crypto
3. `dispatch(setUser({ id: userId, name: fullName, phone: storedPhone, aadhaar_hash: aadhaarHash }))`
4. `dispatch(setKycCompleted(true))`
5. `navigation.reset({ index: 0, routes: [{ name: 'HomeScreen' }] })`

---

## Navigation Parameter Contracts

Defined in `src/types/navigation.ts`. Auth-relevant entries:

```ts
export type RootStackParamList = {
  SplashScreen: undefined;
  LoginScreen: undefined;
  OTPScreen: { phone: string }; // '+91XXXXXXXXXX' — full E.164, passed from LoginScreen
  KYCScreen: undefined;
  HomeScreen: undefined;
  // ... other screens from 001
};
```

---

## Error Handling Summary

| Scenario                             | Response                                    |
| ------------------------------------ | ------------------------------------------- |
| OTP send fails (network)             | Inline error on LoginScreen. No navigation. |
| OTP verify fails (wrong code)        | "Incorrect code. Please try again." inline. |
| OTP verify fails (expired)           | "Code has expired." inline + show Resend.   |
| Wallet creation fails (ethers error) | Non-blocking toast. Proceed to KYCScreen.   |
| Wallet registration fails (network)  | Log + proceed. Retry on next SplashScreen.  |
| KYC submit returns 400               | Show `error` field inline on KYCScreen.     |
| KYC submit fails (network)           | Show offline banner. Keep on KYCScreen.     |
| Session expired (401 on any call)    | Axios interceptor → LoginScreen.            |
