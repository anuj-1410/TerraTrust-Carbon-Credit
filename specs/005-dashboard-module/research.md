# Research: Dashboard Module (005)

**Generated**: 2026-03-26  
**Status**: Complete — all NEEDS CLARIFICATION resolved

---

## Decision Log

### R-001: CTT Balance Source — Blockchain vs API

**Question**: Which is the authoritative source for the CTT balance shown on HomeScreen — the `balance_ctt` field from `GET /api/v1/credits/balance`, or a direct `contract.balanceOf` call via `services/blockchain.ts`?

**Decision**: **Polygon blockchain via `ethers.js` `getCTTBalance()` in `services/blockchain.ts` is the primary source**.  
`GET /api/v1/credits/balance` is still called for two purposes: (1) to populate `credits.history` (the audit history array) and (2) as the fallback `balance_ctt` value if the RPC call fails or times out.

**Rationale**: Stated explicitly in user instruction: "CTT balance source is Polygon blockchain via ethers.js contract.balanceOf — NOT Supabase. services/blockchain.ts handles this." Blockchain balance is also more tamper-resistant for carbon credit display, since it reads the on-chain state directly.

**Implementation detail**: `services/blockchain.ts` already exports `getCTTBalance(walletAddress: string): Promise<number>` using `ethers.JsonRpcProvider` + `contract.balanceOf`. This is called on HomeScreen mount with `auth.walletAddress` from Redux. If it throws, fall back to `response.balance_ctt` from the API call.

**Alternatives considered**:
- API-only: Rejected — user explicitly requires blockchain read. Also risks showing stale backend-computed balance.
- Blockchain-only (no API call): Rejected — history array only comes from backend API. PolygonScan deep-link still needs wallet address from Redux (already available).

---

### R-002: Offline Balance — Cache Strategy & "Last updated" Display

**Question**: How is the cached balance served offline and how is staleness communicated?

**Decision**: Add `lastFetchedAt: string | null` to `CreditsState` in `creditsSlice.ts`. This timestamp is written on every successful balance refresh (from blockchain call or API fallback). When offline (network call throws / no connectivity), both screens render the Redux-persisted `balance` and `history` from MMKV. A `"Last updated [time]"` badge is shown using `lastFetchedAt` formatted as a relative or absolute time string.

**Rationale**: MMKV persistence is already wired for the `credits` slice in `src/store/index.ts` (no blacklist). Adding `lastFetchedAt` is a minimal, additive change to the existing slice. Pattern matches the FDD spec: "Shows cached last known history with 'Last updated [time]' badge."

**Alternatives considered**:
- Storing timestamp in a separate MMKV key: Rejected — adds complexity vs extending the slice.
- NetInfo active check to gate the "stale" badge: Not needed — if the live fetch fails or hasn't been attempted yet, the badge should show regardless of current connectivity.

---

### R-003: `credit_earned.json` Lottie Trigger Condition

**Question**: Exactly when on HomeScreen should `credit_earned.json` animate?

**Decision**: Play `credit_earned.json` as a one-time overlay when:
1. `pendingMint` transitions from `true` → `false` **AND**
2. `balance` is greater than the previous balance (tracked via `useRef<number>` storing the balance value at the time `pendingMint` became `true`).

This means: the animation plays once when a minting cycle completes and the new tokens are confirmed on-chain. It does NOT play on app launch with a pre-existing balance.

**Rationale**: User instruction: "credit_earned.json Lottie plays on HomeScreen when new tokens arrive." The `pendingMint + balance increase` combination is the only reliable signal for new tokens arriving without a separate event bus. `pendingMint` is set by the AR-Audit module (Feature 004) before submission and cleared by `creditsSlice` after the balance is refreshed. The `useRef` comparison prevents false triggers on rehydration.

**Alternatives considered**:
- Redux action-triggered flag `showCelebration`: More explicit but requires an extra reducer action and more coupling with Feature 004.
- Polling for balance change: Rejected — wastes RPC calls and triggers on stale rehydration.

---

