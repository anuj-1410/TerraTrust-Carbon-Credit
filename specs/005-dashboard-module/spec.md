# Feature Specification: Dashboard Module

**Feature Branch**: `005-dashboard-module`  
**Created**: 2026-03-26  
**Status**: Draft  
**Input**: User description: "Dashboard module. Build HomeScreen and CreditHistoryScreen. creditsSlice. CTT balance read from Polygon blockchain via ethers.js services/blockchain.ts. Audit history from GET /api/v1/credits/balance response. Bar chart with react-native-chart-kit on CreditHistoryScreen. View Certificate opens IPFS URL in device browser, no in-app certificate screen. Frontend only."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Farmer Views CTT Balance on Home Screen (Priority: P1)

A farmer opens the app after completing an audit. The Home screen is the first screen they land on. They immediately see their total Carbon Ton Token balance displayed as a large plain number — no blockchain addresses or technical jargon — along with a human-readable explanation of what that number means. If they want on-chain proof, a small "View on PolygonScan" link is available.

**Why this priority**: This is the core value delivery screen for the farmer. Every audit they perform culminates in a number shown on this screen. Without this, the product has no visible output for the farmer. It is the first thing seen on every app launch after authentication.

**Independent Test**: Launch the app as an authenticated farmer with a known wallet address. The HomeScreen must display their CTT balance fetched from the blockchain. Offline fallback must show cached balance with a "Last updated" timestamp.

**Acceptance Scenarios**:

1. **Given** a farmer with a verified wallet address and prior audits, **When** they arrive at HomeScreen, **Then** their total CTT balance is shown as a large number (e.g., "47.3 CTT") with subtitle "Carbon Ton Tokens earned" and explanation "= 47.3 tonnes of CO2 stored on your land".
2. **Given** a farmer with CTT balance, **When** the screen loads, **Then** no wallet address, no blockchain hash, and no technical blockchain terminology is visible in the balance card.
3. **Given** a farmer taps "View on PolygonScan", **When** the link is tapped, **Then** the device browser opens the PolygonScan page for their wallet.
4. **Given** no internet connection, **When** HomeScreen loads, **Then** the last known balance from local cache is shown with a "Last updated [time]" badge.
5. **Given** an authenticated farmer with no audits yet, **When** HomeScreen loads, **Then** the balance shows "0 CTT" and the credit history preview is empty.

---

### User Story 2 - Farmer Views Land Parcel List and Audit Status (Priority: P2)

On the same HomeScreen, below the balance card, the farmer sees all their registered land parcels. Each parcel card shows a satellite thumbnail, farm name, area, and a colour-coded status badge that clearly communicates whether an audit is due. Orange and red cards display a "Start Audit" button so the farmer can act immediately.

**Why this priority**: The land list drives the audit initiation flow. Without status visibility, a farmer cannot determine which parcels need attention. This is the primary post-onboarding action surface of the app.

**Independent Test**: With two or more registered parcels in different audit states, render HomeScreen and verify each parcel displays the correct status colour and that "Start Audit" appears only on orange and red cards.

**Acceptance Scenarios**:

1. **Given** a farmer has registered land parcels, **When** HomeScreen loads, **Then** each parcel is displayed as a card with the GEE satellite thumbnail, farm name, area in hectares, and a status badge.
2. **Given** a parcel audited within the current year, **When** displayed on HomeScreen, **Then** the status badge is green ("✓ Verified").
3. **Given** a parcel verified but not audited this year, **When** displayed on HomeScreen, **Then** the status badge is orange ("⏳ Pending") and a "Start Audit" button is shown.
4. **Given** a parcel overdue for more than 3 months, **When** displayed on HomeScreen, **Then** the status badge is red ("◉ Overdue") and a "Start Audit" button is shown.
5. **Given** a farmer taps "Start Audit" on a parcel card, **When** the tap is registered, **Then** navigation proceeds to AuditStartScreen with that parcel pre-selected.

---

### User Story 3 - Farmer Views Credit History Preview on Home Screen (Priority: P3)

