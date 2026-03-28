# TerraTrust-AR — GitHub Copilot Instructions

## WORKSPACE SCOPE

This workspace builds ONLY the React Native mobile frontend (Android).
Do NOT write Python, FastAPI, Celery, Solidity, GEE, or any backend code.

The BSDD file (TerraTrust_Backend_System_Design_v3.1.txt) is READ-ONLY
reference so API calls, request bodies, response shapes, and data types
are written correctly on the mobile side. Never implement the backend itself.

The SRS file (SRS_TerraTrust_v3.1.txt) and FDD file
(TerraTrust_Frontend_Design_Document_v3.1.txt) are the primary build
targets. When the FDD and SRS conflict, SRS wins.

## ENVIRONMENT

Windows machine.

All scripts in MUST be executed using PowerShell 7 (`pwsh`).

Never use:

- Windows PowerShell (`powershell.exe`)
- bash
- sh
- Unix shell commands

## TECH STACK — DO NOT change without explicit user approval.

- React Native CLI 0.73+ with TypeScript 5.0+ strict mode. NOT Expo.
- NativeWind 4.0+ for all styling. Tailwind utility classes only.
- Redux Toolkit 2.0+ for global state.
- redux-persist with MMKV adapter (store/mmkvStorage.ts).
- React Navigation v6 for all navigation.
- react-native-vision-camera v4 for document photo capture.
- react-native-maps:
  ZoneNavigationScreen → mapType="standard" (Google Maps road map)
  BoundaryConfirmScreen → mapType="none" + GEE Sentinel-2 PNG as
  <Image> background + <Polygon> overlay.
  NEVER Google Maps satellite tiles here.
  LandListScreen → static <Image> of GEE PNG. No map component.
- react-native-quick-crypto for SHA-256 hashing on-device.
- react-native-keychain for private key storage ONLY.
  Private key NEVER goes into Redux, MMKV, AsyncStorage, or logs.
- ethers.js v6 for wallet generation and blockchain balance reads.
- @supabase/supabase-js for phone OTP auth and data calls.
- axios for all backend API calls (base: API_BASE_URL from .env).
- Zod + React Hook Form for all form validation.
- react-native-background-fetch for offline pending_upload queue.
- lottie-react-native for loading states (spinning_leaf.json etc).
- react-native-geolocation-service for GPS.
- react-native-device-info for rooted/emulator detection.
- react-native-haptic-feedback for scan confirmation vibration.
- react-native-reanimated for screen transitions.
- react-native-chart-kit + react-native-svg for credit history chart.
- react-native-config for .env variable access.

## STITCH MCP — MANDATORY WORKFLOW

Do NOT use create_design_system, apply_design_system, update_design_system or 
list_design_systems — these are new API tools that may not 
work properly.

Use this workflow instead:
1. create_project (once per feature module)
2. generate_screen_from_text — include style context directly
   in each prompt (earthy green theme, forest colors, 48px 
   touch targets, card-based layout)
3. get_screen_code — fetch the HTML/CSS
4. Convert to React Native + NativeWind

Do NOT write screen code from the spec alone.

## STITCH MCP — UI DESIGN

All UI screens are designed using the Stitch MCP server before
implementation. When building any new screen:

1. Use Stitch to generate the visual layout and component structure.
2. The generated design must follow the TerraTrust design system below.
3. Implement the Stitch output in React Native using NativeWind classes.
4. Design modern, visually stunning modern UI with a premiumness.
   Do NOT invent UI from scratch — always design with Stitch first.

## DESIGN SYSTEM

All screen UI and visual design is handled by Stitch MCP.
Do not hardcode colours, spacing, typography, or component styles
in the rules file or constitution.

The only design constraints that are fixed for business reasons:

- Minimum 48×48px touch targets on all interactive elements (Android
  accessibility requirement — non-negotiable).
- Lottie animations: spinning_leaf.json for loading, scan_success.json
  for tree scan confirmed, credit_earned.json for token mint.
- Roboto Mono for all numerical measurement values (DBH, height, CTT
  balance) — distinguishes data from UI text.
- Status badge labels are fixed strings: "✓ Verified", "⏳ Pending",
  "✗ Rejected", "◉ High Precision", "◉ Standard Precision",
  "◎ Manual Measurement".

## AR TIERS — INTEGER ONLY. NEVER A/B/C.

