# Quickstart: Authentication and KYC Screens

**Feature**: `002-auth-kyc-screens`  
**Generated**: 2026-03-18  
**Prerequisite**: Feature 001 (React Native Project Foundation) must be complete and the app must build successfully on Android.

---

## Environment Setup

### 1. Configure `.env` Variables

These must be set before running any auth flow. The `.env` file is git-ignored.

```bash
# .env (already git-ignored from Feature 001)
API_BASE_URL=https://your-backend-api.com
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJ...your-anon-key
```

> **Never add `SUPABASE_SERVICE_KEY` to the mobile app.** The service role key bypasses row-level security and has no place in a client app.

### 2. Configure Supabase Phone Auth

In your Supabase Dashboard:

1. Go to **Authentication → Providers → Phone**.
2. Enable the Phone provider.
3. Set your SMS provider (Twilio, MessageBird, etc.) or use **"Enable phone confirmations"** in development mode to receive OTP codes via the Supabase dashboard logs.
4. Add test phone numbers for development:
   - Go to **Authentication → Users** → **Add user** or use test phone numbers.
   - Supabase supports "Test phone numbers" − add `+919999999999` with OTP `123456` for local testing without SMS delivery.

### 3. Configure SMS Test Phone (Development Only)

In `supabase.ts` — no changes needed. The Supabase client is already configured.

For development without a real SMS gateway:

- Supabase Console → Auth → Settings → **Phone auth** → Enable "SMS OTP" for the test number.
- Use `+919999999999` as the phone number and `123456` as the OTP in local test builds.

---

## Running the Feature

### Start Metro and Build

```powershell
# From workspace root (Windows PowerShell 7)
npx react-native start

# In a second terminal:
npx react-native run-android
```

### Testing the Auth Flow

**First-time flow** (login + wallet creation + KYC):

1. Install fresh build on device/emulator.
2. App shows SplashScreen with spinning leaf Lottie.
3. Automatically navigates to LoginScreen (no stored session).
4. Enter `9999999999` (without +91, which is prefilled).
5. Tap "Send OTP" → navigates to OTPScreen.
6. Enter `123456` in the 6 boxes (one digit per box).
7. After the 6th digit, verification fires automatically.
8. Wallet is created silently — no UI prompt.
9. App navigates to KYCScreen.
10. Enter any name and `123456789012` (12-digit Aadhaar).
11. Tap "Continue" → navigates to HomeScreen.

**Returning farmer flow** (session persisted):

1. Close and reopen the app.
2. App shows SplashScreen spinner briefly.
3. Directly navigates to HomeScreen — no login required.

**KYC-incomplete returning flow**:

1. Complete OTP but force-quit before KYC.
2. Reopen the app.
3. App shows SplashScreen → navigates to KYCScreen (session exists, KYC not done).

---

## Key Files

| File                                         | Purpose                                         |
| -------------------------------------------- | ----------------------------------------------- |
| `src/features/auth/screens/SplashScreen.tsx` | Session check + routing + Lottie spinning_leaf  |
| `src/features/auth/screens/LoginScreen.tsx`  | +91 prefix input + zod + Supabase OTP send      |
| `src/features/auth/screens/OTPScreen.tsx`    | 6 digit boxes + 28s countdown + auto-verify     |
| `src/features/auth/screens/KYCScreen.tsx`    | Name + Aadhaar + SHA-256 hash + KYC API         |
| `src/features/auth/store/authSlice.ts`       | Redux state — pre-scaffolded, no changes needed |
| `src/services/wallet.ts`                     | ethers.js wallet creation + Keychain storage    |
| `src/services/supabase.ts`                   | Supabase client with MMKV session persistence   |
| `src/services/api.ts`                        | Axios instance (KYC and register-wallet calls)  |
| `src/common/utils/hash.ts`                   | SHA-256 utility (used for Aadhaar hashing)      |

---

## Common Issues

### OTP Not Received in Emulator

- Use Supabase test phone numbers (configured in the Supabase dashboard).
- The test OTP appears in the Supabase Auth → Users log if you use log-based OTP (not SMS).

### Keychain Failing on Emulator

- `react-native-keychain` with `ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE` requires a biometric or PIN to be set on the device.
- In an emulator: go to **Settings → Security → Screen Lock** and set a PIN.
- Physical device is strongly preferred for Keychain testing.

### Session Not Persisting Between Launches

- Check that `redux-persist` is properly configured with the MMKV adapter.
- Run `adb shell run-as com.terratrustar cat shared_prefs/...` to inspect MMKV contents.
- Verify `persistSession: true` in `src/services/supabase.ts`.

### "Please enter a valid 10-digit number" on Valid Input

- Ensure the phone input field strips any spaces or non-digit characters before validation.
- The `+91` prefix is display-only and should NOT be included in the `phoneNumber` field value passed to the zod schema.

### Back Navigation Goes to LoginScreen After KYC

- Verify that `navigation.reset({ index: 0, routes: [{ name: 'HomeScreen' }] })` is called on KYC success — not `navigation.navigate('HomeScreen')`.
- `navigate` pushes onto the stack; `reset` replaces it entirely.

---

## Testing Checklist

Before marking this feature as complete, verify all of the following manually:

- [ ] Fresh install → SplashScreen → LoginScreen (no persisted session)
- [ ] Enter phone → OTP screen → 6-digit auto-verify (no button tap needed)
- [ ] Wallet address appears in Redux after OTP success (check Redux DevTools / MMKV)
- [ ] `auth.walletAddress` does NOT appear in any console log
- [ ] Private key does NOT appear in any console log
- [ ] KYC submission → HomeScreen
- [ ] Raw Aadhaar does NOT appear in Redux state or any log after KYC
- [ ] Close and reopen → HomeScreen directly (persisted session)
- [ ] OTP countdown from 28 → 0 → "Resend OTP" link appears
- [ ] Resend OTP → countdown restarts from 28
- [ ] Wrong OTP → "Incorrect code. Please try again." inline, stays on OTPScreen
- [ ] 8-digit phone → "Please enter a valid 10-digit number" inline, no API call
- [ ] 11-digit Aadhaar → format error inline, no API call
- [ ] All touch targets ≥ 48×48px (verify with Android accessibility inspector)