Below the land list on HomeScreen, the farmer sees a compact preview of their two most recent credit-earning audit entries. Each entry shows the year and credits earned, alongside a "View Certificate" button. A "View All History →" link navigates to the full history screen.

**Why this priority**: The preview gives the farmer a quick backward-looking summary of what they have earned, reinforcing trust and motivation. The "View Certificate" action is the direct path to proof of carbon sequestration.

**Independent Test**: With at least two completed audits, verify HomeScreen shows exactly the two most recent entries and that tapping "View All History →" navigates to CreditHistoryScreen.

**Acceptance Scenarios**:

1. **Given** a farmer with completed audits, **When** HomeScreen loads, **Then** the bottom section shows up to the 2 most recent audit entries each displaying: year, credits issued (e.g., "+12.4 CTT"), and a "View Certificate" button.
2. **Given** a farmer taps "View Certificate" on a history entry, **When** the button is tapped, **Then** the device browser opens the IPFS certificate URL for that audit. No in-app certificate screen is shown.
3. **Given** a farmer taps "View All History →", **When** tapped, **Then** CreditHistoryScreen opens showing the full audit history.
4. **Given** a farmer with only one completed audit, **When** HomeScreen loads, **Then** only one entry is shown in the preview (not a blank placeholder for the missing second entry).

---

### User Story 4 - Farmer Views Full Credit History with Bar Chart (Priority: P2)

CreditHistoryScreen shows the farmer their complete year-over-year carbon credit history across all land parcels. A bar chart visualises growth. Each entry lists the land name, year, credits issued, a "View Certificate" button (opens IPFS link in browser), and a truncated transaction hash that links to PolygonScan. When offline, cached data is shown with a staleness badge.

**Why this priority**: This screen is the primary evidence surface for the farmer when dealing with buyers, auditors, or government bodies. The chart communicates growth trend at a glance. Parity with P2 because it serves a distinct, high-value need.

**Independent Test**: With three or more completed audits across at least two distinct years, render CreditHistoryScreen and verify: bar chart renders with one bar per year, each history entry shows all required fields, and "View Certificate" opens the device browser.

**Acceptance Scenarios**:

1. **Given** a farmer navigates to CreditHistoryScreen, **When** the screen loads, **Then** a Lottie spinning_leaf.json animation plays while the API response is fetched.
2. **Given** the API returns a history array, **When** rendered, **Then** a bar chart is shown with one bar per unique audit year, height proportional to credits issued that year across all parcels.
3. **Given** one or more audit records, **When** rendered in the list, **Then** each entry shows: land name, audit year, credits issued with a "+" prefix, a "View Certificate" button, and a truncated transaction hash (format: 0x1234…abcd).
4. **Given** a farmer taps "View Certificate" on a history entry, **When** tapped, **Then** the IPFS certificate URL opens in the device browser. There is no in-app web view or certificate screen.
5. **Given** a farmer taps a transaction hash, **When** tapped, **Then** the PolygonScan URL for that transaction opens in the device browser.
6. **Given** no internet connection, **When** CreditHistoryScreen loads, **Then** the last cached history is shown with a "Last updated [time]" badge instead of the loading animation.
7. **Given** an authenticated farmer with no audit history, **When** CreditHistoryScreen loads, **Then** an empty state message is shown (e.g., "No audits yet. Complete your first audit to see your history.").

---

### Edge Cases

