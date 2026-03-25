# Quickstart: Dashboard Module (005)

**Branch**: `005-dashboard-module`  
**Prerequisites**: Features 001–004 implemented and merged to main.

---

## What This Module Delivers

- **`HomeScreen`** — the app's post-login landing screen:  
  CTT balance (from Polygon blockchain), land parcel list with status badges, 2-entry credit history preview, and `credit_earned.json` celebration animation when new tokens arrive.  
- **`CreditHistoryScreen`** — full audit history with a year-over-year bar chart and IPFS certificate links.  
- **`creditsSlice.ts` update** — adds `lastFetchedAt` and `fetchCreditsThunk` to the existing slice.

---

## File Map

```
src/features/dashboard/
├── store/
│   └── creditsSlice.ts       ← Update: add lastFetchedAt + fetchCreditsThunk
└── screens/
    ├── HomeScreen.tsx         ← Implement (currently stub)
    └── CreditHistoryScreen.tsx ← Implement (currently stub)

src/services/
└── blockchain.ts              ← Already implemented (getCTTBalance)
```

No new files outside of `src/features/dashboard/`. No navigation changes needed — routes already registered in `src/app/App.tsx` and `src/types/navigation.ts`.

---

## Step 1: Update `creditsSlice.ts`

Add `lastFetchedAt` field and `fetchCreditsThunk`:

```ts
// NEW field in CreditsState
lastFetchedAt: string | null;

// NEW initial value
lastFetchedAt: null,

// NEW reducer
setLastFetchedAt(state, action: PayloadAction<string>) {
  state.lastFetchedAt = action.payload;
},

// NEW async thunk (import createAsyncThunk, api, getCTTBalance)
export const fetchCreditsThunk = createAsyncThunk(
  'credits/fetchCredits',
  async (walletAddress: string, { dispatch, getState }) => {
    // 1. Fetch history from API
    const response = await api.get(
      `/api/v1/credits/balance?wallet_address=${walletAddress}`
    );
    dispatch(setHistory(response.data.history));

    // 2. Get balance from blockchain (primary); fallback to API value
    try {
      const blockchainBalance = await getCTTBalance(walletAddress);
      dispatch(setBalance(blockchainBalance));
    } catch {
      dispatch(setBalance(response.data.balance_ctt));
    }

    // 3. Close pending mint cycle if it was open
    const state = getState() as RootState;
    if (state.credits.pendingMint) {
      dispatch(setPendingMint(false));
    }

    // 4. Record fetch time
    dispatch(setLastFetchedAt(new Date().toISOString()));
  },
);
```

---

## Step 2: Design HomeScreen with Stitch MCP

**MANDATORY — do not skip.**

Call `generate_screen_from_text` with a prompt describing:
- Top card: large Roboto Mono CTT balance, "Carbon Ton Tokens earned" subtitle, CO2 equivalence line, small "View on PolygonScan" link
- Middle scrollable list of land parcel cards (thumbnail, name, area, green/orange/red status badge, optional "Start Audit" CTA button)
- Bottom section: 2 credit history rows (year, +X.X CTT, "View Certificate" button), "View All History →" link
- Earthy green/soil design language consistent with TerraTrust brand

Then call `get_screen` to retrieve download URL → fetch HTML/CSS → convert to NativeWind.

---

## Step 3: Implement HomeScreen

Key wiring points:

```ts
// Fetch on mount
const { walletAddress } = useAppSelector(s => s.auth);
const { balance, history, pendingMint, lastFetchedAt } = useAppSelector(s => s.credits);
const parcels = useAppSelector(s => s.land.parcels);
const dispatch = useAppDispatch();

useEffect(() => {
  if (walletAddress) dispatch(fetchCreditsThunk(walletAddress));
}, [walletAddress]);

// credit_earned.json trigger
const prevPendingMint = useRef(pendingMint);
const prevBalance = useRef(balance);
const [showCelebration, setShowCelebration] = useState(false);

useEffect(() => {
  if (prevPendingMint.current && !pendingMint && balance > prevBalance.current) {
    setShowCelebration(true);
  }
  prevPendingMint.current = pendingMint;
}, [pendingMint, balance]);

// History preview — last 2 entries desc
const previewHistory = useMemo(
  () => [...history].sort((a, b) => b.audit_year - a.audit_year).slice(0, 2),
  [history],
);

// Offline badge
const isStale = !lastFetchedAt; // or check connectivity separately
```