Tier 1 = RAW_DEPTH_ONLY (hardware ToF depth sensor, ±2-3cm, RANSAC)
Tier 2 = SLAM motion scan (5-second left-right movement, ±4-5cm)
Tier 3 = Manual circumference entry (DBH = circumference / π)
Redux stores ar_tier_used as integer 1, 2, or 3.
API sends ar_tier_used as integer 1, 2, or 3.

## FOLDER STRUCTURE — FOLLOW EXACTLY

src/
├── app/App.tsx
├── assets/
│ ├── fonts/ (Roboto family)
│ ├── images/
│ ├── lottie/ (spinning_leaf.json, scan_success.json,
│ │ credit_earned.json)
│ └── tflite/ (species_model.tflite)
├── features/
│ ├── auth/screens/ (SplashScreen, LoginScreen, OTPScreen, KYCScreen)
│ │ └── store/authSlice.ts
│ ├── land/screens/ (LandListScreen, DocumentUploadScreen,
│ │ │ BoundaryConfirmScreen, ManualUploadGuideScreen)
│ │ └── store/landSlice.ts
│ ├── ar-audit/screens/ (AuditStartScreen, ZoneNavigationScreen,
│ │ │ ARCameraScreen, ManualMeasureScreen,
│ │ │ TreeResultScreen, AuditCompleteScreen)
│ │ └── store/auditSlice.ts
│ └── dashboard/screens/ (HomeScreen, CreditHistoryScreen)
│ └── store/creditsSlice.ts
├── services/
│ ├── api.ts (Axios instance + JWT interceptor)
│ ├── supabase.ts (Supabase client init)
│ ├── wallet.ts (ethers.js wallet creation)
│ ├── blockchain.ts (contract.balanceOf read from Polygon)
│ └── ar-bridge.ts (TypeScript interface to ARModule.kt)
├── common/
│ ├── components/ (Button, Card, Badge, BottomSheet, Loader)
│ ├── hooks/ (useGeofence.ts, useARTier.ts)
│ ├── utils/ (geoJson.ts, units.ts, hash.ts)
│ └── constants/ (colors.ts, species.ts)
└── store/
├── index.ts (Redux store + persist config)
└── mmkvStorage.ts (MMKV adapter for redux-persist)

android/app/src/main/java/com/terratrustar/
├── ar/ARModule.kt
├── ar/ARPackage.kt
└── MainApplication.kt

## MMKV PERSISTENCE — FOLLOW EXACTLY

MUST persist:
audit.scannedTrees ← MOST CRITICAL. Save after each single tree.
audit.activeAuditId
audit.currentZoneIndex
audit.arTier
auth.walletAddress
auth.isAuthenticated
land.parcels

MUST NOT persist:
audit.uploadStatus ← Reset to 'idle' on every app launch.
land.currentDraft ← Clear after successful land registration.

## OFFLINE PENDING UPLOAD

When audit submit fails (no internet): save payload to MMKV under key
'pending_upload'. react-native-background-fetch auto-retries when
connectivity restores. Not a timer — only runs on reconnect.

## SECURITY RULES

- Private key: react-native-keychain only. Never Redux/MMKV/logs.
- Aadhaar: SHA-256 hash only in Redux and API. Never plain text anywhere.
- Evidence photos: SHA-256 hash with react-native-quick-crypto on-device
  before upload. Send both base64 and hash to API.
- Mock GPS: detect via ARModule.checkMockLocation(), block audit start.
- Rooted device: react-native-device-info warning banner only.

## API BASE RULES

All endpoints are prefixed /api/v1/
Base URL from: Config.API_BASE_URL (.env via react-native-config)
Auth: Supabase JWT attached automatically by axios interceptor.

## SPECIES LIST — EXACTLY 11 SPECIES

Teak 0.60, Eucalyptus 0.55, Neem 0.56, Mango 0.54, Bamboo 0.70,
Pongamia 0.67, Subabul 0.56, Casuarina 0.69, Indian Rosewood 0.75,
Drumstick 0.39, Amla 0.74
Any other species is rejected at app level — show "not approved" message.

## COMMIT FORMAT

One commit per completed SpecKit task.
Format: [TASK-ID] Short description
Example: [T003] Implement OTPScreen 6-box input with resend timer

## NEVER INVENT — ALWAYS READ THE FILES

SRS_TerraTrust_v3.1.txt
TerraTrust_Frontend_Design_Document_v3.1.txt
TerraTrust_Backend_System_Design_v3.1.txt
When in doubt about any detail — read the file. Do not assume.
