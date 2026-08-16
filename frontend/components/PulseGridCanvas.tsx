import { useMemo } from "react";

const GRID_COLS = 10;

// Sequential scale, one hue (sky), light->dark. Reuses the app's existing
// single accent color rather than introducing a new palette. Index 0 is
// reserved for "never touched"; indices 1-5 cover the observed nonzero range.
const ACTIVITY_STEPS = [
  "bg-neutral-900", // untouched
  "bg-sky-950",
  "bg-sky-900",
  "bg-sky-700",
  "bg-sky-500",
  "bg-sky-400", // busiest cell(s) currently on the grid
];

// Builds a color function scaled to the grid's *current* min/max, so cells
// stay visually distinguishable regardless of how much overall activity has
// accumulated (a fixed/log scale saturates once every cell has real traffic).
function useActivityColor(activity: number[]) {
  return useMemo(() => {
    const nonZero = activity.filter((c) => c > 0);
    const min = nonZero.length ? Math.min(...nonZero) : 0;
    const max = nonZero.length ? Math.max(...nonZero) : 0;
    const buckets = ACTIVITY_STEPS.length - 1; // 5 nonzero buckets

    return (count: number) => {
      if (count <= 0) return ACTIVITY_STEPS[0];
      if (max === min) return ACTIVITY_STEPS[ACTIVITY_STEPS.length - 1];
      const t = (count - min) / (max - min); // 0..1 within observed range
      const bucket = 1 + Math.min(buckets - 1, Math.floor(t * buckets));
      return ACTIVITY_STEPS[bucket];
    };
  }, [activity]);
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
  const colorFor = useActivityColor(activity);
  const maxCount = useMemo(
    () => activity.reduce((m, c) => Math.max(m, c), 0),
    [activity]
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm uppercase tracking-wide text-neutral-500">
          Pick a cell to check in
        </h2>
        <div className="flex items-center gap-1.5 text-xs text-neutral-600 font-mono">
          <span>0</span>
          {ACTIVITY_STEPS.map((cls, i) => (
            <span key={i} className={`inline-block w-3 h-3 rounded-sm ${cls}`} />
          ))}
          <span>{maxCount}</span>
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
              disabled={disabled || pendingCellId !== null}
              onClick={() => onSelect(cellId)}
              className={`group relative aspect-square rounded-sm transition-all duration-200 ${colorFor(
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
            >
              <div
                className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 z-10 hidden group-hover:block whitespace-nowrap rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1 text-[10px] font-mono text-neutral-200 shadow-lg"
                role="tooltip"
              >
                Cell {cellId} · {count} check-in{count === 1 ? "" : "s"}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
