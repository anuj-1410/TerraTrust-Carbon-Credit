# Data Model: Authentication and KYC Screens

**Feature**: `002-auth-kyc-screens`  
**Generated**: 2026-03-18  
**Source of truth**: `SRS_TerraTrust_v3.1.txt §5.2, §5.3, §13.1` + `TerraTrust_Backend_System_Design_v3.1.txt §4.2`

---

## Persistent Entities

### 1. `AuthUser`

Represents the authenticated farmer's verified identity. Lives in Redux `authSlice.user`. **Persisted to MMKV** via redux-persist (auth slice has no blacklist).

```ts
// src/features/auth/store/authSlice.ts (already exists)
interface AuthUser {
  id: string; // Supabase UUID (from OTP verify response + KYC response)
  name: string; // Full legal name (from KYCScreen input, as-entered)
  phone: string; // E.164 format e.g. '+919876543210' (set at LoginScreen)
  aadhaar_hash: string; // SHA-256 hex string (64 chars). Computed on-device via
  // react-native-quick-crypto AFTER KYC API call.
  // RAW AADHAAR IS NEVER STORED HERE OR ANYWHERE IN APP STATE.
}
```

**Validation rules** (enforced in KYCScreen via zod schema):

- `name`: non-empty string, trimmed, max 255 characters, matches `[A-Za-z\s.'-]+`
- `aadhaar_number` (input only — never stored): exactly 12 decimal digits `/^\d{12}$/`
- `aadhaar_hash` (stored): SHA-256 hex `/^[0-9a-f]{64}$/`

**State transitions**:

```
null ──[OTP verify success + KYC API success]──▶ AuthUser { id, name, phone, aadhaar_hash }
AuthUser ──[logout()]──▶ null
```

---

### 2. `AuthState`

Redux slice shape for authentication. Lives in `src/features/auth/store/authSlice.ts`.

```ts
// src/features/auth/store/authSlice.ts (already exists — verify matches this)
interface AuthState {
  user: AuthUser | null; // null until KYC complete
  walletAddress: string | null; // Polygon 0x... address (42 chars). null until wallet created.
  isAuthenticated: boolean; // true after successful OTP verification
  kycCompleted: boolean; // true after successful POST /api/v1/auth/kyc
}
```

**Redux persist**: All four fields persisted to MMKV (no blacklist on auth persistConfig).

**State machine**:

```
Initial (MMKV-rehydrated):
  isAuthenticated=false, kycCompleted=false, user=null, walletAddress=null
  → SplashScreen routes to LoginScreen

After OTP verify:
  isAuthenticated=true (via setUser), walletAddress=<address> (via setWalletAddress)
  kycCompleted=false (until KYC)
  → SplashScreen / OTPScreen routes to KYCScreen

After KYC submit:
  kycCompleted=true (via setKycCompleted), user.aadhaar_hash=<hash>
  → routes to HomeScreen

After logout():
  All fields reset to initial
  → routes to LoginScreen
```

**Redux reducers** (already implemented in authSlice.ts):

| Reducer            | Action payload | Effect                                     |
| ------------------ | -------------- | ------------------------------------------ |
| `setUser`          | `AuthUser`     | Sets `user`, sets `isAuthenticated = true` |
| `setWalletAddress` | `string`       | Sets `walletAddress`                       |
| `setKycCompleted`  | `boolean`      | Sets `kycCompleted`                        |
| `logout`           | none           | Resets all fields to initial state         |

---

### 3. `FarmerWallet` (Device-Only)

The blockchain wallet. The private key has **no representation in any app state store**.

```ts
// Conceptual model only — not a Redux type
interface FarmerWallet {
  // Private key: stored ONLY in Android Keystore via react-native-keychain
  //   Service key: 'terratrust-wallet'
  //   accessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY
  //   accessControl: BIOMETRY_ANY_OR_DEVICE_PASSCODE  ← FR-013 requirement
  //   securityLevel: SECURE_HARDWARE
  //   Value: ethers.Wallet.createRandom().privateKey (64-char hex without 0x)

  // Public address: stored in Redux authSlice.walletAddress + Supabase users table
  walletAddress: string; // '0x' + 40 hex chars (42 chars total)
}
```

