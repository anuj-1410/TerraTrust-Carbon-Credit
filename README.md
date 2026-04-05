# TerraTrust-AR

TerraTrust-AR is the Android React Native client for the TerraTrust tree-audit and carbon-credit workflow. The app handles farmer auth, land registration, AR-assisted tree measurement, offline audit retry, and dashboard credit visibility while relying on Supabase, backend APIs, MMKV persistence, and native Android AR/TFLite integrations.

## Stack

- React Native CLI 0.84.x with TypeScript
- NativeWind 4
- Redux Toolkit + redux-persist + MMKV
- React Navigation 7
- react-native-vision-camera
- react-native-background-fetch
- react-native-quick-crypto
- react-native-keychain
- ethers v6
- Supabase JS

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
SUPABASE_URL=
SUPABASE_ANON_KEY=
GOOGLE_MAPS_API_KEY=
ALCHEMY_POLYGON_AMOY_URL=
CONTRACT_ADDRESS=
```

Notes:

- `API_BASE_URL` must be the server root only, for example `http://10.0.2.2:8000`.
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

## Congratulations! :tada:

You've successfully run and modified your React Native App. :partying_face:

### Now what?

- If you want to add this new React Native code to an existing application, check out the [Integration guide](https://reactnative.dev/docs/integration-with-existing-apps).
- If you're curious to learn more about React Native, check out the [docs](https://reactnative.dev/docs/getting-started).

# Troubleshooting

If you're having issues getting the above steps to work, see the [Troubleshooting](https://reactnative.dev/docs/troubleshooting) page.

# Learn More

To learn more about React Native, take a look at the following resources:

- [React Native Website](https://reactnative.dev) - learn more about React Native.
- [Getting Started](https://reactnative.dev/docs/environment-setup) - an **overview** of React Native and how setup your environment.
- [Learn the Basics](https://reactnative.dev/docs/getting-started) - a **guided tour** of the React Native **basics**.
- [Blog](https://reactnative.dev/blog) - read the latest official React Native **Blog** posts.
- [`@facebook/react-native`](https://github.com/facebook/react-native) - the Open Source; GitHub **repository** for React Native.