### R-004: Bar Chart Data Shape for `react-native-chart-kit`

**Question**: How should `credits.history` (array of `AuditRecord`) be transformed for the `BarChart` component?

**Decision**: Group by `audit_year`, summing `credits_issued` across all parcels for each year. Sort years ascending (oldest left). Feed into `react-native-chart-kit` `BarChart` `data` prop as:
```ts
{
  labels: ['2023', '2024', '2025'],       // string years ascending
  datasets: [{ data: [8.2, 9.8, 12.4] }]  // summed credits per year
}
```
Computed with `useMemo` inside `CreditHistoryScreen` from `credits.history`.

**Rationale**: `react-native-chart-kit` v6 `BarChart` requires exactly this shape. The FDD states "bar chart showing credit growth year over year across all parcels" — summing per year (not per parcel) is the correct aggregation. `react-native-svg` v15 is already installed as the peer dependency.

**Chart config note**: `withHorizontalLabels: true`, `showBarTops: true`, `fromZero: true`. Use `Roboto Mono` font for y-axis values via `chartConfig.fontFamily`.

**Alternatives considered**:
- Stacked bar chart per parcel: Rejected — FDD says year-over-year growth chart, not per-parcel breakdown.
- react-native-victory curves: Rejected — not in the locked tech stack.

---

### R-005: IPFS and PolygonScan Deep-Link Strategy

**Question**: How should "View Certificate" and transaction hash taps open external URLs?

**Decision**: Use React Native core `Linking.openURL(url)` for both:
- **"View Certificate"**: `Linking.openURL(record.ipfs_certificate_url)` — opens `https://ipfs.io/ipfs/[CID]` in device browser.
- **Transaction hash tap**: `Linking.openURL('https://polygonscan.com/tx/' + record.tx_hash)`.
- **"View on PolygonScan" link (HomeScreen balance card)**: `Linking.openURL('https://polygonscan.com/address/' + walletAddress)`.

Guard: if `ipfs_certificate_url` is null/empty, the "View Certificate" button is hidden (`{record.ipfs_certificate_url ? <...> : null}`). Same for transaction hash row.

**Rationale**: No in-app web view or `AuditCertificateScreen` exists per spec and FDD. `Linking` is React Native core — no extra dependency. URL format `https://ipfs.io/ipfs/[CID]` confirmed in BSDD section 5.5 response shape.

**Security note**: `ipfs_certificate_url` values come from the API — they are `https://ipfs.io/ipfs/[CID]` format. These are content-addressed and immutable. `Linking.openURL` is safe; no injection risk via the CID segment since content is addressed not named.

**Alternatives considered**:
- In-app `WebView`: Explicitly rejected in spec, FDD, and SRS.
- Constructing the URL from CID only: Rejected — backend sends full URL per BSDD. Use it as-is.

---

### R-006: Land Parcel Status Colour Derivation

**Question**: How is the green/orange/red status of each land parcel card computed client-side?

**Decision**: Use the `last_audit_year` field already present on `LandParcel` (confirmed in `src/features/land/store/landSlice.ts`) plus the current calendar year:

```ts
function getLandStatus(parcel: LandParcel): 'green' | 'orange' | 'red' {
  const currentYear = new Date().getFullYear();
  if (!parcel.last_audit_year) return 'orange';          // never audited
  if (parcel.last_audit_year === currentYear) return 'green';  // audited this year
  if (currentYear - parcel.last_audit_year >= 2) return 'red'; // 12+ months past year = overdue
  // last_audit_year === currentYear - 1, check if >3 months into current year
  const now = new Date();
  const marchCutoff = new Date(currentYear, 2, 1); // March 1 of current year
  return now >= marchCutoff ? 'red' : 'orange';
}
```

"Overdue by more than 3 months" (SRS) = last audited in prior year AND we are now more than 3 months into the current year (i.e., past March 1).

**Rationale**: `LandParcel.last_audit_year` is available in Redux from Feature 003. No additional API call is required. The SRS states "Green = Verified and audited this year; Orange = Verified but audit due; Red = Overdue by more than 3 months."

