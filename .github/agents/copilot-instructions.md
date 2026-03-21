# TerraTrustAR Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-03-21

## Active Technologies
- TypeScript 5.0+ strict mode (`"strict": true`). React Native 0.84.1. NOT Expo. + @supabase/supabase-js (phone OTP auth), ethers v6 (wallet creation), react-native-keychain (private key ONLY), react-native-quick-crypto (SHA-256 Aadhaar hash), react-hook-form + zod (form validation), React Navigation v6 native stack, NativeWind 4.0, Redux Toolkit 2.0, lottie-react-native, axios (api.ts with JWT interceptor) (002-auth-kyc-screens)
- `react-native-mmkv` via redux-persist (auth slice — all fields persisted, no blacklist). `react-native-keychain` for private key ONLY (never MMKV/Redux/logs). Supabase session persisted via MMKV adapter in `src/services/supabase.ts` (`persistSession: true`, `autoRefreshToken: true`). (002-auth-kyc-screens)
- [e.g., Python 3.11, Swift 5.9, Rust 1.75 or NEEDS CLARIFICATION] + [e.g., FastAPI, UIKit, LLVM or NEEDS CLARIFICATION] (003-land-verification-module)
- [if applicable, e.g., PostgreSQL, CoreData, files or N/A] (003-land-verification-module)
- TypeScript 5.0+ strict mode (`"strict": true`). React Native 0.84.1. NOT Expo. + react-native-vision-camera v4 (camera capture), react-native-document-picker (gallery picker), react-native-maps 1.27 (Polygon overlay on BoundaryConfirmScreen), react-native-geolocation-service (GPS for boundary fetch), @react-native-community/netinfo (offline detection), axios (API calls via api.ts), Redux Toolkit 2.0 + redux-persist + MMKV (land slice), React Navigation v6 native stack, NativeWind 4.0, lottie-react-native (spinning_leaf.json), Zod + React Hook Form (farm_name input) (003-land-verification-module)
- `react-native-mmkv` via redux-persist — `land.parcels` MUST persist; `land.currentDraft` MUST NOT persist (blacklisted in `store/index.ts` — already configured). `thumbnail_url` per parcel is the MMKV-cached GEE PNG URL, populated from `satellite_thumbnail_url` field of fetch-boundary response. (003-land-verification-module)

- TypeScript 5.0+ strict mode (`"strict": true`). React Native 0.73+. NOT Expo. + NativeWind 4.0, Redux Toolkit 2.0, react-redux, redux-persist, react-native-mmkv, React Navigation v6 (native stack), @supabase/supabase-js, axios, react-native-config, react-hook-form, zod, ethers v6, react-native-vision-camera v4, react-native-maps, react-native-keychain, react-native-quick-crypto, lottie-react-native, react-native-reanimated, react-native-geolocation-service, react-native-device-info, react-native-background-fetch, react-native-haptic-feedback, react-native-chart-kit, react-native-svg (001-rn-project-foundation)

## Project Structure

```text
src/
tests/
```

## Commands

npm test; npm run lint

## Code Style

TypeScript 5.0+ strict mode (`"strict": true`). React Native 0.73+. NOT Expo.: Follow standard conventions

## Recent Changes
- 003-land-verification-module: Added TypeScript 5.0+ strict mode (`"strict": true`). React Native 0.84.1. NOT Expo. + react-native-vision-camera v4 (camera capture), react-native-document-picker (gallery picker), react-native-maps 1.27 (Polygon overlay on BoundaryConfirmScreen), react-native-geolocation-service (GPS for boundary fetch), @react-native-community/netinfo (offline detection), axios (API calls via api.ts), Redux Toolkit 2.0 + redux-persist + MMKV (land slice), React Navigation v6 native stack, NativeWind 4.0, lottie-react-native (spinning_leaf.json), Zod + React Hook Form (farm_name input)
- 003-land-verification-module: Added [e.g., Python 3.11, Swift 5.9, Rust 1.75 or NEEDS CLARIFICATION] + [e.g., FastAPI, UIKit, LLVM or NEEDS CLARIFICATION]
- 002-auth-kyc-screens: Added TypeScript 5.0+ strict mode (`"strict": true`). React Native 0.84.1. NOT Expo. + @supabase/supabase-js (phone OTP auth), ethers v6 (wallet creation), react-native-keychain (private key ONLY), react-native-quick-crypto (SHA-256 Aadhaar hash), react-hook-form + zod (form validation), React Navigation v6 native stack, NativeWind 4.0, Redux Toolkit 2.0, lottie-react-native, axios (api.ts with JWT interceptor)


<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
