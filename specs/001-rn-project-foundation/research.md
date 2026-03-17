# Research: React Native Project Foundation

**Feature**: 001-rn-project-foundation  
**Phase**: 0 — Pre-design unknowns resolved  
**Date**: 2026-03-18

---

## R-001: NativeWind 4.0 Configuration for React Native CLI 0.73+

**Question**: What is the exact, complete configuration for NativeWind 4.0 in a React Native CLI (non-Expo) project with TypeScript strict mode?

### Decision

Use NativeWind 4.0 with `nativewind/preset` in `tailwind.config.js`, `nativewind/babel` plugin in `babel.config.js`, and `withNativeWind()` Metro wrapper. Import `global.css` once at the app entry point.

### Step-by-Step Configuration

**Step 1 — Install packages**

```
npm install nativewind tailwindcss
```

**Step 2 — `tailwind.config.js`** (project root)

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: { extend: {} },
  plugins: [],
};
```

**Step 3 — `global.css`** (project root — required by NativeWind 4.0 Metro plugin)

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**Step 4 — `babel.config.js`** (project root)

```js
module.exports = {
  presets: ["module:@react-native/babel-preset"],
  plugins: ["nativewind/babel"],
};
```

**Step 5 — `metro.config.js`** (project root)

```js
const { getDefaultConfig, mergeConfig } = require("@react-native/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = mergeConfig(getDefaultConfig(__dirname), {});
module.exports = withNativeWind(config, { input: "./global.css" });
```

**Step 6 — TypeScript declarations** (add to `src/app/App.tsx` or `src/types/nativewind.d.ts`)

```ts
/// <reference types="nativewind/types" />
```

**Step 7 — Import CSS in entry point** (`src/app/App.tsx`)

```tsx
import "../../global.css";
```

The path depends on `App.tsx` location. If it's at `src/app/App.tsx`, use `../../global.css`.

### Rationale

NativeWind 4.0 (stable) changed from the v2 approach: it now requires a CSS file and the Metro `withNativeWind` wrapper. This replaces the old `styled()` HOC approach from v2. The `nativewind/preset` in tailwind config provides the correct defaults for Expo and bare RN (shadow utilities, platform-specific values).

### Alternatives Considered

- **NativeWind 2.x**: Rejected — v4.0 is required by the constitution. v2 uses `styled()` HOC which is incompatible with NativeWind 4.0 class-name approach.
- **StyleSheet.create + Tailwind tokens**: Rejected — constitution explicitly prohibits `StyleSheet.create` for layout styling.

---

## R-002: Redux Persist + MMKV Adapter with Nested Key Blacklisting

**Question**: How do you configure redux-persist to use MMKV as storage AND blacklist specific nested keys (`audit.uploadStatus`, `land.currentDraft`) without blacklisting the whole slice?

### Decision

Use **per-reducer `persistReducer`** (nested persistence) with individual `blacklist` configs per affected slice. This is the only redux-persist pattern that supports field-level exclusion within a slice.

### MMKV Storage Adapter (`src/store/mmkvStorage.ts`)

```ts
import { MMKV } from "react-native-mmkv";
import type { Storage } from "redux-persist";

const mmkvInstance = new MMKV({ id: "terratrust-store" });

export const mmkvStorage: Storage = {
  setItem: (key: string, value: string): Promise<boolean> => {
    mmkvInstance.set(key, value);
    return Promise.resolve(true);
  },
  getItem: (key: string): Promise<string | null | undefined> => {
    const value = mmkvInstance.getString(key);
    return Promise.resolve(value ?? null);
  },
  removeItem: (key: string): Promise<void> => {
    mmkvInstance.delete(key);
    return Promise.resolve();
  },
};
```

### Nested Persist Config Pattern (`src/store/index.ts`)

```ts
import { combineReducers, configureStore } from "@reduxjs/toolkit";
import {
  persistStore,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from "redux-persist";
import { mmkvStorage } from "./mmkvStorage";
import authReducer from "../features/auth/store/authSlice";
import landReducer from "../features/land/store/landSlice";
import auditReducer from "../features/ar-audit/store/auditSlice";
import creditsReducer from "../features/dashboard/store/creditsSlice";

// auth: persist everything (no exclusions)
const authPersistConfig = {
  key: "auth",
  storage: mmkvStorage,
};

// land: exclude currentDraft (clears after registration)
const landPersistConfig = {
  key: "land",
  storage: mmkvStorage,
  blacklist: ["currentDraft"],
};

// audit: exclude uploadStatus (resets to 'idle' on every launch)
const auditPersistConfig = {
  key: "audit",
  storage: mmkvStorage,
  blacklist: ["uploadStatus"],
};

// credits: persist everything
const creditsPersistConfig = {
  key: "credits",
  storage: mmkvStorage,
};

const rootReducer = combineReducers({
  auth: persistReducer(authPersistConfig, authReducer),
  land: persistReducer(landPersistConfig, landReducer),
  audit: persistReducer(auditPersistConfig, auditReducer),
  credits: persistReducer(creditsPersistConfig, creditsReducer),
});

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

export const persistor = persistStore(store);
export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = typeof store.dispatch;
```

### Key Points

- The `blacklist` array targets **top-level keys within that slice's state**, not global Redux paths. `blacklist: ['uploadStatus']` in the `audit` persist config targets `audit.uploadStatus`.
- `FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER` must be added to `serializableCheck.ignoredActions` to suppress RTK's serializable check warnings on redux-persist internal actions.
- Using `id: 'terratrust-store'` in the MMKV constructor creates a separate MMKV file, avoiding key collisions with any other MMKV usage in the app.

### Rationale

The per-reducer approach (`persistReducer` per slice) is the official redux-persist pattern for field-level blacklisting. A single top-level persist config cannot blacklist nested paths like `audit.uploadStatus` — the blacklist only works at the root reducer level.

### Alternatives Considered

- **`redux-persist-transform-filter` package**: Works but adds a dependency. Per-reducer blacklist is built-in and sufficient.
- **Top-level blacklist on rootReducer**: Can only exclude entire slices, not fields within a slice. Rejected.
- **AsyncStorage as adapter**: Rejected by constitution — synchronous MMKV is mandatory.

---

## R-003: react-native-config TypeScript Declarations

**Question**: How are `.env.*` variables accessed with TypeScript type safety in React Native CLI using react-native-config?

### Decision

`react-native-config` exposes variables via the default export `Config`. For TypeScript, create a `.d.ts` declaration file that types the module with precisely the expected keys.

### Configuration (`src/types/env.d.ts`)

```ts
declare module "react-native-config" {
  interface NativeConfig {
    API_BASE_URL: string;
    SUPABASE_URL: string;
    SUPABASE_ANON_KEY: string;
    GOOGLE_MAPS_API_KEY: string;
  }
  const Config: NativeConfig;
  export default Config;
}
```

### Usage

```ts
import Config from "react-native-config";

// In api.ts:
baseURL: Config.API_BASE_URL; // typed, no 'string | undefined'
```

### `.env.development` File Format

```
# TerraTrust AR — Development Environment
# DO NOT COMMIT — this file is in .gitignore
API_BASE_URL=http://10.0.2.2:8000
SUPABASE_URL=https://YOUR_REF.supabase.co
SUPABASE_ANON_KEY=YOUR_ANON_KEY_HERE
GOOGLE_MAPS_API_KEY=YOUR_MAPS_API_KEY_HERE
```

### Build Selection

react-native-config automatically selects the env file based on the build type:

- Debug builds on Android → loads `.env.development`
- Release builds on Android → loads `.env.production`
- Or explicit: `ENVFILE=.env.staging npx react-native run-android`

### Rationale

Custom `.d.ts` declaration removes `string | undefined` ambiguity for env keys we control. This prevents null-check noise throughout the app while still being accurate — if the key is missing from the file, the build itself will produce a blank string (not undefined at runtime).

### Alternatives Considered

- **process.env**: Works with Metro but requires additional babel config and does not have react-native-config's Android native-variable injection. Rejected.
- **Hardcoded constants file**: Security violation — env values would be committed to git. Rejected.

---

## R-004: React Navigation v6 TypeScript Type-Safe Navigation

**Question**: How is React Navigation v6 configured with TypeScript for a large multi-screen app so all screen navigations are type-checked?

### Decision

Use a single top-level `RootStackParamList` type declaration in `src/types/navigation.ts`. Extend `ReactNavigation.RootParamList` with it globally so `useNavigation()` is typed without type parameters at every call site.

### Navigation Types (`src/types/navigation.ts`)

```ts
export type RootStackParamList = {
  // Auth
  SplashScreen: undefined;
  LoginScreen: undefined;
  OTPScreen: { phone: string };
  KYCScreen: undefined;
  // Land
  LandListScreen: undefined;
  DocumentUploadScreen: undefined;
  BoundaryConfirmScreen: {
    geojson: object;
    surveyNumber: string;
    ownerName: string;
    satelliteThumbnailUrl: string;
    boundarySource: "WMS_AUTO" | "SCRAPE" | "MANUAL";
  };
  ManualUploadGuideScreen: undefined;
  // AR Audit
  AuditStartScreen: { landId: string };
  ZoneNavigationScreen: { auditId: string; landId: string };
  ARCameraScreen: { zoneId: string; auditId: string };
  ManualMeasureScreen: { zoneId: string; auditId: string };
  TreeResultScreen: { treeId: string };
  AuditCompleteScreen: { auditId: string };
  // Dashboard
  HomeScreen: undefined;
  CreditHistoryScreen: undefined;
};

// Global augmentation — useNavigation() returns typed navigator everywhere
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
```

### App.tsx Navigator Setup

```tsx
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../types/navigation";

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="SplashScreen"
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="SplashScreen" component={SplashScreen} />
        {/* ... all 16 screens */}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

### Rationale

Global augmentation of `ReactNavigation.RootParamList` means every `useNavigation()` call in the codebase is automatically typed. Without this, every screen would need `useNavigation<NativeStackNavigationProp<RootStackParamList>>()` which is verbose and error-prone to maintain.

### Alternatives Considered

- **Multiple nested navigators** (auth stack, app stack, etc.): Valid for larger apps, but adds unnecessary complexity for a foundation feature. A single flat stack is simpler to wire and navigate. Nested navigators can be refactored in later features.
- **React Navigation v7**: Not yet stable at the time of writing. Constitution locks v6.

---

## R-005: Redux Toolkit TypeScript Typed Hooks

**Question**: What is the correct pattern for strongly-typed `useSelector` and `useDispatch` hooks in an RTK project?

### Decision

Create typed hook wrappers once in `src/store/hooks.ts` and import those everywhere instead of the raw hooks.

### `src/store/hooks.ts`

```ts
import { useDispatch, useSelector } from "react-redux";
import type { TypedUseSelectorHook } from "react-redux";
import type { RootState, AppDispatch } from "./index";

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
```

### Rationale

Avoids the need to pass `RootState`/`AppDispatch` type parameters at every call site. This is the official RTK TypeScript best practice.

---

## Summary: All Unknowns Resolved

| ID    | Unknown                               | Status   | Decision                                            |
| ----- | ------------------------------------- | -------- | --------------------------------------------------- |
| R-001 | NativeWind 4.0 RN CLI config          | Resolved | CSS file + Metro withNativeWind + nativewind/babel  |
| R-002 | MMKV redux-persist + nested blacklist | Resolved | Per-reducer persistReducer with blacklist per slice |
| R-003 | react-native-config TypeScript        | Resolved | Custom .d.ts declaration file in src/types/         |
| R-004 | React Navigation v6 TypeScript        | Resolved | Global RootParamList augmentation in navigation.ts  |
| R-005 | RTK typed hooks                       | Resolved | useAppDispatch / useAppSelector wrapper in hooks.ts |
