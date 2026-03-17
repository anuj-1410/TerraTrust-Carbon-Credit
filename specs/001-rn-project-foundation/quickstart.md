# Quickstart: React Native Project Foundation

**Feature**: 001-rn-project-foundation  
**Platform**: Android only — NOT Expo  
**Date**: 2026-03-18

---

## Prerequisites

Before running any of the commands below, confirm:

1. **Android Studio** (latest stable) installed with:
   - Android SDK API 33 (Android 13) and API 34 (Android 14)
   - NDK (Side by side) — latest
   - CMake — latest
   - Android Build-Tools — latest
2. **OpenJDK 17** — `java -version` should show `17.x.x`
3. **Node.js v18 LTS** — `node -v` should show `v18.x.x`
4. **React Native CLI** — `npx react-native --version` should resolve
5. **PowerShell 7** (`pwsh`) — required for all `.specify` scripts

---

## Step 1 — Clone and Switch Branch

```powershell
git clone <repo-url> TerraTrustAR
cd TerraTrustAR
git checkout 001-rn-project-foundation
```

---

## Step 2 — React Native Project Init

The RN project is initialised at the repo root using the RN Community template with TypeScript:

```powershell
npx @react-native-community/cli@latest init TerraTrustAR `
  --template react-native-template-typescript `
  --directory . `
  --skip-git-init `
  --version 0.73
```

> **Note**: Run this only once. If the project already has `android/` and `ios/` directories, skip this step.

---

## Step 3 — Install All Dependencies

```powershell
npm install

# Core framework + navigation
npm install @react-navigation/native @react-navigation/native-stack
npm install react-native-screens react-native-safe-area-context

# State management + persistence
npm install @reduxjs/toolkit react-redux redux-persist
npm install react-native-mmkv

# Styling
npm install nativewind tailwindcss

# Auth + API
npm install @supabase/supabase-js
npm install axios
npm install react-native-config

# Forms + validation
npm install react-hook-form zod @hookform/resolvers

# Camera + AR
npm install react-native-vision-camera

# Maps
npm install react-native-maps

# Blockchain + wallet
npm install ethers@6

# Security + device
npm install react-native-keychain
npm install react-native-quick-crypto
npm install react-native-device-info

# Location
npm install react-native-geolocation-service

# Animations
npm install lottie-react-native
npm install react-native-reanimated

# Charting
npm install react-native-chart-kit react-native-svg

# Background sync
npm install react-native-background-fetch

# Haptics
npm install react-native-haptic-feedback
```

---

## Step 4 — Android Setup

### 4a. Configure react-native-config

Edit `android/app/build.gradle` — add at the top of the file (before `android {`):

```groovy
apply from: project(':react-native-config').projectDir.getPath() + "/dotenv.gradle"
```

### 4b. Inject Maps API Key securely

In `android/app/build.gradle`, inside `android { defaultConfig { ... } }`, add:

```groovy
def localProperties = new Properties()
def localPropertiesFile = rootProject.file('local.properties')
if (localPropertiesFile.exists()) {
    localPropertiesFile.withReader('UTF-8') { reader -> localProperties.load(reader) }
}
manifestPlaceholders = [
    GOOGLE_MAPS_API_KEY: localProperties.getProperty("GOOGLE_MAPS_API_KEY", "")
]
```

### 4c. Create `android/local.properties`

```
sdk.dir=C:\\Users\\<your-username>\\AppData\\Local\\Android\\Sdk
GOOGLE_MAPS_API_KEY=YOUR_MAPS_API_KEY_HERE
```

> **Never commit `local.properties`** — it is already in `.gitignore`.

---

## Step 5 — Create Environment File

Create `.env.development` in the project root:

```env
# TerraTrust AR — Development Environment
# DO NOT COMMIT — listed in .gitignore
API_BASE_URL=http://10.0.2.2:8000
SUPABASE_URL=https://YOUR_REF.supabase.co
SUPABASE_ANON_KEY=YOUR_ANON_KEY_HERE
GOOGLE_MAPS_API_KEY=YOUR_MAPS_API_KEY_HERE
```

> `10.0.2.2` reaches the host machine's `localhost` from Android Emulator.  
> For a physical device on the same Wi-Fi, use the host machine's local IP (e.g. `192.168.1.x:8000`).

---

## Step 6 — NativeWind Configuration

### `tailwind.config.js` (project root)

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: { extend: {} },
  plugins: [],
};
```

### `global.css` (project root)

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### `babel.config.js` (project root)

```js
module.exports = {
  presets: ["module:@react-native/babel-preset"],
  plugins: ["nativewind/babel"],
};
```

### `metro.config.js` (project root)

```js
const { getDefaultConfig, mergeConfig } = require("@react-native/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = mergeConfig(getDefaultConfig(__dirname), {});
module.exports = withNativeWind(config, { input: "./global.css" });
```

---

## Step 7 — Run the App

### Emulator (basic UI validation)

```powershell
# Start Metro bundler
npx react-native start --reset-cache

# In a separate terminal — build and install on emulator
npx react-native run-android
```

### Physical Device (required for AR testing)

```powershell
# Enable USB debugging on device, then:
npx react-native run-android --device
```

### Verify NativeWind is working

Check that the placeholder `HomeScreen` renders with a green background class:

```tsx
<View className="flex-1 bg-green-700 items-center justify-center">
  <Text className="text-white text-2xl font-bold">TerraTrust AR</Text>
</View>
```

If the green background appears, NativeWind is configured correctly.

---

## Step 8 — Validation Checklist

After the app is running, verify:

- [ ] App launches without build errors or Metro bundler warnings
- [ ] NativeWind classes apply correctly on the placeholder screen
- [ ] No TypeScript errors: `npx tsc --noEmit`
- [ ] Redux DevTools (if connected via React Native Debugger) shows initial state with all 4 slices
- [ ] Force-close and relaunch — `auth`, `land`, `audit` slices hydrate from MMKV
- [ ] `audit.uploadStatus` is `'idle'` after relaunch (not persisted)
- [ ] Network inspector shows `Authorization: Bearer ...` header on any API call

---

## Troubleshooting

| Symptom                                    | Fix                                                                                      |
| ------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `nativewind/metro` not found               | Run `npm install nativewind tailwindcss` again then reset cache                          |
| Metro bundler shows `global.css not found` | Ensure `global.css` is in project root (same level as `package.json`)                    |
| Maps API key blank in manifest             | Check `android/local.properties` and `build.gradle` placeholder injection                |
| MMKV build error on Android                | Ensure NDK is installed in Android Studio SDK Manager                                    |
| react-native-reanimated crashes on launch  | Add `require('react-native-reanimated/babel').plugin` to `babel.config.js` plugins       |
| `Config.API_BASE_URL` is empty string      | Confirm `.env.development` exists in project root and restart Metro with `--reset-cache` |
