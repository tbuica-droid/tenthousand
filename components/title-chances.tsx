// Ranked bar list: every remaining team's chance to win the tournament.
// Numbers are always printed next to the bars — that's the brand.

export interface TitleRow {
  team: string;
  chance: number;
  baseline: number;
}

export function TitleChances({ rows, pinsActive }: { rows: TitleRow[]; pinsActive: boolean }) {
  const maxChance = Math.max(...rows.map((r) => r.chance), 0.0001);
  return (
    <ol className="flex flex-col gap-2">
      {rows.map((row) => {
        const delta = row.chance - row.baseline;
        const showDelta = pinsActive && Math.abs(delta) >= 0.0005;
        return (
          <li key={row.team} className="relative overflow-hidden rounded-lg bg-zinc-900">
            <div
              className="absolute inset-y-0 left-0 bg-cyan-400/20"
              style={{ width: `${(row.chance / maxChance) * 100}%` }}
              aria-hidden
            />
            <div className="relative flex items-baseline justify-between gap-3 px-3 py-2">
              <span className="truncate text-sm font-medium">{row.team}</span>
              <span className="flex shrink-0 items-baseline gap-2 font-mono tabular-nums">
                {showDelta && (
                  <span className={`text-xs ${delta > 0 ? "text-cyan-300" : "text-zinc-500"}`}>
                    {delta > 0 ? "↑" : "↓"} from {(row.baseline * 100).toFixed(1)}%
                  </span>
                )}
                <span className="text-lg font-semibold">{(row.chance * 100).toFixed(1)}%</span>
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
