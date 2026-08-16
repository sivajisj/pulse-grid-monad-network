"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  createPublicClient,
  createWalletClient,
  http,
  formatEther,
} from "viem";
import { monadTestnet } from "@/lib/chain";
import { CONTRACT_ADDRESS, PULSEGRID_ABI } from "@/lib/contract";
import { getOrCreateBurnerAccount } from "@/lib/burner";
import { StatCard } from "@/components/StatCard";
import { EventLog, CheckInLogRow } from "@/components/EventLog";

const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: http(),
});

export default function Dashboard() {
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<string>("0");
  const [rows, setRows] = useState<CheckInLogRow[]>([]);
  const [totalCheckIns, setTotalCheckIns] = useState(0);
  const [uniqueCells, setUniqueCells] = useState(0);
  const [lastLatencyMs, setLastLatencyMs] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [pulse, setPulse] = useState(false);
  const [ready, setReady] = useState(false);

  const pulseTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Set up burner wallet once, client-side only
  useEffect(() => {
    const account = getOrCreateBurnerAccount();
    if (account) setAddress(account.address);
  }, []);

  // Poll burner balance
  useEffect(() => {
    if (!address) return;
    const poll = async () => {
      try {
        const bal = await publicClient.getBalance({
          address: address as `0x${string}`,
        });
        setBalance(formatEther(bal));
        setReady(true);
      } catch (e) {
        console.warn("Balance poll failed, will retry:", e);
        // Keep showing the last known balance instead of crashing the page.
        // Still mark ready so the dashboard isn't stuck on the loading screen.
        setReady(true);
      }
    };
    poll();
    const id = setInterval(poll, 15000);
    return () => clearInterval(id);
  }, [address]);

  // Live event subscription
  useEffect(() => {
    const unwatch = publicClient.watchEvent({
      address: CONTRACT_ADDRESS,
      event: PULSEGRID_ABI[4], // CheckInExecuted
      onLogs: (logs) => {
        setRows((prev) => {
          const next = [
            ...logs.map((log: any) => ({
              user: log.args.user as string,
              cellId: (log.args.cellId as bigint).toString(),
              timestamp: Number(log.args.timestamp),
              blockNumber: log.blockNumber as bigint,
              txHash: log.transactionHash as string,
            })),
            ...prev,
          ];
          return next.slice(0, 50);
        });
        setTotalCheckIns((c) => c + logs.length);

        setPulse(true);
        if (pulseTimeout.current) clearTimeout(pulseTimeout.current);
        pulseTimeout.current = setTimeout(() => setPulse(false), 300);
      },
    });
    return () => unwatch();
  }, []);

  useEffect(() => {
    setUniqueCells(new Set(rows.map((r) => r.cellId)).size);
  }, [rows]);

  const doCheckIn = useCallback(async () => {
    const account = getOrCreateBurnerAccount();
    if (!account) return;
    setPending(true);
    const start = performance.now();
    try {
      const walletClient = createWalletClient({
        account,
        chain: monadTestnet,
        transport: http(),
      });
      const cellId = BigInt(Math.floor(Math.random() * 1000));
      const hash = await walletClient.writeContract({
        address: CONTRACT_ADDRESS,
        abi: PULSEGRID_ABI,
        functionName: "executeCheckIn",
        args: [cellId],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      setLastLatencyMs(Math.round(performance.now() - start));
    } catch (e) {
      console.error(e);
      alert("Check-in failed. Check console — likely cooldown or low balance.");
    } finally {
      setPending(false);
    }
  }, []);

  const resetStats = useCallback(() => {
    setRows([]);
    setTotalCheckIns(0);
    setUniqueCells(0);
    setLastLatencyMs(null);
  }, []);

  if (!ready) {
    return (
      <main className="min-h-screen bg-black text-neutral-100 flex items-center justify-center">
        <div className="flex items-center gap-3 text-neutral-500 text-sm font-mono">
          <span className="inline-block w-3 h-3 rounded-full border-2 border-neutral-700 border-t-sky-400 animate-spin" />
          Connecting to Monad Testnet...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-neutral-100 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold text-sky-400">PulseGrid</h1>
              <span
                className={`inline-block w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                  pulse
                    ? "bg-sky-400 scale-125 shadow-[0_0_8px_2px_rgba(56,189,248,0.7)]"
                    : "bg-neutral-700"
                }`}
              />
            </div>
            <p className="text-neutral-500 text-sm mt-1">
              Live check-ins on Monad Testnet
            </p>
            <p className="text-neutral-600 text-xs mt-1">
              Live demo — check-ins are being driven in real time during the presentation.
            </p>
          </div>
          <button
            onClick={resetStats}
            className="text-xs text-neutral-500 hover:text-neutral-300 border border-neutral-800 rounded-md px-3 py-1.5"
          >
            Reset stats
          </button>
        </div>

        <div className="border border-neutral-800 rounded-lg p-4 bg-neutral-950 flex items-center justify-between">
          <div className="font-mono text-sm">
            <div className="text-neutral-500">Your burner wallet</div>
            <div className="text-neutral-300">{address ?? "generating..."}</div>
            <div className="text-neutral-500 mt-1">
              Balance: <span className="text-neutral-300">{balance} MON</span>
            </div>
          </div>
          <button
            onClick={doCheckIn}
            disabled={pending}
            className="bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-black font-medium px-5 py-2.5 rounded-md"
          >
            {pending ? "Checking in..." : "Check In"}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <StatCard label="Total Check-Ins" value={totalCheckIns} />
          <StatCard label="Unique Cells Touched" value={uniqueCells} />
          <StatCard
            label="Last Confirmation"
            value={lastLatencyMs ?? "—"}
            unit={lastLatencyMs ? "ms" : undefined}
          />
        </div>

        <div>
          <h2 className="text-sm uppercase tracking-wide text-neutral-500 mb-2">
            Live Event Log
          </h2>
          <EventLog rows={rows} />
        </div>

        <footer className="border-t border-neutral-900 pt-4 flex items-center justify-between text-xs font-mono text-neutral-600">
          <span>
            Contract:{" "}
            <a
              href={`https://testnet.monadexplorer.com/address/${CONTRACT_ADDRESS}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-500 hover:text-sky-400 underline underline-offset-2"
            >
              {CONTRACT_ADDRESS.slice(0, 10)}...{CONTRACT_ADDRESS.slice(-6)}
            </a>
          </span>
          <span>Monad Testnet · Chain ID 10143</span>
        </footer>
      </div>
    </main>
  );
}