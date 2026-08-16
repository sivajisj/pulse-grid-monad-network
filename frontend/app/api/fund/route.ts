import { NextRequest, NextResponse } from "next/server";
import {
  createWalletClient,
  createPublicClient,
  http,
  parseEther,
  isAddress,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { monadTestnet } from "@/lib/chain";

export const runtime = "nodejs";

const FUND_AMOUNT = "0.02"; // MON per wallet
const RATE_LIMIT_WINDOW_MS = 60_000;

// In-memory records. Reset on cold start / redeploy — acceptable for a
// hackathon demo funder with a small, deliberately limited balance.
const fundedAddresses = new Set<string>();
const lastRequestByIp = new Map<string, number>();

function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

export async function POST(req: NextRequest) {
  const funderKey = process.env.FUNDER_PRIVATE_KEY as `0x${string}` | undefined;
  if (!funderKey) {
    return NextResponse.json(
      { error: "Funder not configured" },
      { status: 500 }
    );
  }

  let body: { address?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const address = body.address;
  if (!address || !isAddress(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  const ip = getClientIp(req);
  const lastRequest = lastRequestByIp.get(ip);
  if (lastRequest && Date.now() - lastRequest < RATE_LIMIT_WINDOW_MS) {
    return NextResponse.json(
      { error: "Too many requests, try again shortly" },
      { status: 429 }
    );
  }
  lastRequestByIp.set(ip, Date.now());

  const normalized = address.toLowerCase();
  if (fundedAddresses.has(normalized)) {
    return NextResponse.json(
      { error: "Address already funded" },
      { status: 409 }
    );
  }

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

  try {
    // On-chain check backs up the in-memory record across cold starts.
    const existingBalance = await publicClient.getBalance({
      address: address as `0x${string}`,
    });
    if (existingBalance > BigInt(0)) {
      fundedAddresses.add(normalized);
      return NextResponse.json(
        { error: "Address already has a balance" },
        { status: 409 }
      );
    }

    const hash = await walletClient.sendTransaction({
      to: address as `0x${string}`,
      value: parseEther(FUND_AMOUNT),
    });

    fundedAddresses.add(normalized);

    await publicClient.waitForTransactionReceipt({ hash });

    return NextResponse.json({ hash, amount: FUND_AMOUNT });
  } catch (e) {
    console.error("Funding failed:", e);
    fundedAddresses.delete(normalized);
    return NextResponse.json({ error: "Funding transaction failed" }, { status: 500 });
  }
}