- What happens when the blockchain RPC call for CTT balance times out? The app MUST fall back to the `balance_ctt` value returned by `GET /api/v1/credits/balance` without retrying the chain call indefinitely.
- What happens when an IPFS certificate URL is missing or null for a history entry? The "View Certificate" button for that entry MUST be hidden, not shown as a broken link.
- What happens when a transaction hash is missing for a history entry? The truncated hash row MUST be hidden for that entry.
- What happens when the API returns an empty `history` array but a non-zero `balance_ctt`? HomeScreen shows the balance correctly; the credit history preview shows an empty state message rather than crashing.
- What happens when the farmer has more than 20 parcels? The HomeScreen land list MUST be vertically scrollable without performance degradation.
- What happens when the bar chart has only one data point (one year)? A single bar MUST render correctly without layout errors.
- What happens when `pendingMint` is `true` in the Redux state? HomeScreen MUST show a "Minting in progress…" indicator below the balance card until `pendingMint` returns to `false`.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: HomeScreen MUST display the farmer's total CTT balance as a large numerical value with the label "Carbon Ton Tokens earned" and the equivalent CO2 explanation line.
- **FR-002**: The balance value on HomeScreen MUST initially be read from `GET /api/v1/credits/balance` (`balance_ctt` field); the on-device blockchain read via `services/blockchain.ts` MAY be used to confirm or refresh the balance independently.
- **FR-003**: HomeScreen MUST display a "View on PolygonScan" small link that opens the farmer's Polygon wallet page in the device browser.
- **FR-004**: HomeScreen MUST display all registered land parcels from the Redux `land.parcels` state, each showing: satellite thumbnail (GEE PNG cached), farm name, area in hectares, and a status badge.
- **FR-005**: Land parcel status colours MUST follow: green = verified and audited this year; orange = verified but audit due; red = overdue by more than 3 months.
- **FR-006**: "Start Audit" button MUST be shown only on orange and red parcel cards; tapping it MUST navigate to AuditStartScreen with the selected parcel.
- **FR-007**: HomeScreen MUST display a Credit History Preview section showing the 2 most recent audit entries from `credits.history` Redux state, each with: year, credits issued, and a "View Certificate" button.
- **FR-008**: "View Certificate" on any entry MUST open the `ipfs_certificate_url` for that audit in the device browser. There MUST be no in-app certificate screen or web view.
- **FR-009**: A "View All History →" link on HomeScreen MUST navigate to CreditHistoryScreen.
- **FR-010**: CreditHistoryScreen MUST display a bar chart showing total credits issued per year across all parcels. Each distinct year in the history array MUST produce exactly one bar.
- **FR-011**: CreditHistoryScreen MUST display the full `credits.history` list sorted by `audit_year` descending. Each entry MUST show: land name, audit year, credits issued (prefixed "+"), "View Certificate" button, and truncated transaction hash (first 6 + last 4 chars with "…" in between).
- **FR-012**: Tapping a transaction hash on CreditHistoryScreen MUST open the PolygonScan URL for that transaction in the device browser.
- **FR-013**: CreditHistoryScreen MUST show the Lottie `spinning_leaf.json` animation while the API call is in progress.
- **FR-014**: Both screens MUST show an offline cached state with a "Last updated [time]" badge when internet is unavailable. Cached data MUST come from Redux state persisted in MMKV.
- **FR-015**: `creditsSlice` MUST maintain the following Redux state shape: `{ balance: number, history: AuditRecord[], pendingMint: boolean }`.
- **FR-016**: `credits.balance` and `credits.history` MUST be persisted to MMKV via redux-persist so offline reads serve last known data without an API call.
- **FR-017**: `credits.balance` MUST be updated in Redux after every successful `GET /api/v1/credits/balance` response using `balance_ctt` from the response body.
- **FR-018**: When `credits.pendingMint` is `true`, HomeScreen MUST show a "Minting in progress…" indicator below the CTT balance card.
- **FR-019**: All numerical CTT values (balance, credits issued per entry, chart axis labels) MUST render in Roboto Mono font as specified in the design system.
- **FR-020**: All interactive elements (buttons, tappable hashes, links) MUST have a minimum touch target of 48×48 dp.
- **FR-021**: HomeScreen MUST be the landing screen for authenticated farmers with completed KYC, reached via the navigation flows: new user (after KYCScreen) and returning user (from SplashScreen when session is valid).

### Key Entities

