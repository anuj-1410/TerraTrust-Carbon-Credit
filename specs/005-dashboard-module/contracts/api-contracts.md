# API Contracts: Dashboard Module (005)

**Source of truth**: `TerraTrust_Backend_System_Design_v3.1.txt` §5.5  
**Status**: Read-only reference — frontend consumes these contracts; never implements them.

---

## Contract 1: GET /api/v1/credits/balance

### Purpose
Returns the farmer's current token balance (used as fallback when blockchain RPC fails) and their complete audit history for both screens.

### Request

```
GET /api/v1/credits/balance?wallet_address={walletAddress}
Authorization: Bearer {supabaseJWT}
```

| Parameter | Type | Source | Description |
|---|---|---|---|
| `wallet_address` | `string` | `auth.walletAddress` (Redux) | Farmer's Polygon public address |

### Response (200 OK)

```json
{
  "balance_ctt": 47.3,
  "history": [
    {
      "audit_id": "uuid-string",
      "audit_year": 2025,
      "credits_issued": 12.4,
      "land_name": "North Field",
      "land_id": "uuid-string",
      "total_biomass_tonnes": 14.8,
      "tx_hash": "0x1a2b3c4d...",
      "ipfs_certificate_url": "https://ipfs.io/ipfs/bafybeiabc123...",
      "minted_at": "2025-11-15T14:23:00Z"
    }
  ]
}
```

### Field Notes

| Field | Frontend Usage |
|---|---|
| `balance_ctt` | **Fallback only** — used if `getCTTBalance()` blockchain call fails. Not the primary balance source. |
| `history[]` | Populates `credits.history` in Redux → drives both screens and bar chart |
| `ipfs_certificate_url` | Opened via `Linking.openURL()` — never null in successful response, but guard with `? :` before rendering button |
| `tx_hash` | Displayed truncated as `0x{first6}…{last4}`, tappable → PolygonScan |
| `audit_year` | Used as bar chart label + history list grouping key |
| `land_name` | Displayed directly on history entry cards |

### Error Responses

| Code | Meaning | Frontend Behaviour |
|---|---|---|
| `401` | JWT expired | axios interceptor auto-redirects to `LoginScreen` |
| `500` | Server error | axios interceptor shows maintenance banner |
| Network error | No connectivity | `fetchCreditsThunk` serves MMKV cache; sets no `lastFetchedAt` update |

---

## Contract 2: Blockchain Read — `getCTTBalance`

Not an HTTP endpoint. Documented here as an interface contract for the service function.

### Function Signature (services/blockchain.ts)

```ts
getCTTBalance(walletAddress: string): Promise<number>
```

### Behaviour

- Calls `contract.balanceOf(walletAddress)` on the deployed ERC-1155 CTT contract
- `CTT_CONTRACT_ADDRESS` = placeholder in current code (fill at deployment time)
- Returns balance as a plain JavaScript `number` (18-decimal `formatUnits` applied)
- Throws on RPC timeout, network error, or invalid address — callers must `try/catch`

### RPC Provider

```
Config.API_BASE_URL replaced with Polygon RPC endpoint
Fallback: 'https://polygon-rpc.com' (public Polygon mainnet RPC)
```

**`fetchCreditsThunk` wraps this in try/catch**: if it throws, falls back to `response.data.balance_ctt` from the API call.

---

## Contract 3: PolygonScan Deep Links (Linking.openURL)

These are not API calls but URL contracts the app constructs and passes to `Linking.openURL`.

| Link Type | URL Pattern | Where Used |
|---|---|---|
| Wallet on PolygonScan | `https://polygonscan.com/address/{walletAddress}` | HomeScreen balance card "View on PolygonScan" |
| Transaction on PolygonScan | `https://polygonscan.com/tx/{tx_hash}` | CreditHistoryScreen truncated tx hash tap |
| IPFS Certificate | `{ipfs_certificate_url}` (as-is from API) | "View Certificate" button on both screens |

---

## Contract 4: Redux Slice Interface (creditsSlice.ts)

Documents the public interface contract that screens depend on.

### State Shape

```ts
interface CreditsState {
  balance: number;              // Blockchain CTT balance (float)
  history: AuditRecord[];       // Audit history from API
  pendingMint: boolean;         // True while Celery minting task is active
  lastFetchedAt: string | null; // ISO 8601 timestamp of last successful refresh
}
```

### Exported Actions

```ts
setBalance(balance: number): PayloadAction<number>
setHistory(history: AuditRecord[]): PayloadAction<AuditRecord[]>
setPendingMint(pending: boolean): PayloadAction<boolean>
setLastFetchedAt(timestamp: string): PayloadAction<string>
```

### Exported Thunk

```ts
fetchCreditsThunk(walletAddress: string): AppThunk
// Dispatches: setHistory → setBalance (chain) → setLastFetchedAt → setPendingMint(false)
```

### Selectors (derived — implement in slice or component)

```ts
// Credits balance
(state: RootState) => state.credits.balance

// Last 2 history entries for HomeScreen preview (sorted by audit_year desc)
(state: RootState) => [...state.credits.history]
  .sort((a, b) => b.audit_year - a.audit_year)
  .slice(0, 2)

// Full history sorted desc for CreditHistoryScreen
(state: RootState) => [...state.credits.history]
  .sort((a, b) => b.audit_year - a.audit_year)
```
