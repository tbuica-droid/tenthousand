// Shared types for the simulation engine.
// A competition is the locked config shape { teams, format, homeAdvantage }
// plus a bracket when the format is "knockout".

export type Format = "knockout" | "league";

/** A slot in a bracket match: either a named team or the winner of an earlier match. */
export type Slot = { team: string } | { winnerOf: string };

export interface BracketMatch {
  id: string;
  home: Slot;
  away: Slot;
}

export interface Round {
  name: string;
  matches: BracketMatch[];
}

export interface Bracket {
  rounds: Round[];
}

export interface Competition {
  id: string;
  name: string;
  format: Format;
  homeAdvantage: boolean;
  teams: string[];
  bracket?: Bracket;
}

/** Team name -> Elo rating, the shape of data/teams.json. */
export type EloRatings = Record<string, number>;

/** A completed match, the shape of entries in data/results.json. */
export interface MatchResult {
  matchId: string;
  homeGoals: number;
  awayGoals: number;
  winner: string;
  penalties: boolean;
}

/** A what-if pin: treat this match as already decided. */
export interface PinnedResult {
  matchId: string;
  winner: string;
}

export interface SimulationOptions {
  /** Number of tournament runs. Default 10000. */
  runs?: number;
  /** RNG seed for reproducibility. Default 1. */
  seed?: number;
  /** Completed matches (from data/results.json). Fixed in every run. */
  results?: MatchResult[];
  /** What-if pins. Fixed in every run, same mechanism as results. */
  pinned?: PinnedResult[];
}

export interface MatchStats {
  round: string;
  /** Probability that each team plays in this match. */
  appeared: Record<string, number>;
  /** Probability that each team wins this match (counts / runs). */
  winner: Record<string, number>;
  /** Probability that the match is decided on penalties. */
  penalties: number;
  /** True if the match outcome was fixed by a result or a pin. */
  fixed: boolean;
}

export interface TeamStats {
  /** Probability of appearing in each round, by round name. */
  reachedRound: Record<string, number>;
  /** Probability of winning each match, by match id. */
  winsMatch: Record<string, number>;
  /** Probability of winning the tournament. */
  champion: number;
}

export interface SimulationOutput {
  runs: number;
  seed: number;
  /** Round names in bracket order (last one is the final). */
  roundNames: string[];
  matches: Record<string, MatchStats>;
  teams: Record<string, TeamStats>;
}