**Alternatives considered**:
- Computing from `credits.history` join on `land_id`: More accurate but requires a join across slices. `last_audit_year` is the designated field for this purpose in the data model.

---

### R-007: `creditsSlice.ts` — Required Additions

**Question**: What changes are needed to the existing `creditsSlice.ts` to support all dashboard features?

**Decision**: Add `lastFetchedAt: string | null` to `CreditsState` and a `setLastFetchedAt` reducer action. No other structural changes needed — the existing `setBalance`, `setHistory`, `setPendingMint` reducers are sufficient.

**Existing slice in codebase**: `src/features/dashboard/store/creditsSlice.ts` already defines `AuditRecord`, `CreditsState`, and the three reducers. The `AuditRecord` interface already includes all BSDD response fields.

**Rationale**: `lastFetchedAt` is the minimal addition to enable the "Last updated [time]" offline badge per FR-014. All other required state is already present.

---

### R-008: fetchCreditsThunk — Async Thunk Architecture

**Question**: Should balance + history fetching use a Redux async thunk or a custom hook?

**Decision**: Implement a `fetchCreditsThunk` as a Redux `createAsyncThunk` in `creditsSlice.ts`. The thunk:
1. Calls `GET /api/v1/credits/balance?wallet_address={walletAddress}` via `api.ts`.
2. Dispatches `setHistory(response.data.history)`.
3. Independently calls `getCTTBalance(walletAddress)` from `blockchain.ts`.
4. On blockchain success: dispatches `setBalance(blockchainBalance)`.
5. On blockchain failure (timeout/RPC error): dispatches `setBalance(response.data.balance_ctt)` as fallback.
6. Dispatches `setLastFetchedAt(new Date().toISOString())`.

Both screens dispatch `fetchCreditsThunk(walletAddress)` on mount. The thunk is idempotent — calling it again refreshes the data.

**Rationale**: Centralises the fetch-balance-then-confirm-blockchain logic in one place. Screens stay presentational. Consistent with the existing redux-thunk middleware already in the store.

**Alternatives considered**:
- Components directly calling `blockchain.ts` and `api.ts`: Creates duplication between HomeScreen and CreditHistoryScreen.
- RTK Query: Not in the locked tech stack. Adds new dependency.

---

### R-009: `react-native-chart-kit` BarChart — known NativeWind interaction

**Question**: Does `react-native-chart-kit` work correctly with NativeWind / className-based styling?

**Decision**: `react-native-chart-kit` uses its own `chartConfig` object (not NativeWind classes) for internal styling including bar colours, background, and fonts. The `<BarChart>` component must be wrapped in a `<View className="...">` for positioning/sizing, but the chart itself is configured via `chartConfig` props. `width` must be provided explicitly (use `Dimensions.get('window').width - 32` for padding).

**Rationale**: `react-native-chart-kit` v6 renders to `react-native-svg` paths, not RN Views — NativeWind utility classes do not apply to chart internals. This is a known chart library constraint.

**Alternatives considered**: None — chart library is locked in the tech stack.

---

### R-010: Confirmed: `pendingMint` management across features

**Question**: Which feature writes `pendingMint = true` and which writes `pendingMint = false`?

**Decision**:
- **Feature 004 (AR Audit)**: Sets `pendingMint = true` after `POST /api/v1/audit/submit` succeeds and the app starts polling `GET /api/v1/audit/result/{audit_id}`.
- **Feature 005 (Dashboard)**: Sets `pendingMint = false` inside `fetchCreditsThunk` after a balance refresh confirms the new balance. Specifically: after the thunk completes successfully and the balance has been updated.

The dashboard module only **reads** `pendingMint` for the HomeScreen "Minting in progress…" indicator and the `credit_earned.json` trigger logic. The write of `pendingMint = false` happens when `fetchCreditsThunk` is called and succeeds while `pendingMint` was `true` — this signals that the mint cycle is done.

**Rationale**: Clean ownership — Feature 004 opens the minting cycle, Feature 005 closes it on confirmed balance refresh.
