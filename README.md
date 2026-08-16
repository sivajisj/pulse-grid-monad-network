# PulseGrid — Step 1: Contract + Tests

## Setup (run locally, where forge is installed)

```bash
# from an empty folder
forge init pulsegrid --no-commit
cd pulsegrid
forge install foundry-rs/forge-std --no-commit
```

Then copy in the 3 files from this step:
- `src/PulseGridEngine.sol`
- `test/PulseGridEngine.t.sol`
- `script/Deploy.s.sol`
- replace the generated `foundry.toml` with the one provided here
- copy `.env.example` to `.env` and fill in your deployer private key

## Build & test

```bash
forge build
forge test -vvv
```

Expected: all 11 tests pass (check-in, cooldown, tips, batch read, withdraw,
access control, fuzz).

## What changed vs. the original draft

- Added `onlyOwner` + `withdraw()` — tips no longer get stuck in the contract.
- Added a 30s per-user check-in cooldown (`CHECKIN_COOLDOWN`) so one wallet
  can't spam `activeCheckIns` — still lets 500 *different* wallets hit it in
  the same block for the stress-test demo.
- Custom errors instead of `require` strings — cheaper gas, same effect.
- `receive()` added so the contract can accept direct MON transfers too.

## Progress: 1/5

Contract is written, tested, and ready to deploy. Nothing has touched the
Monad network yet — that's step 2.