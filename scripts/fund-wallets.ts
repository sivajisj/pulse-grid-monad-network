import {
  createWalletClient,
  createPublicClient,
  http,
  parseEther,
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

const AMOUNT_PER_WALLET = process.env.AMOUNT_PER_WALLET || "0.05"; // MON

async function main() {
  const funderKey = process.env.FUNDER_PRIVATE_KEY as `0x${string}`;
  if (!funderKey) throw new Error("Set FUNDER_PRIVATE_KEY in .env");

  const wallets = JSON.parse(fs.readFileSync("bot-wallets.json", "utf-8")) as {
    address: `0x${string}`;
    privateKey: string;
  }[];

  const account = privateKeyToAccount(funderKey);

  const publicClient = createPublicClient({
    chain: monadTestnet,
    transport: http(),
  });

  const walletClient = createWalletClient({
    account,
    chain: monadTestnet,
    transport: http(),
  });

  const balance = await publicClient.getBalance({ address: account.address });
  const needed = parseEther(AMOUNT_PER_WALLET) * BigInt(wallets.length);
  console.log(`Funder balance: ${balance} wei`);
  console.log(`Need at least: ${needed} wei for ${wallets.length} wallets`);
  if (balance < needed) {
    console.warn("WARNING: balance may not cover funding + gas. Proceeding anyway.");
  }

  let nonce = await publicClient.getTransactionCount({ address: account.address });
  const hashes: string[] = [];

  for (const w of wallets) {
    const hash = await walletClient.sendTransaction({
      to: w.address,
      value: parseEther(AMOUNT_PER_WALLET),
      nonce: nonce++,
    });
    hashes.push(hash);
    console.log(`Sent ${AMOUNT_PER_WALLET} MON -> ${w.address} (${hash})`);
  }

  console.log(`\nAll ${hashes.length} funding txs submitted. Waiting for confirmations...`);

  const results = await Promise.allSettled(
    hashes.map((h) =>
      publicClient.waitForTransactionReceipt({ hash: h as `0x${string}` })
    )
  );

  const confirmed = results.filter((r) => r.status === "fulfilled").length;
  console.log(`\nConfirmed: ${confirmed}/${hashes.length}`);

  const failed = results
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => r.status === "rejected");
  if (failed.length) {
    console.log("Failed:", failed.map(({ i }) => wallets[i].address));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});