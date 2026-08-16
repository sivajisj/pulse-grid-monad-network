# PulseGrid

An onchain check-in and micro-engagement engine, built on **Monad Testnet** at **Monad Blitz Bangalore V5** (Aug 16, 2026).

**Live demo:** https://pulsegrid-beige.vercel.app
**Contract:** [`0x481D3c0C2F173Ed5BD31cf27986884d8b304905A`](https://testnet.monadexplorer.com/address/0x481D3c0C2F173Ed5BD31cf27986884d8b304905A) — Monad Testnet, Chain ID `10143`

---

## The problem

High-density real-world events, concerts, conferences, stadiums, involve thousands of people interacting with something at nearly the same moment. Most EVM chains process transactions sequentially, so simultaneous load causes queueing, gas spikes, and failed transactions.

## The approach

PulseGrid's contract writes each check-in to two independent storage slots: `gridCells[cellId]` and `userStates[msg.sender]`. Because different users writing to different cells don't touch the same storage, these transactions are exactly the kind of workload Monad's parallel execution engine can schedule concurrently rather than serialize.

## What's actually proven, not just claimed

We measured this rather than asserting it:

| Metric | Result |
|---|---|
| Wallets used | 150 independent, real signed transactions |
| Confirmed | 150/150 (0 failures) on our cleanest run |
| Avg confirmation latency | ~3.1s – 5.5s across multiple clean runs |
| Total wall-clock for 150 txs | ~50–90s depending on concurrency setting |

Full raw per-transaction data: [`scripts/load-results-distinct.json`](scripts/load-results-distinct.json) and [`scripts/load-results-contended.json`](scripts/load-results-contended.json).

**Honest limitation:** at this test scale (150 wallets), targeting the same cell vs. 150 different cells did not show a measurable latency difference. We're reporting that plainly rather than overclaiming a contrast our data doesn't support.

---

## Architecture

```
┌─────────────────┐      writeContract       ┌───────────────────────┐
│  Browser burner  │ ───────────────────────► │  PulseGridEngine.sol  │
│  wallet (viem)   │                           │  (Monad Testnet)      │
└─────────────────┘                           └───────────┬────────────┘
                                                            │ emits
                                                            ▼
┌─────────────────┐      watchEvent          ┌───────────────────────┐
│  Live dashboard  │ ◄─────────────────────── │  CheckInExecuted      │
│  (Next.js)       │                           │  MicroTipSent         │
└─────────────────┘                           └───────────────────────┘
```

---

## Repo structure

```
src/PulseGridEngine.sol      Solidity contract
test/                        Foundry test suite (11 tests)
script/Deploy.s.sol          Foundry deploy script
foundry.toml                 Foundry config, Monad RPC alias

frontend/                    Next.js live dashboard
  app/page.tsx                main dashboard page
  lib/chain.ts                Monad chain definition
  lib/contract.ts             deployed contract address + ABI
  lib/burner.ts                browser burner wallet logic
  components/                  StatCard, EventLog

scripts/                     Node/viem tooling (not deployed, run locally)
  generate-wallets.ts          creates N fresh keypairs → bot-wallets.json
  fund-wallets.ts               funds those wallets from a funder key
  load-test.ts                  fires concurrent check-ins, measures latency
```

---

## Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation) (`forge`, `cast`)
- Node.js 18+ and npm
- A wallet with Monad Testnet MON — get some from the [Monad faucet](https://testnet.monad.xyz) (rate-limited, ~0.01 MON/day)
- (Recommended) A free [Alchemy](https://www.alchemy.com/) account with a Monad Testnet app, the public RPC is rate-limited and will bottleneck anything beyond light usage

---

## Setup

### 1. Clone and install contract dependencies

```bash
git clone <this-repo-url>
cd pulsegrid
forge install
```

### 2. Environment variables

This project uses **three separate `.env` files**, one per component. None are committed (see `.gitignore`); you create them locally.

**Root `.env`** (for Foundry — deploy scripts, `cast` commands):
```bash
cat > .env << 'EOF'
PRIVATE_KEY=0xyour_deployer_private_key
MONAD_RPC_URL=https://your-alchemy-monad-testnet-url
EOF
```

**`scripts/.env`** (for wallet funding + load testing):
```bash
cat > scripts/.env << 'EOF'
FUNDER_PRIVATE_KEY=0xyour_funder_private_key
AMOUNT_PER_WALLET=0.05
MONAD_RPC_URL=https://your-alchemy-monad-testnet-url
EOF
```

**`frontend/.env.local`** (for the Next.js dashboard — must use the `NEXT_PUBLIC_` prefix or the browser can't read it):
```bash
cat > frontend/.env.local << 'EOF'
NEXT_PUBLIC_MONAD_RPC_URL=https://your-alchemy-monad-testnet-url
EOF
```

All three fall back to the public Monad RPC if left unset, so the project still runs without Alchemy, just with lower throughput and a higher chance of rate-limit errors under load.

### 3. Run the contract tests

```bash
forge test -vvv
```

Expected: **11 passing** (check-in, cooldown boundary, tips, batch reads, withdraw, access control, fuzz test on cell IDs).

### 4. (Optional) Deploy your own instance

The contract above is already deployed and live. To deploy your own copy instead:

```bash
source .env
forge script script/Deploy.s.sol:DeployScript --rpc-url monad_testnet --broadcast
```

Copy the resulting address into `frontend/lib/contract.ts` and `scripts/load-test.ts` (`CONTRACT_ADDRESS` constant in both) if you want the frontend/load test to point at your new deployment instead of the one above.

### 5. Run the frontend locally

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`. A burner wallet is generated automatically in your browser (stored in `localStorage`, never sent anywhere). You'll need to send it a small amount of MON before "Check In" will work:

```bash
cast send <burner-address-shown-on-page> --value 0.05ether --rpc-url $MONAD_RPC_URL --private-key $PRIVATE_KEY
```

### 6. Run the load test tooling (optional, for reproducing our throughput numbers)

```bash
cd scripts
npm install

# generate N fresh wallets
npm run generate 150

# fund them all from your funder wallet (takes a few minutes)
npm run fund

# fire concurrent check-ins and measure results
WALLET_COUNT=150 LOAD_CONCURRENCY=20 npm run load distinct
LOAD_CONCURRENCY=20 npm run load contended    # all target the same cell instead
```

Results are printed to console and saved to `load-results-<mode>.json`.

---

## Troubleshooting

**`npm run fund` / `npm run load`: "Missing script"**
Your `package.json` in that folder doesn't match the one in this repo, or you're in the wrong directory. Run `cat package.json` and confirm the `scripts` block includes `generate`, `fund`, and `load`.

**`Signer had insufficient balance`**
The wallet calling the contract has 0 or too little MON. Fund it directly with `cast send <address> --value 0.05ether ...` as shown above.

**`Signer had insufficient balance` after a check-in that should have worked**
Check the 30-second per-wallet cooldown: `cast call <contract> "lastCheckInAt(address)(uint256)" <wallet> --rpc-url $MONAD_RPC_URL`, compare against `date +%s`.

**`HTTP request failed` during load testing**
You're hitting the public RPC's rate limit. Set up a free Alchemy Monad Testnet endpoint (see step 2) and/or lower `LOAD_CONCURRENCY`.

**Frontend shows the burner wallet balance as `0` and Check In fails**
Every new browser/incognito session generates a brand-new, unfunded burner wallet by design (see Known Limitations below). Fund the address shown on the page.

**`compute units per second` error from Alchemy**
Your load test's concurrency setting is exceeding your Alchemy plan's free-tier throughput. Lower `LOAD_CONCURRENCY` (try 15–20) and/or reduce `WALLET_COUNT`.

---

## Known limitations (stated honestly)

- The dashboard's burner wallet is per-browser and unfunded by default. Every new visitor needs a small manual top-up before their first check-in succeeds; there's no self-serve faucet flow built in yet.
- Contention testing (many wallets → one cell) did not show a measurable latency penalty vs. independent cells at our 150-wallet test scale.
- The public Monad Testnet RPC rate-limits aggressively under concurrent load; all clean throughput numbers above were captured using a dedicated Alchemy endpoint.

---

## Built at Monad Blitz Bangalore V5

August 16, 2026 · Chain ID `10143`