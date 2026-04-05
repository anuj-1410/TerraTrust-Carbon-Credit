# TerraTrust-AR

TerraTrust-AR is the Android React Native client for the TerraTrust tree-audit and carbon-credit workflow. The app handles farmer auth, land registration, AR-assisted tree measurement, offline audit retry, and dashboard credit visibility while relying on Firebase phone auth, backend APIs, MMKV persistence, and native Android AR/TFLite integrations.

## Stack

- React Native CLI 0.84.x with TypeScript
- NativeWind 4
- Redux Toolkit + redux-persist + MMKV
- React Navigation 7
- react-native-vision-camera
- react-native-background-fetch
- @react-native-firebase/app + @react-native-firebase/auth
- react-native-keychain
- ethers v6
- native Android hash bridge

## Prerequisites

- Node.js 22.11+
- npm 10+
- JDK 17
- Android Studio with Android SDK
- Android NDK matching the project Gradle config
- A running Android emulator or USB-connected Android device

## Environment Setup

1. Copy the example file values into your local environment file strategy.
2. Fill the required keys in `.env.development` for local builds.
3. Fill `.env.production` for release builds.

Required variables:

```env
API_BASE_URL=
GOOGLE_MAPS_API_KEY=
ALCHEMY_POLYGON_AMOY_URL=
CONTRACT_ADDRESS=
```

Notes:

- `API_BASE_URL` must be the server root only, for example `http://10.0.2.2:8000`.
- Firebase Android configuration is loaded from `android/app/google-services.json`, not from `react-native-config`.
- `ALCHEMY_POLYGON_AMOY_URL` and `CONTRACT_ADDRESS` are used by `src/services/blockchain.ts` for the direct ERC-1155 dashboard balance read.
- If that chain read fails, the app falls back to `balance_ctt` returned by `GET /api/v1/credits/balance`.
- `CONTRACT_ADDRESS` is still a deployment-time input and must not remain the zero address.
- `GOOGLE_MAPS_API_KEY` must be configured for Android Maps usage.

## Install

```powershell
npm install
```

## Run on Android

Start Metro:

```powershell
npm start
```

In a second terminal, build and launch the app:

```powershell
npm run android
```

## Tests

```powershell
npm test
```

## Important Assets

- `src/assets/tflite/species_model.tflite` is required by the native species inference bridge.
- The file currently exists as a placeholder in the repository and must be replaced with the real trained model before production use.
- Lottie assets are expected in `src/assets/lottie/`.

## Architecture Notes

- Offline audit retry is stored in MMKV under `pending_upload` and retried through `react-native-background-fetch`.
- Sensitive wallet material is stored in Keychain, not Redux or MMKV.
- Aadhaar is hashed on-device before being persisted to Redux.
- AR measurement and species inference are bridged through `android/app/src/main/java/com/terratrustar/ar/ARModule.kt`.
- The main dashboard is exposed through a bottom-tab navigator hosted inside the root app shell.

## Known External Dependencies

- Real Polygon/Alchemy environment values are still required.
- The production-ready TFLite model file is still required.
- Maps functionality depends on a valid Android Maps API key.

## Scope

This workspace targets the Android mobile client. iOS scaffold files may exist from the React Native project template, but Android is the supported platform for current development and validation.