- **AuditRecord**: Represents a single completed carbon audit. Key fields: `audit_year` (integer), `credits_issued` (float), `land_name` (string), `tx_hash` (string), `ipfs_certificate_url` (string), `minted_at` (ISO datetime string). Source: `history` array in `GET /api/v1/credits/balance` response.
- **CTT Balance**: The farmer's total Carbon Ton Token holding as a plain decimal number (e.g., 47.3). Source: `balance_ctt` from `GET /api/v1/credits/balance` response, confirmed independently via blockchain read in `services/blockchain.ts`.
- **LandParcel**: Registered land belonging to the farmer, already defined in `land.parcels` Redux state. Relevant fields for dashboard: `farm_name`, `area_hectares`, `is_verified`, audit status (derived from `credits.history` for last audit year vs current year). Displayed as cards on HomeScreen.
- **creditsSlice**: The Redux slice managing `{ balance: number, history: AuditRecord[], pendingMint: boolean }`. Persisted via MMKV.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A farmer can open the app after a completed audit and see their updated CTT balance on HomeScreen within 3 seconds of the screen mounting (on a standard 4G connection).
- **SC-002**: A farmer with no internet connection can open HomeScreen and see their last known CTT balance and land parcel list without any error state — only an offline badge.
- **SC-003**: 100% of "View Certificate" taps open the correct IPFS URL in the device browser with no in-app navigation or web view involvement.
- **SC-004**: A farmer with 10+ audit records across 3+ years can open CreditHistoryScreen and see a complete bar chart and full scrollable history list without any crash or rendering error.
- **SC-005**: The CTT balance displayed on HomeScreen is always a human-readable decimal number; no wallet addresses, transaction hashes, or blockchain identifiers are shown in the balance card area.
- **SC-006**: CreditHistoryScreen renders its Lottie loading animation while data is being fetched, and transitions to the history list within 5 seconds on a standard connection.
- **SC-007**: All numerical CTT values are visually distinct from surrounding text (Roboto Mono font, as per the design system) on both screens.

## Assumptions

- The `GET /api/v1/credits/balance` endpoint returns both `balance_ctt` (the authoritative on-chain balance computed by the backend) and the full `history` array in a single response. The app does not need to call a separate audit history endpoint for the dashboard.
- The blockchain read via `services/blockchain.ts` (ethers.js `contract.balanceOf`) is used on HomeScreen as an independent on-chain confirmation, not as the primary balance source. If the RPC call fails or times out, `balance_ctt` from the API response is used without surfacing a blockchain error to the farmer.
- Land parcel audit status (green/orange/red) is derived client-side by comparing the latest `audit_year` in `credits.history` for that parcel against the current calendar year. A parcel with no history entry is treated as "audit due" (orange).
- "Overdue by more than 3 months" means the most recent audit for a parcel was conducted more than 15 months ago (prior year plus 3 months into the current year).
- The satellite thumbnail images (GEE Sentinel-2 PNGs) displayed on land parcel cards are fetched once and cached locally — they are already available in the `land.parcels` state from the Land Verification module (Feature 003). The Dashboard module does not re-fetch them.
- `ipfs_certificate_url` values in the history are complete URLs in the format `https://ipfs.io/ipfs/[CID]` provided by the backend. The app opens them via `Linking.openURL()` without any URL construction or transformation.
- The bar chart aggregates `credits_issued` by `audit_year` across all `AuditRecord` entries regardless of land parcel (total per year, not per parcel).
- `pendingMint: true` is set by the Audit module (Feature 004) after audit submission and cleared when the backend confirms minting. The Dashboard module reads this flag from Redux but does not set it.

## Dependencies

- **Feature 001 (RN Project Foundation)**: Redux store, MMKV persistence layer, navigation stack, and Axios instance must be in place.
- **Feature 002 (Auth & KYC)**: `auth.walletAddress` in Redux is required for the blockchain balance read and the PolygonScan link. HomeScreen is the post-auth landing destination.
- **Feature 003 (Land Verification)**: `land.parcels` in Redux must be populated to render the land list. Satellite thumbnail URLs must already be cached per parcel.
- **`services/blockchain.ts`**: Must expose a function accepting a wallet address and returning the CTT token balance as a number from the Polygon contract.
- **`GET /api/v1/credits/balance`**: Backend endpoint must be deployed and return `{ balance_ctt: number, history: AuditRecord[] }` per the BSDD response schema.
