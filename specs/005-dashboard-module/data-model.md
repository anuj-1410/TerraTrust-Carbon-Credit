# Data Model: Dashboard Module (005)

**Generated**: 2026-03-26  
**Sources**: SRS §13 (State Management), FDD §6 (Dashboard), BSDD §5.5 (Credits API), existing `creditsSlice.ts`, `landSlice.ts`

---

## 1. Redux State — `credits` Slice

File: `src/features/dashboard/store/creditsSlice.ts`

### CreditsState (updated)

```ts
interface CreditsState {
  balance: number;           // CTT tokens — read from Polygon blockchain
  history: AuditRecord[];   // From GET /api/v1/credits/balance response.history
  pendingMint: boolean;      // true while audit Celery task is processing
  lastFetchedAt: string | null; // ISO timestamp of last successful refresh — NEW
}
```

**Persistence**: All four fields persisted to MMKV via `redux-persist` (no blacklist). `lastFetchedAt` enables the "Last updated [time]" offline badge.

**Note**: `lastFetchedAt` is the single addition to the existing slice. All other fields and reducers already exist.

### AuditRecord (no change)

```ts
interface AuditRecord {
  audit_id: string;
  audit_year: number;
  land_id: string;
  land_name: string;
  credits_issued: number;          // e.g. 12.4
  total_biomass_tonnes: number;
  tx_hash: string;                 // Polygon transaction hash
  ipfs_certificate_url: string;    // https://ipfs.io/ipfs/[CID]
  minted_at: string;               // ISO datetime
}
```

Source: confirmed against BSDD §5.5 `GET /api/v1/credits/balance` response shape.

### New Reducer Actions

| Action | Payload | Purpose |
|---|---|---|
| `setBalance` | `number` | Update blockchain-read CTT balance |
| `setHistory` | `AuditRecord[]` | Replace full audit history from API |
| `setPendingMint` | `boolean` | Toggle minting-in-progress state |
| `setLastFetchedAt` | `string` | Record ISO timestamp of last successful fetch |

### Async Thunk: `fetchCreditsThunk`

```ts
// Signature
fetchCreditsThunk(walletAddress: string): AppThunk

// Side effects (in order)
1. GET /api/v1/credits/balance?wallet_address={walletAddress}
   → dispatch setHistory(response.data.history)
2. getCTTBalance(walletAddress) from services/blockchain.ts
   → dispatch setBalance(blockchainBalance)       // success path
   → dispatch setBalance(response.data.balance_ctt) // fallback on RPC failure
3. dispatch setLastFetchedAt(new Date().toISOString())
4. if pendingMint === true: dispatch setPendingMint(false)  // close mint cycle
```

---

## 2. Derived/Computed Data (client-side — no persistence)

### Land Parcel Display Status

Computed per `LandParcel` card on HomeScreen from `land.parcels` in Redux.

```ts
type LandCardStatus = 'green' | 'orange' | 'red';

// Inputs: parcel.last_audit_year (number | null), current calendar year
// Rules:
//   null last_audit_year         → orange (never audited)
//   last_audit_year === thisYear → green
//   thisYear - last_audit_year >= 2 → red (15+ months overdue)
//   prior year but < March 1 of thisYear → orange
//   prior year and >= March 1 of thisYear → red
```

Field `LandParcel.last_audit_year` exists in `landSlice.ts`. No API call needed.

### Bar Chart Data

Computed in `CreditHistoryScreen` via `useMemo` from `credits.history`.

```ts
interface ChartData {
  labels: string[];            // ['2023', '2024', '2025'] — ascending years
  datasets: [{ data: number[] }]; // summed credits_issued per year
}

// Aggregation: group history by audit_year, sum credits_issued per group
// Sort: ascending by year (oldest bar on left)
// Shape required by react-native-chart-kit v6 BarChart
```

---

## 3. Screen-Level UI State (local — not persisted)

### HomeScreen

| State variable | Type | Purpose |
|---|---|---|
| `showCelebration` | `boolean` | Controls `credit_earned.json` Lottie overlay visibility |
| `prevPendingMint` | `useRef<boolean>` | Detects `pendingMint` `true → false` transition |
| `prevBalance` | `useRef<number>` | Records balance when minting started to detect increase |

### CreditHistoryScreen

| State variable | Type | Purpose |
|---|---|---|
| `isLoading` | `boolean` from thunk status | Controls `spinning_leaf.json` Lottie display |

---

## 4. External Data Sources

### 4.1 Blockchain (services/blockchain.ts)

- **Function**: `getCTTBalance(walletAddress: string): Promise<number>`
- **Network**: Polygon PoS mainnet (or Amoy testnet)
- **Call**: `contract.balanceOf(walletAddress)` on ERC-1155 CTT contract
- **Return**: Decimal CTT balance (ethers `formatUnits` with 18 decimals)
- **Timeout**: Handled by ethers.js provider timeout — if it rejects, `fetchCreditsThunk` catches and uses `balance_ctt` from API response

### 4.2 Backend API (services/api.ts)

- **Endpoint**: `GET /api/v1/credits/balance`
- **Query param**: `wallet_address` (farmer's Polygon address from `auth.walletAddress`)
- **Response shape** (from BSDD §5.5):

```json
{
  "balance_ctt": 47.3,
  "history": [
    {
      "audit_year": 2025,
      "credits_issued": 12.4,
      "land_name": "North Field",
      "tx_hash": "0xabc...",
      "ipfs_certificate_url": "https://ipfs.io/ipfs/[CID]",
      "minted_at": "2025-11-15T14:23:00Z"
    }
  ]
}
```

**Note**: `audit_id`, `land_id`, `total_biomass_tonnes` are additional fields returned per BSDD and already reflected in `AuditRecord` interface.

---

## 5. Entities Used (Cross-Feature Dependencies)

| Entity | Source Feature | Field Used |
|---|---|---|
| `LandParcel` | Feature 003 (`land.parcels`) | `farm_name`, `area_hectares`, `thumbnail_url`, `is_verified`, `last_audit_year` |
| `auth.walletAddress` | Feature 002 (`authSlice`) | Used as query param for API + blockchain call |
| `audit.pendingMint` | Feature 004 (`auditSlice`) | Read for HomeScreen "Minting in progress" indicator |

---

## 6. State Transitions

```
App launch (offline)
  → redux-persist rehydrates credits from MMKV
  → HomeScreen shows balance + history from cache
  → lastFetchedAt drives "Last updated [time]" badge

App launch (online) / screen mount
  → fetchCreditsThunk(walletAddress) dispatched
  → Loading state: isLoading = true / spinning_leaf.json shown
  → API call: GET /api/v1/credits/balance → setHistory()
  → Blockchain call: getCTTBalance() → setBalance()
  → setLastFetchedAt(now)
  → Screens re-render with fresh data

Audit completes (Feature 004)
  → auditSlice.uploadStatus = 'success'
  → creditsSlice.pendingMint = true  (set by Feature 004)
  → HomeScreen shows "Minting in progress…" banner

Minting confirmed (polling interval in Feature 004)
  → HomeScreen's fetchCreditsThunk triggered
  → balance increases → setBalance(newBalance)
  → setPendingMint(false)
  → showCelebration = true → credit_earned.json plays
  → celebration auto-dismisses after animation completes
```
