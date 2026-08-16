export interface CheckInLogRow {
  user: string;
  cellId: string;
  timestamp: number;
  blockNumber: bigint;
  txHash: string;
}

export function EventLog({ rows }: { rows: CheckInLogRow[] }) {
  return (
    <div className="border border-neutral-800 rounded-lg overflow-hidden">
      <table className="w-full text-sm font-mono">
        <thead className="bg-neutral-900 text-neutral-500 text-xs uppercase">
          <tr>
            <th className="text-left px-4 py-2">User</th>
            <th className="text-left px-4 py-2">Cell</th>
            <th className="text-left px-4 py-2">Block</th>
            <th className="text-left px-4 py-2">Tx</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-center text-neutral-600">
                No check-ins yet
              </td>
            </tr>
          )}
          {rows.map((r, i) => (
            <tr
              key={r.txHash}
              className={`border-t border-neutral-900 ${
                i === 0 ? "animate-[fadeIn_0.4s_ease-out]" : ""
              }`}
            >
              <td className="px-4 py-2 text-neutral-300">
                {r.user.slice(0, 6)}...{r.user.slice(-4)}
              </td>
              <td className="px-4 py-2 text-sky-400">{r.cellId}</td>
              <td className="px-4 py-2 text-neutral-500">
                {r.blockNumber.toString()}
              </td>
              <td className="px-4 py-2 text-neutral-500">
                {r.txHash.slice(0, 8)}...
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}