**Creation flow**:

1. `ethers.Wallet.createRandom()` → `{ privateKey, address }`
2. `Keychain.setGenericPassword('wallet-private-key', privateKey, { ... })`
3. `dispatch(setWalletAddress(address))`
4. `api.post('/api/v1/auth/register-wallet', { wallet_address: address })`

---

## Transient Entities (Component-Scope Only)

### 4. `LoginFormValues`

React Hook Form field values on `LoginScreen`. Never dispatched to Redux.

```ts
interface LoginFormValues {
  phoneNumber: string; // 10 digits only (without +91). +91 prefix is display-only.
}

// Zod schema:
const loginSchema = z.object({
  phoneNumber: z
    .string()
    .length(10, 'Please enter a valid 10-digit number')
    .regex(/^\d{10}$/, 'Please enter a valid 10-digit number'),
});

// Full phone passed to Supabase: '+91' + phoneNumber
```

---

### 5. `OTPFormValues`

React Hook Form field array for the 6 digit boxes on `OTPScreen`.

```ts
interface OTPDigit {
  value: string; // single char '0'-'9' | ''
}

interface OTPFormValues {
  digits: OTPDigit[]; // length: 6
}

// Derived:
const otpToken = digits.map(d => d.value).join(''); // '000000' when all filled
// Auto-verify triggers when otpToken.length === 6
```

---

### 6. `KYCFormValues`

React Hook Form field values on `KYCScreen`. `aadhaarNumber` is discarded after API call.

```ts
interface KYCFormValues {
  fullName: string; // validated: non-empty, max 255 chars
  aadhaarNumber: string; // validated: exactly 12 digits. NEVER stored in Redux.
  // Used ONCE for POST /api/v1/auth/kyc, then discarded.
}

// Zod schema:
const kycSchema = z.object({
  fullName: z
    .string()
    .min(1, 'Full name is required')
    .max(255, 'Name too long')
    .regex(/^[A-Za-z\s.''-]+$/, 'Name contains invalid characters'),
  aadhaarNumber: z
    .string()
    .length(12, 'Aadhaar number must be exactly 12 digits')
    .regex(/^\d{12}$/, 'Aadhaar number must be exactly 12 digits'),
});
```

**Security note**: After `POST /api/v1/auth/kyc` returns 200:

1. Compute `aadhaarHash = await sha256(aadhaarNumber)` (react-native-quick-crypto).
2. Dispatch `setUser({ id, name: fullName, phone, aadhaar_hash: aadhaarHash })`.
3. The `aadhaarNumber` variable goes out of scope — never stored anywhere else.

---

## Backend Database Reference (BSDD §4.2 — Read-Only, do not implement)

```sql
-- Supabase users table (reference for correct field names in API calls)
id               UUID PRIMARY KEY
phone_number     VARCHAR(15) UNIQUE NOT NULL   -- '+91XXXXXXXXXX'
full_name        VARCHAR(255) NOT NULL
aadhaar_hash     VARCHAR(64)                   -- SHA-256 hex, never plain text
wallet_address   VARCHAR(42)                   -- Polygon 0x... public address
role             VARCHAR(20) DEFAULT 'FARMER'
kyc_completed    BOOLEAN DEFAULT FALSE
created_at       TIMESTAMP WITH TIME ZONE
updated_at       TIMESTAMP WITH TIME ZONE
```

**Mapping to Redux**:

| Supabase Column  | Redux Field              |
| ---------------- | ------------------------ |
| `id`             | `auth.user.id`           |
| `full_name`      | `auth.user.name`         |
| `phone_number`   | `auth.user.phone`        |
| `aadhaar_hash`   | `auth.user.aadhaar_hash` |
| `wallet_address` | `auth.walletAddress`     |
| `kyc_completed`  | `auth.kycCompleted`      |
