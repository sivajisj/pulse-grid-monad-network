export function StatCard({
  label,
  value,
  unit,
}: {
  label: string;
  value: string | number;
  unit?: string;
}) {
  return (
    <div className="border border-neutral-800 rounded-lg p-4 bg-neutral-950">
      <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">
        {label}
      </div>
      <div className="font-mono text-2xl text-neutral-100">
        {value}
        {unit && <span className="text-sm text-neutral-500 ml-1">{unit}</span>}
      </div>
    </div>
  );
}
