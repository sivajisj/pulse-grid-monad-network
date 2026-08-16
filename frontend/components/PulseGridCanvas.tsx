const GRID_COLS = 10;

// Sequential scale, one hue (sky), light->dark by activity bucket. Reuses the
// app's existing single accent color rather than introducing a new palette.
const ACTIVITY_STEPS = [
  "bg-neutral-900", // 0 check-ins
  "bg-sky-950",
  "bg-sky-900",
  "bg-sky-700",
  "bg-sky-500",
  "bg-sky-400", // highest bucket
];

function activityColor(count: number): string {
  if (count <= 0) return ACTIVITY_STEPS[0];
  const bucket = Math.min(Math.floor(Math.log2(count + 1)) + 1, ACTIVITY_STEPS.length - 1);
  return ACTIVITY_STEPS[bucket];
}

export function PulseGridCanvas({
  activity,
  selectedCellId,
  pendingCellId,
  flashCellId,
  onSelect,
  disabled,
}: {
  activity: number[];
  selectedCellId: number | null;
  pendingCellId: number | null;
  flashCellId: number | null;
  onSelect: (cellId: number) => void;
  disabled: boolean;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm uppercase tracking-wide text-neutral-500">
          Pick a cell to check in
        </h2>
        <div className="flex items-center gap-1.5 text-xs text-neutral-600">
          <span>Less</span>
          {ACTIVITY_STEPS.map((cls, i) => (
            <span key={i} className={`inline-block w-3 h-3 rounded-sm ${cls}`} />
          ))}
          <span>More</span>
        </div>
      </div>
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))` }}
      >
        {activity.map((count, cellId) => {
          const isSelected = selectedCellId === cellId;
          const isPending = pendingCellId === cellId;
          const isFlashing = flashCellId === cellId;
          return (
            <button
              key={cellId}
              type="button"
              title={`Cell ${cellId} — ${count} check-in${count === 1 ? "" : "s"}`}
              disabled={disabled || pendingCellId !== null}
              onClick={() => onSelect(cellId)}
              className={`aspect-square rounded-sm transition-all duration-200 ${activityColor(
                count
              )} ${
                isSelected ? "ring-2 ring-sky-400" : ""
              } ${
                isFlashing
                  ? "scale-110 shadow-[0_0_8px_2px_rgba(56,189,248,0.7)]"
                  : ""
              } ${
                isPending ? "animate-pulse" : ""
              } disabled:cursor-not-allowed enabled:hover:ring-1 enabled:hover:ring-sky-500`}
            />
          );
        })}
      </div>
    </div>
  );
}
