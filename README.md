<div align="center">

# 🌿 TerraTrust-AR

### AI-Powered Spatial Computing System for Autonomous Carbon Credit Verification

*Empowering Indian smallholder agroforestry farmers with zero-cost, tamper-proof carbon credit verification — right from their Android phones.*

---

![React Native](https://img.shields.io/badge/React_Native-CLI-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Python](https://img.shields.io/badge/Python-FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![Polygon](https://img.shields.io/badge/Polygon-PoS_Blockchain-8247E5?style=for-the-badge&logo=polygon&logoColor=white)
![Google Earth Engine](https://img.shields.io/badge/Google_Earth_Engine-Satellite_Fusion-4285F4?style=for-the-badge&logo=google&logoColor=white)
![ARCore](https://img.shields.io/badge/Google_ARCore-3--Tier_AR-FF6F00?style=for-the-badge&logo=google&logoColor=white)
![License](https://img.shields.io/badge/License-Academic-green?style=for-the-badge)

<br/>

</div>

---
##  The Problem
 
Indian agroforestry farmers grow trees that absorb CO₂. This stored carbon can be converted into **carbon credits** — which have real monetary value in global carbon markets. However, small farmers are almost entirely shut out of these markets — not because they lack trees, but because the verification system was never built for them.
 
> India's smallholder agroforestry farmers collectively sequester **millions of tonnes of CO₂** every year — yet they receive **zero economic benefit** from carbon markets.
 
The reason? Traditional carbon credit verification costs tens of thousands of rupees per farm, requires specialist consultants, expensive LiDAR equipment, and months of paperwork.
 
<br />
Challenges Faced by Farmers
 
| # | Challenge | Why It Hurts |
|:---:|:---|:---|
| 💸 | **No affordable verification method** | There is no cheap and scalable method to verify tree biomass on small farms. Hiring third-party auditors costs ₹50,000–₹2,00,000 per farm — completely out of reach for a smallholder. |
| 📄 | **Land ownership is hard to prove** | Carbon markets require official, government-recognised land records. Hand-drawn maps or verbal agreements are not accepted. Farmers must prove ownership through legal documents like the **7/12 Extract**, which requires OCR and government API integration to process digitally. |
| 🌐 | **Weak internet in rural areas** | Field audits happen on farmland, often far from reliable connectivity. Any system that requires constant internet will fail mid-audit, losing all collected data. |
| 🔬 | **No technical knowledge — but needed** | Measuring tree biomass traditionally requires instruments like LiDAR scanners, dendrometers, and GPS survey equipment, along with trained professionals. A typical farmer has none of these. |
| 🔒 | **Carbon markets demand tamper-proof evidence** | Without cryptographic proof, there is no way to prevent fraud — fake trees, duplicate claims for the same land, or inflated biomass numbers. Every scan, measurement, and calculation must be independently verifiable. |
| 📡 | **No satellite data pipeline for individual farms** | Satellite-based biomass estimation has existed in research for years, but no system processes it automatically for a single 2–5 acre farm and delivers the result to a farmer's phone. |
 
<br />
 
## 💡 Our Solution
 
**TerraTrust-AR eliminates every single one of those barriers.**
 
A farmer with a ₹8,000 Android phone can now:
 
| ✔ | What They Can Do |
|:---:|:---|
| ✔ | Verify their official government land record using OCR |
| ✔ | Receive an automatically generated farm boundary from government APIs |
| ✔ | Scan trees using AR — with fallback support for any Android device |
| ✔ | Get biomass calculated from multi-satellite fusion on Google Earth Engine |
| ✔ | Receive cryptographically-verifiable carbon credit tokens on Polygon blockchain |
 
> All of this happens **in under an hour, entirely for free**, with full offline support for field operations.
 
<br />
 
## 📱 App Screenshots
 
<div align="center">
<table>
<tr>
<td align="center" width="33%">
**Farmer Sign In**<br />
<img width="220" alt="Farmer Sign In" src="https://github.com/user-attachments/assets/2bfc22c2-5c3e-4159-8789-109d29914330" />
 
</td>
<td align="center" width="33%">
**Home Dashboard**<br />
<img width="220" alt="Home Dashboard" src="https://github.com/user-attachments/assets/926ad393-2eb0-4dd5-8614-511e4018e9f6" />
 
</td>
<td align="center" width="33%">
**My Lands**<br />
<img width="220" alt="My Lands" src="https://github.com/user-attachments/assets/fcd95b9a-45bf-45f6-9b0f-65a5c0897aa2" />
 
</td>
</tr>
<tr>
<td align="center" width="33%">
**Credit History**<br />
<img width="220" alt="Credit History" src="https://github.com/user-attachments/assets/163a2190-3749-4f06-aed5-942f2ce24af7" />
 
</td>
<td align="center" width="33%">
**My Profile**<br />
<img width="220" alt="My Profile" src="https://github.com/user-attachments/assets/75da6ee9-4a76-43ce-b899-3bf2cc0b79c0" />
 
</td>
<td align="center" width="33%">
**Profile Settings**<br />
<img width="220" alt="Profile Settings" src="https://github.com/user-attachments/assets/001389a6-6211-4aa7-a414-bff2866b66a0" />
 
</td>
</tr>
<tr>
<td align="center" width="33%">
**Wallet Recovery**<br />
<img width="220" alt="Wallet Recovery" src="https://github.com/user-attachments/assets/9f94ae75-62f3-4835-bb09-0541e729613a" />
 
</td>
<td align="center" width="33%">
**Land Detail**<br />
<img width="220" alt="Land Detail" src="https://github.com/user-attachments/assets/10465e8e-4eca-48bb-9acd-6d1ea7231ec3" />
 
</td>
<td align="center" width="33%">
**Annual Audit Steps**<br />
<img width="220" alt="Annual Audit Steps" src="https://github.com/user-attachments/assets/97a66183-66eb-4fc4-8cc1-22b4fa8cf37d" />
 
</td>
</tr>
<tr>
<td align="center" width="33%">
**Audit Zone Generation**<br />
<img width="220" alt="Audit Zone Generation" src="https://github.com/user-attachments/assets/9ebfcf43-a301-4734-9c46-e8b5224167b0" />
 
</td>
<td align="center" width="33%">
**Zone Map & Scanning**<br />
<img width="220" alt="Zone Map & Scanning" src="https://github.com/user-attachments/assets/cdfbd79c-a78a-48b5-a926-3f251f1d5897" />
 
</td>
<td align="center" width="33%"></td>
</tr>
</table>
</div>
<br />

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    ANDROID MOBILE APP                           │
│   React Native CLI + TypeScript + Kotlin ARCore Modules        │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │Auth/KYC  │  │  Land    │  │  AR Tree │  │   Credits &   │  │
│  │Firebase  │  │  Verify  │  │  Scanner │  │   History     │  │
│  │Phone OTP │  │  OCR+WMS │  │  ARCore  │  │   CTT Wallet  │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └───────┬───────┘  │
└───────┼─────────────┼─────────────┼─────────────────┼──────────┘
        │             │  HTTPS + Firebase ID Token     │
┌───────▼─────────────▼─────────────▼─────────────────▼──────────┐
│                  PYTHON FASTAPI BACKEND                         │
│              (Render.com + Celery + Honcho)                     │
│                                                                  │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│   │  Land Doc    │    │  Satellite   │    │   Blockchain     │  │
│   │  OCR + LGD   │    │  Fusion GEE  │    │   Minting Svc    │  │
│   │  BhuNaksha   │    │  XGBoost ML  │    │   web3.py        │  │
│   └──────────────┘    └──────────────┘    └──────────────────┘  │
└──────────┬──────────────────┬──────────────────┬────────────────┘
           │                  │                  │
    ┌──────▼──────┐   ┌───────▼──────┐   ┌──────▼────────────┐
    │  Supabase   │   │ Google Earth │   │ Polygon PoS +     │
    │ PostgreSQL  │   │    Engine    │   │ IPFS via Pinata   │
    │  + PostGIS  │   │ NISAR·S1·S2  │   │ ERC-1155 Tokens   │
    └─────────────┘   │  GEDI·SRTM  │   └───────────────────┘
                      └─────────────┘
```

---

## 🚀 Four Pillars of TerraTrust-AR

### 🏛️ Pillar 1 — Government Land Verification
OCR-based processing of **7/12 Extract** and **Record of Rights** documents using Google Cloud Vision API, combined with a **three-layer boundary fetching architecture**:

- **Layer 1** — Maharashtra LGD REST API → BhuNaksha WMS official cadastral polygon
- **Layer 2** — Playwright headless browser fallback for other NIC BhuNaksha states
- **Layer 3** — Manual map upload with OpenCV contour georeferencing

Every boundary is validated by PostGIS `ST_IsValid()`, cross-matched against KYC data with 80% fuzzy name matching, and stored in EPSG:4326.

---

### 📡 Pillar 2 — AR Tree Scanning (3-Tier System)

The measurement system adapts to whatever Android device a farmer has:

| Tier | Hardware Required | Method | Expected Error |
|------|-----------------|--------|---------------|
| **Tier 1** | ToF / LiDAR depth sensor | ARCore RAW_DEPTH + RANSAC cylinder fit | ±2–3 cm |
| **Tier 2** | Any ARCore-capable device | Motion-based SLAM depth estimation | ±4–5 cm |
| **Tier 3** | Any Android phone | Manual string circumference (Kotlin bridge) | <1% |

On-device **TensorFlow Lite** model identifies 11 approved agroforestry species (Teak, Bamboo, Eucalyptus, Mango, Neem, etc.) from the camera feed — no internet required.

---

### 🛰️ Pillar 3 — Six-Layer Satellite Fusion Engine

Processed entirely on **Google Earth Engine** — zero data download to backend servers:

```
Feature Stack (12 features in production phase):
┌─────────────────────────────────────────────────────────────┐
│  NISAR L-band SAR (July 2025)  │  HH · HV · HH/HV ratio   │
│  Sentinel-1 C-band SAR         │  VH · VV · VH/VV ratio    │
│  Sentinel-2 Optical            │  NDVI · EVI · Red-Edge    │
│  NASA GEDI LiDAR               │  rh98 canopy height       │
│  SRTM Topographic              │  Elevation · Slope        │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
   XGBoost Gradient Boosted Regression
   (100 trees · lr=0.05 · 70% sample rate)
         │
         ▼
   Per-pixel biomass prediction at 10m resolution
   across entire verified farm boundary
```

**Biomass → Carbon Credits** via the Chave et al. (2014) pantropical allometric equation:

```
AGB = 0.0673 × (ρ × D² × H)^0.976
```
Then: `Carbon Credits = ΔAGB × 0.47 (IPCC fraction) × 3.667 (CO₂ ratio)`

| Satellite Configuration | Estimated Biomass Error |
|---|---|
| Sentinel-1 only | ~35% |
| + Sentinel-2 + GEDI + SRTM (dev phase) | ~12% |
| + NISAR L-band (production, June 2026) | **~5–6%** ✅ |

---

### 🔗 Pillar 4 — Blockchain Tokenisation

```solidity
// ERC-1155 on Polygon PoS (Amoy Testnet → Mainnet)
function mintAudit(
    address farmer,
    uint256 auditId,
    uint256 creditAmount,   // deci-CTT units
    string memory ipfsUri,
    string memory landId,
    uint256 auditYear
) external onlyOwner { ... }
```

- **Carbon Ton Tokens (CTT)** — Fungible ERC-1155 (Token ID: 1), tradable on carbon markets
- **Audit Certificate NFTs** — Non-fungible per-audit proof, IPFS CID stored permanently on-chain
- **Double-minting prevention** — `keccak256(landId + auditYear)` mapping, reverts on duplicate
- **Credit retirement** — `retireCredits()` burns tokens and emits `CreditRetired` event with timestamp

The farmer's private key **never leaves their device** — generated with ethers.js, secured in Android Keystore via `react-native-keychain`.

---

## 📱 Getting Started

### Prerequisites

- Node.js ≥ 18, JDK 17, Android Studio (Hedgehog+)
- ARCore-compatible Android device (API 26+)
- Python 3.11+ for backend

> Complete environment setup: [React Native Environment Guide](https://reactnative.dev/docs/set-up-your-environment)

---

### 📦 Installation

```bash
# Clone the repository
git clone https://github.com/your-org/terratrust-ar.git
cd terratrust-ar

# Install JS dependencies
npm install

# Install iOS CocoaPods (iOS future scope)
bundle install && bundle exec pod install
```

### 🔑 Environment Configuration

Create `android/local.properties`:
```properties
GOOGLE_MAPS_API_KEY=your_maps_key_here
```

Create `.env` in project root:
```env
FIREBASE_PROJECT_ID=your_project_id
ALCHEMY_RPC_KEY=your_alchemy_key
BACKEND_BASE_URL=https://your-render-app.onrender.com
```

---

### ▶️ Running the App

**Step 1 — Start Metro bundler:**
```bash
npm start
```

**Step 2 — Build and run on Android:**
```bash
npm run android
# OR
yarn android
```

> **Hot reload** is enabled via [Fast Refresh](https://reactnative.dev/docs/fast-refresh). Press `R` twice in the emulator to force reload.

---

### 🐍 Backend Setup

```bash
cd backend
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Fill in: SUPABASE_URL, SUPABASE_KEY, FIREBASE_CREDENTIALS_PATH,
#           ADMIN_WALLET_PRIVATE_KEY, CONTRACT_ADDRESS, PINATA_JWT

# Run migrations (Supabase SQL Editor)
# Enable PostGIS: CREATE EXTENSION IF NOT EXISTS postgis;

# Start FastAPI + Celery via Honcho
honcho start
```

Backend runs at `http://localhost:8000` with auto-generated Swagger docs at `/docs`.

---

### ⛓️ Smart Contract Deployment

```bash
cd blockchain
npm install

# Run all contract tests (must pass 100%)
npx hardhat test

# Deploy to Polygon Amoy testnet
npx hardhat run scripts/deploy.js --network polygon_amoy

# Optional: Verify on PolygonScan
npx hardhat verify --network polygon_amoy <CONTRACT_ADDRESS>
```

---

## 🗂️ Project Structure

```
terratrust-ar/
│
├── 📱 src/
│   ├── navigation/          # RootNavigator, AuthStack, MainTabs
│   ├── features/
│   │   ├── auth/            # Firebase OTP, KYC, wallet creation
│   │   ├── land/            # OCR, LGD API, BhuNaksha WMS
│   │   ├── scanning/        # ARCore 3-tier, species TFLite, MMKV
│   │   └── credits/         # CTT balance, audit history, retirement
│   ├── store/               # Redux Toolkit slices + redux-persist
│   └── services/            # API client, ethers.js wallet
│
├── 🤖 android/
│   └── app/src/main/java/
│       └── ARModule.kt      # Kotlin ARCore depth + RANSAC cylinder
│
├── 🐍 backend/
│   ├── routers/             # auth, land, audit, credits
│   ├── services/
│   │   ├── ocr_service.py   # Google Cloud Vision + OpenCV
│   │   ├── boundary.py      # LGD + BhuNaksha 3-layer fetcher
│   │   ├── gee_fusion.py    # Earth Engine 6-layer XGBoost pipeline
│   │   └── minting.py       # web3.py Polygon ERC-1155 minter
│   └── tasks/
│       └── celery_tasks.py  # Async satellite fusion + minting jobs
│
├── ⛓️ blockchain/
│   ├── contracts/
│   │   └── TerraTrustToken.sol   # ERC-1155 + Ownable + retire()
│   ├── test/
│   │   └── TerraTrustToken.test.js
│   └── scripts/deploy.js
│
└── 🤖 ml/
    └── species_classifier/  # TFLite model (224×224 RGB, 11 species)
```

---

## 🧪 Testing

```bash
# React Native unit tests
npm test

# Backend pytest (Chave equation, credit calc, API endpoints)
cd backend && pytest -v

# Smart contract tests (Hardhat)
cd blockchain && npx hardhat test

# E2E: Use Firebase test phone numbers (OTP bypass for CI)
```

**Field-validated AR accuracy:**
- Tier 1 (ToF): avg. 2.1 cm error on 25 cm reference (8.4%)
- Tier 2 (SLAM): avg. 4.3 cm error on 25 cm reference
- Tier 3 (String): <1% error when carefully measured

---

## 🛰️ Satellite Data Sources

| Source | Agency | Data Type | Access |
|--------|--------|-----------|--------|
| NISAR | NASA-ISRO | L-band SAR (GCOV) | Alaska Satellite Facility |
| Sentinel-1 | ESA/Copernicus | C-band SAR GRD | Google Earth Engine |
| Sentinel-2 | ESA/Copernicus | Multispectral SR | Google Earth Engine |
| GEDI | NASA/LARSE | LiDAR canopy height | Google Earth Engine |
| SRTM | NASA | 30m DEM | Google Earth Engine (public domain) |

---

## 📊 System Metrics (v3.1)

| Metric | Value |
|--------|-------|
| Target biomass estimation error (with NISAR) | 5–6% |
| Dev-phase error (Sentinel stack, 9 features) | ~12% |
| States with full automated boundary fetching | Maharashtra (36 districts) |
| Minimum supported Android API level | 26 (Android 8.0) |
| Offline resilience | Full MMKV session recovery |
| Infrastructure cost per farmer (MVP scale) | ₹0 |
| Blockchain network | Polygon Amoy Testnet → Mainnet |
| Smart contract double-minting protection | keccak256 on-chain guard |

---

## 👨‍💻 Team

| Name |
|------|
| **Abhishek Shrivastav** | 
| **Anuj Agrawal** | 
| **Anuj Parwal** | 
| **Deepanshu Nanure** | 

---

## 🔮 Roadmap

- [ ] **June 2026** — Enable NISAR production data (`NISAR_PRODUCTION_READY=true`)
- [ ] **Q3 2026** — Submit for Verra VM0047 methodology certification
- [ ] **Q3 2026** — Multi-state LGD integration (KA, AP, TG, TN, UP)
- [ ] **Q4 2026** — iOS port (ARKit bridge + alternative map renderer)
- [ ] **2027** — Buyer-facing CTT marketplace & retirement dashboard
- [ ] **2027** — Polygon mainnet deployment

---

## 📚 Key References

- Chave et al. (2014) — Pantropical allometric equations for tree biomass
- Dubayah et al. (2020) — NASA GEDI LiDAR for above-ground biomass
- Chen & Guestrin (2016) — XGBoost gradient boosted trees
- Gorelick et al. (2017) — Google Earth Engine
- NASA-ISRO (2025) — NISAR Mission Overview
- OpenZeppelin — ERC-1155 Multi Token Standard

Full references available in `docs/report.pdf`.

---

## ⚖️ License

All satellite data used is freely distributed under the respective agency terms (NASA, ESA, ISRO).

---

<div align="center">

*Built with 🌱 to give Indian farmers the carbon market access they deserve.*

</div>
