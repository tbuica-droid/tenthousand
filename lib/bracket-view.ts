// Thin UI helpers on top of the engine. No simulation math lives here —
// this only answers "which team is in which bracket slot right now" given
// completed results and the user's what-if pins.

import { Competition, MatchResult, Slot } from "./engine";

/** matchId -> known winner, combining completed results and what-if pins. */
export type KnownWinners = Record<string, string>;

export function knownWinners(results: MatchResult[], pins: Record<string, string>): KnownWinners {
  const winners: KnownWinners = {};
  for (const result of results) winners[result.matchId] = result.winner;
  for (const [matchId, team] of Object.entries(pins)) winners[matchId] = team;
  return winners;
}

/** The team in a slot, or null if it depends on a match that has no known winner. */
export function slotTeam(slot: Slot, winners: KnownWinners): string | null {
  if ("team" in slot) return slot.team;
  return winners[slot.winnerOf] ?? null;
}

/** Short label for an unresolved slot, e.g. "Winner of QF1". */
export function slotLabel(slot: Slot): string {
  return "team" in slot ? slot.team : `Winner of ${slot.winnerOf}`;
}

/**
 * Drop pins that no longer make sense: if un-pinning QF1 means the pinned
 * semifinal winner is no longer in that semifinal, the semifinal pin goes too.
 */
export function prunePins(
  competition: Competition,
  results: MatchResult[],
  pins: Record<string, string>,
): Record<string, string> {
  const matchById = new Map(
    (competition.bracket?.rounds ?? []).flatMap((round) => round.matches.map((m) => [m.id, m] as const)),
  );
  const next = { ...pins };
  let changed = true;
  while (changed) {
    changed = false;
    const winners = knownWinners(results, next);
    for (const [matchId, team] of Object.entries(next)) {
      const match = matchById.get(matchId);
      const home = match ? slotTeam(match.home, winners) : null;
      const away = match ? slotTeam(match.away, winners) : null;
      if (team !== home && team !== away) {
        delete next[matchId];
        changed = true;
      }
    }
  }
  return next;
}

/** Teams still alive in the tournament (nobody is eliminated until results exist). */
export function remainingTeams(competition: Competition, results: MatchResult[]): string[] {
  const matchById = new Map(
    (competition.bracket?.rounds ?? []).flatMap((round) => round.matches.map((m) => [m.id, m] as const)),
  );
  const winners = knownWinners(results, {});
  const eliminated = new Set<string>();
  for (const result of results) {
    const match = matchById.get(result.matchId);
    if (!match) continue;
    for (const slot of [match.home, match.away]) {
      const team = slotTeam(slot, winners);
      if (team && team !== result.winner) eliminated.add(team);
    }
  }
  return competition.teams.filter((team) => !eliminated.has(team));
}
