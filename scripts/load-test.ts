import {
  createWalletClient,
  createPublicClient,
  http,
  encodeFunctionData,
  defineChain,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import fs from "fs";

import "dotenv/config";

const RPC_URL = process.env.MONAD_RPC_URL || "https://testnet-rpc.monad.xyz";

const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
});

const CONTRACT_ADDRESS = "0x481D3c0C2F173Ed5BD31cf27986884d8b304905A" as const;

const ABI = [
  {
    type: "function",
    name: "executeCheckIn",
    inputs: [{ name: "cellId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: http(),
});

interface TxResult {
  address: string;
  cellId: number;
  submitMs: number;
  confirmMs: number | null;
  latencyMs: number | null;
  status: "confirmed" | "failed";
  error?: string;
}

const CONCURRENCY = Number(process.env.LOAD_CONCURRENCY || 20);
const RETRIES = 2;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function sendOne(
  w: { address: `0x${string}`; privateKey: `0x${string}` },
  cellId: number,
  batchStart: number
): Promise<TxResult> {
  const account = privateKeyToAccount(w.privateKey);
  const walletClient = createWalletClient({
    account,
    chain: monadTestnet,
    transport: http(),
  });

  const submitMs = performance.now() - batchStart;
  let lastError: any;

  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    try {
      const hash = await walletClient.writeContract({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: "executeCheckIn",
        args: [BigInt(cellId)],
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const confirmMs = performance.now() - batchStart;

      return {
        address: w.address,
        cellId,
        submitMs: Math.round(submitMs),
        confirmMs: Math.round(confirmMs),
        latencyMs: Math.round(confirmMs - submitMs),
        status: receipt.status === "success" ? "confirmed" : "failed",
      };
    } catch (e: any) {
      lastError = e;
      if (attempt < RETRIES) await sleep(500 * (attempt + 1)); // backoff
    }
  }

  return {
    address: w.address,
    cellId,
    submitMs: Math.round(submitMs),
    confirmMs: null,
    latencyMs: null,
    status: "failed",
    error: lastError?.shortMessage || lastError?.message || String(lastError),
  };
}

async function fireBatch(mode: "distinct" | "contended") {
  const allWallets = JSON.parse(fs.readFileSync("bot-wallets.json", "utf-8")) as {
    address: `0x${string}`;
    privateKey: `0x${string}`;
  }[];

  const walletCount = Number(process.env.WALLET_COUNT || allWallets.length);
  const wallets = allWallets.slice(0, walletCount);

  console.log(
    `\n=== Mode: ${mode.toUpperCase()} | ${wallets.length} wallets | concurrency ${CONCURRENCY} ===\n`
  );

  const batchStart = performance.now();
  const results: TxResult[] = [];

  // True concurrency-limited pool: at most CONCURRENCY sends in flight at
  // any moment. As soon as one finishes, the next starts. This spreads load
  // evenly over the whole run instead of bursting everyone at once.
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < wallets.length) {
      const i = nextIndex++;
      const cellId = mode === "distinct" ? i : 9999;
      const result = await sendOne(wallets[i], cellId, batchStart);
      results.push(result);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, wallets.length) }, worker)
  );

  const totalMs = performance.now() - batchStart;
  const confirmed = results.filter((r) => r.status === "confirmed");
  const failed = results.filter((r) => r.status === "failed");
  const avgLatency =
    confirmed.reduce((sum, r) => sum + (r.latencyMs || 0), 0) /
    (confirmed.length || 1);

  console.log(`Total wall-clock time: ${Math.round(totalMs)}ms`);
  console.log(`Confirmed: ${confirmed.length}/${wallets.length}`);
  console.log(`Failed: ${failed.length}/${wallets.length}`);
  console.log(`Avg confirmation latency: ${Math.round(avgLatency)}ms`);

  if (failed.length) {
    console.log(`\nSample failures:`);
    failed.slice(0, 5).forEach((f) => console.log(`  ${f.address}: ${f.error}`));
  }

  fs.writeFileSync(
    `load-results-${mode}.json`,
    JSON.stringify(
      { mode, totalMs: Math.round(totalMs), confirmedCount: confirmed.length, failedCount: failed.length, avgLatency: Math.round(avgLatency), results },
      null,
      2
    )
  );
  console.log(`\nFull results saved to load-results-${mode}.json`);

  return { totalMs, confirmed: confirmed.length, failed: failed.length, avgLatency };
}

async function main() {
  const mode = (process.argv[2] as "distinct" | "contended") || "distinct";
  if (mode !== "distinct" && mode !== "contended") {
    console.error(`Usage: tsx load-test.ts [distinct|contended]`);
    process.exit(1);
  }
  await fireBatch(mode);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});