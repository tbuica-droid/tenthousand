// The knockout bracket. Rounds stack vertically on a phone and sit side by
// side on wider screens. Tapping a team in an upcoming match pins it as the
// winner; completed matches show the real score and are not tappable.

import {
  BracketMatch,
  Competition,
  MatchResult,
  SimulationOutput,
} from "@/lib/engine";
import { KnownWinners, slotLabel, slotTeam } from "@/lib/bracket-view";

interface BracketProps {
  competition: Competition;
  output: SimulationOutput;
  resultsById: Record<string, MatchResult>;
  winners: KnownWinners;
  pins: Record<string, string>;
  onToggle: (matchId: string, team: string) => void;
}

export function Bracket({ competition, output, resultsById, winners, pins, onToggle }: BracketProps) {
  const rounds = competition.bracket?.rounds ?? [];
  return (
    <div className="flex flex-col gap-8 sm:grid sm:grid-cols-3 sm:gap-4">
      {rounds.map((round) => (
        <section key={round.name} className="flex flex-col gap-3 sm:justify-around">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
            {round.name}
          </h3>
          {round.matches.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              output={output}
              result={resultsById[match.id]}
              winners={winners}
              pins={pins}
              onToggle={onToggle}
            />
          ))}
        </section>
      ))}
    </div>
  );
}

interface MatchCardProps {
  match: BracketMatch;
  output: SimulationOutput;
  result?: MatchResult;
  winners: KnownWinners;
  pins: Record<string, string>;
  onToggle: (matchId: string, team: string) => void;
}

function MatchCard({ match, output, result, winners, pins, onToggle }: MatchCardProps) {
  const completed = Boolean(result);
  return (
    <div
      className={
        completed
          ? "overflow-hidden rounded-xl bg-zinc-800"
          : "overflow-hidden rounded-xl border border-zinc-800"
      }
    >
      {([
        ["home", match.home] as const,
        ["away", match.away] as const,
      ]).map(([side, slot]) => {
        const team = slotTeam(slot, winners);
        const pinned = team !== null && pins[match.id] === team;
        const winProb = team ? output.matches[match.id]?.winner[team] ?? 0 : null;

        if (completed && result) {
          const goals = side === "home" ? result.homeGoals : result.awayGoals;
          const won = team === result.winner;
          return (
            <div
              key={side}
              className={`flex items-center justify-between px-3 py-2.5 ${won ? "" : "text-zinc-500"}`}
            >
              <span className={`text-sm ${won ? "font-semibold" : ""}`}>{team ?? slotLabel(slot)}</span>
              <span className="font-mono text-sm tabular-nums">
                {goals}
                {won && result.penalties ? <span className="ml-1 text-xs text-zinc-400">pens</span> : null}
              </span>
            </div>
          );
        }

        if (team === null) {
          return (
            <div key={side} className="flex items-center justify-between px-3 py-2.5 text-zinc-600">
              <span className="text-sm italic">{slotLabel(slot)}</span>
              <span className="font-mono text-sm">—</span>
            </div>
          );
        }

        return (
          <button
            key={side}
            type="button"
            aria-pressed={pinned}
            onClick={() => onToggle(match.id, team)}
            className={`flex w-full items-center justify-between px-3 py-2.5 text-left transition-colors ${
              pinned ? "bg-cyan-400/15 text-cyan-300" : "active:bg-zinc-900 sm:hover:bg-zinc-900"
            }`}
          >
            <span className={`text-sm ${pinned ? "font-semibold" : ""}`}>
              {team}
              {pinned && <span className="ml-2 text-xs uppercase tracking-wide">pinned</span>}
            </span>
            <span className="font-mono text-sm font-semibold tabular-nums">
              {Math.round((winProb ?? 0) * 100)}%
            </span>
          </button>
        );
      })}
    </div>
  );
}