**Land status badge derivation**: see `getLandStatus` utility in `data-model.md` §2.  
**"View Certificate"**: `Linking.openURL(record.ipfs_certificate_url)` — hide button if URL is falsy.  
**"View on PolygonScan"**: `Linking.openURL('https://polygonscan.com/address/' + walletAddress)`.  
**"Start Audit" navigation**: `navigation.navigate('AuditStartScreen', { landId: parcel.id, landName: parcel.farm_name })`.  

---

## Step 4: Design CreditHistoryScreen with Stitch MCP

**MANDATORY — do not skip.**

Call `generate_screen_from_text` with a prompt describing:
- Header bar with back arrow
- Bar chart (react-native-chart-kit) showing year-over-year CTT growth
- Scrollable list of audit entries: land name, year, "+X.X CTT" in Roboto Mono, "View Certificate" button, truncated tx hash (0x{first6}…{last4})
- Lottie spinning_leaf.json shown while loading
- "Last updated [time]" stale badge if offline

Then call `get_screen` → fetch HTML/CSS → convert to NativeWind.

---

## Step 5: Implement CreditHistoryScreen

Key wiring points:

```ts
// Bar chart data
const chartData = useMemo(() => {
  const byYear = history.reduce<Record<number, number>>((acc, r) => {
    acc[r.audit_year] = (acc[r.audit_year] ?? 0) + r.credits_issued;
    return acc;
  }, {});
  const years = Object.keys(byYear).sort();
  return {
    labels: years,
    datasets: [{ data: years.map(y => byYear[Number(y)]) }],
  };
}, [history]);

// Chart config (react-native-chart-kit)
const chartConfig = {
  backgroundColor: '#1a3a2a',
  backgroundGradientFrom: '#1a3a2a',
  backgroundGradientTo: '#1a3a2a',
  decimalPlaces: 1,
  color: (opacity = 1) => `rgba(74, 222, 128, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
  style: { borderRadius: 12 },
  propsForLabels: { fontFamily: 'RobotoMono-Regular' },
};

// History list sorted desc
const sortedHistory = useMemo(
  () => [...history].sort((a, b) => b.audit_year - a.audit_year),
  [history],
);

// Transaction hash truncation
const truncateHash = (hash: string) =>
  `${hash.slice(0, 8)}…${hash.slice(-4)}`;

// External links
const openCertificate = (url: string) => Linking.openURL(url);
const openPolygonScan = (hash: string) =>
  Linking.openURL(`https://polygonscan.com/tx/${hash}`);
```

---

## Step 6: Verify Constitution Compliance

Before marking any task done, check:

- [ ] No `StyleSheet.create` — NativeWind only
- [ ] Stitch design was generated and applied before coding
- [ ] CTT balance renders in Roboto Mono font
- [ ] All buttons/links have `minHeight: 48` and `minWidth: 48` touch targets
- [ ] `credit_earned.json`, `spinning_leaf.json` file names unchanged
- [ ] IPFS URL opened via `Linking.openURL` — no WebView
- [ ] `blockchain.ts` is called; Supabase is NOT used as the balance source
- [ ] `lastFetchedAt` stored in MMKV via redux-persist (no blacklist on credits slice)

---

## Testing Checklist

```
□ fetchCreditsThunk dispatches setHistory, setBalance, setLastFetchedAt
□ fetchCreditsThunk falls back to balance_ctt on blockchain RPC failure
□ fetchCreditsThunk sets pendingMint = false when it was true
□ HomeScreen shows "Minting in progress…" when pendingMint = true
□ credit_earned.json plays exactly once when pendingMint true → false + balance increases
□ credit_earned.json does NOT play on cold launch with existing balance
□ "View Certificate" hidden when ipfs_certificate_url is null/empty
□ tx hash hidden when tx_hash is null/empty
□ "View on PolygonScan" opens correct address URL in browser
□ Bar chart renders with single bar when only one audit year in history
□ Bar chart renders correctly with 5+ years of data
□ getLandStatus returns 'green' for current-year audit, 'red' for 2+ year gap
□ HomeScreen preview shows exactly 2 most recent entries
□ "Last updated [time]" badge visible when lastFetchedAt is non-null and fetch fails
□ Balance, history, lastFetchedAt all survive app kill + relaunch (MMKV persist)
```
