"use client";

// Client-side what-if state. The default (no pins) numbers were computed at
// build time and shipped statically; the engine only re-runs in the browser
// when the user pins a result. 10,000 runs take a few milliseconds, so taps
// feel instant without a worker.

import { useMemo, useState } from "react";
import {
  Competition,
  EloRatings,
  MatchResult,
  SimulationOutput,
  simulateCompetition,
} from "@/lib/engine";
import { knownWinners, prunePins, remainingTeams } from "@/lib/bracket-view";
import { Bracket } from "./bracket";
import { TitleChances, TitleRow } from "./title-chances";

interface WhatIfProps {
  competition: Competition;
  ratings: EloRatings;
  results: MatchResult[];
  initialOutput: SimulationOutput;
}

export function WhatIf({ competition, ratings, results, initialOutput }: WhatIfProps) {
  const [pins, setPins] = useState<Record<string, string>>({});
  const pinsActive = Object.keys(pins).length > 0;

  const output = useMemo(() => {
    if (!pinsActive) return initialOutput;
    const pinned = Object.entries(pins).map(([matchId, winner]) => ({ matchId, winner }));
    return simulateCompetition(competition, ratings, { results, pinned });
  }, [pins, pinsActive, competition, ratings, results, initialOutput]);

  function togglePin(matchId: string, team: string) {
    setPins((prev) => {
      const next = { ...prev };
      if (next[matchId] === team) {
        delete next[matchId];
      } else {
        next[matchId] = team;
      }
      return prunePins(competition, results, next);
    });
  }

  const titleRows: TitleRow[] = remainingTeams(competition, results)
    .map((team) => ({
      team,
      chance: output.teams[team]?.champion ?? 0,
      baseline: initialOutput.teams[team]?.champion ?? 0,
    }))
    .sort((a, b) => b.chance - a.chance);

  const resultsById: Record<string, MatchResult> = {};
  for (const result of results) resultsById[result.matchId] = result;
  const winners = knownWinners(results, pins);

  return (
    <div className="flex flex-col gap-10">
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-zinc-500">
          Who wins the World Cup?
        </h2>
        <TitleChances rows={titleRows} pinsActive={pinsActive} />
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">
            Bracket
          </h2>
          {pinsActive && (
            <button
              type="button"
              onClick={() => setPins({})}
              className="rounded-full border border-zinc-700 px-3 py-1 text-xs font-medium text-zinc-300 transition-colors active:bg-zinc-900 sm:hover:bg-zinc-900"
            >
              Reset picks
            </button>
          )}
        </div>
        <p className="mb-4 text-xs text-zinc-500">
          Tap a team to pin it as the winner — every number re-simulates instantly.
        </p>
        <Bracket
          competition={competition}
          output={output}
          resultsById={resultsById}
          winners={winners}
          pins={pins}
          onToggle={togglePin}
        />
      </section>
    </div>
  );
}
