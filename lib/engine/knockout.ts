// Knockout tournament simulator: plays the whole bracket many times and
// turns win counts into probabilities. Completed results and what-if pins
// are treated as fixed outcomes, so the simulation always starts from the
// current live state of the bracket.

import { simulateMatch } from "./match";
import { createRng } from "./rng";
import {
  BracketMatch,
  Competition,
  EloRatings,
  MatchStats,
  SimulationOptions,
  SimulationOutput,
  Slot,
  TeamStats,
} from "./types";

const DEFAULT_RUNS = 10000;
const DEFAULT_SEED = 1;

interface FlatMatch {
  round: string;
  match: BracketMatch;
}

/** Winner (and penalties flag) for matches fixed by results or pins. */
type FixedOutcomes = Map<string, { winner: string; penalties: boolean }>;

export function simulateKnockout(
  competition: Competition,
  ratings: EloRatings,
  options: SimulationOptions = {},
): SimulationOutput {
  const runs = options.runs ?? DEFAULT_RUNS;
  const seed = options.seed ?? DEFAULT_SEED;
  const flat = validateBracket(competition, ratings);
  const fixed = collectFixedOutcomes(competition, flat, options);

  // Counters, filled over all runs.
  const appearCount = new Map<string, Map<string, number>>();
  const winCount = new Map<string, Map<string, number>>();
  const penaltyCount = new Map<string, number>();
  const championCount = new Map<string, number>();
  for (const { match } of flat) {
    appearCount.set(match.id, new Map());
    winCount.set(match.id, new Map());
    penaltyCount.set(match.id, 0);
  }

  const rng = createRng(seed);
  const finalMatchId = flat[flat.length - 1].match.id;

  for (let run = 0; run < runs; run++) {
    const winners = new Map<string, string>();
    for (const { match } of flat) {
      const home = resolveSlot(match.home, winners);
      const away = resolveSlot(match.away, winners);
      bump(appearCount.get(match.id)!, home);
      bump(appearCount.get(match.id)!, away);

      const fixedOutcome = fixed.get(match.id);
      let winner: string;
      if (fixedOutcome && (fixedOutcome.winner === home || fixedOutcome.winner === away)) {
        winner = fixedOutcome.winner;
        if (fixedOutcome.penalties) {
          penaltyCount.set(match.id, penaltyCount.get(match.id)! + 1);
        }
      } else {
        const sim = simulateMatch(rng, ratings[home], ratings[away], {
          homeAdvantage: competition.homeAdvantage,
          knockout: true,
        });
        winner = sim.winner === "home" ? home : away;
        if (sim.penalties) {
          penaltyCount.set(match.id, penaltyCount.get(match.id)! + 1);
        }
      }
      bump(winCount.get(match.id)!, winner);
      winners.set(match.id, winner);
    }
    bump(championCount, winners.get(finalMatchId)!);
  }

  return buildOutput(competition, flat, fixed, runs, seed, {
    appearCount,
    winCount,
    penaltyCount,
    championCount,
  });
}

function bump(counter: Map<string, number>, key: string): void {
  counter.set(key, (counter.get(key) ?? 0) + 1);
}

function resolveSlot(slot: Slot, winners: Map<string, string>): string {
  if ("team" in slot) return slot.team;
  const winner = winners.get(slot.winnerOf);
  if (!winner) throw new Error(`Match "${slot.winnerOf}" has no winner yet`);
  return winner;
}

/** Check the config and ratings are usable, and return matches in play order. */
function validateBracket(competition: Competition, ratings: EloRatings): FlatMatch[] {
  if (competition.format !== "knockout") {
    throw new Error(`simulateKnockout needs format "knockout", got "${competition.format}"`);
  }
  if (!competition.bracket || competition.bracket.rounds.length === 0) {
    throw new Error("Knockout competition needs a bracket with at least one round");
  }
  for (const team of competition.teams) {
    if (typeof ratings[team] !== "number") {
      throw new Error(`No Elo rating for team "${team}"`);
    }
  }

  const flat: FlatMatch[] = [];
  const seenIds = new Set<string>();
  for (const round of competition.bracket.rounds) {
    for (const match of round.matches) {
      if (seenIds.has(match.id)) throw new Error(`Duplicate match id "${match.id}"`);
      for (const slot of [match.home, match.away]) {
        if ("team" in slot) {
          if (!competition.teams.includes(slot.team)) {
            throw new Error(`Match "${match.id}" uses unknown team "${slot.team}"`);
          }
        } else if (!seenIds.has(slot.winnerOf)) {
          throw new Error(`Match "${match.id}" references "${slot.winnerOf}" which is not an earlier match`);
        }
      }
      seenIds.add(match.id);
      flat.push({ round: round.name, match });
    }
  }

  const lastRound = competition.bracket.rounds[competition.bracket.rounds.length - 1];
  if (lastRound.matches.length !== 1) {
    throw new Error("The last round must be a single final match");
  }
  return flat;
}

/** Merge completed results and what-if pins into one fixed-outcome map. */
function collectFixedOutcomes(
  competition: Competition,
  flat: FlatMatch[],
  options: SimulationOptions,
): FixedOutcomes {
  const knownIds = new Set(flat.map((f) => f.match.id));
  const fixed: FixedOutcomes = new Map();
  const entries = [
    ...(options.results ?? []).map((r) => ({ matchId: r.matchId, winner: r.winner, penalties: r.penalties })),
    ...(options.pinned ?? []).map((p) => ({ matchId: p.matchId, winner: p.winner, penalties: false })),
  ];
  for (const entry of entries) {
    if (!knownIds.has(entry.matchId)) {
      throw new Error(`Result refers to unknown match "${entry.matchId}"`);
    }
    if (!competition.teams.includes(entry.winner)) {
      throw new Error(`Result for "${entry.matchId}" names unknown team "${entry.winner}"`);
    }
    fixed.set(entry.matchId, { winner: entry.winner, penalties: entry.penalties });
  }
  return fixed;
}

interface Counters {
  appearCount: Map<string, Map<string, number>>;
  winCount: Map<string, Map<string, number>>;
  penaltyCount: Map<string, number>;
  championCount: Map<string, number>;
}

function buildOutput(
  competition: Competition,
  flat: FlatMatch[],
  fixed: FixedOutcomes,
  runs: number,
  seed: number,
  counters: Counters,
): SimulationOutput {
  const matches: Record<string, MatchStats> = {};
  for (const { round, match } of flat) {
    matches[match.id] = {
      round,
      appeared: toProbabilities(counters.appearCount.get(match.id)!, runs),
      winner: toProbabilities(counters.winCount.get(match.id)!, runs),
      penalties: counters.penaltyCount.get(match.id)! / runs,
      fixed: fixed.has(match.id),
    };
  }

  const teams: Record<string, TeamStats> = {};
  const roundNames = competition.bracket!.rounds.map((r) => r.name);
  for (const team of competition.teams) {
    const reachedRound: Record<string, number> = {};
    for (const name of roundNames) reachedRound[name] = 0;
    const winsMatch: Record<string, number> = {};
    for (const { round, match } of flat) {
      const stats = matches[match.id];
      reachedRound[round] += stats.appeared[team] ?? 0;
      if (stats.winner[team]) winsMatch[match.id] = stats.winner[team];
    }
    teams[team] = {
      reachedRound,
      winsMatch,
      champion: (counters.championCount.get(team) ?? 0) / runs,
    };
  }

  return { runs, seed, roundNames, matches, teams };
}

function toProbabilities(counter: Map<string, number>, runs: number): Record<string, number> {
  const probabilities: Record<string, number> = {};
  for (const [key, count] of counter) probabilities[key] = count / runs;
  return probabilities;
}
