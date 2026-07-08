// Public entry point for the simulation engine. Pure TypeScript with zero
// dependencies on Next.js, the browser, or Node — the same code runs in both.

import { simulateKnockout } from "./knockout";
import { Competition, EloRatings, SimulationOptions, SimulationOutput } from "./types";

export function simulateCompetition(
  competition: Competition,
  ratings: EloRatings,
  options: SimulationOptions = {},
): SimulationOutput {
  if (competition.format === "knockout") {
    return simulateKnockout(competition, ratings, options);
  }
  // "league" (round-robin) arrives later as another branch here — the config
  // shape and output shape already support it, no rewrites needed.
  throw new Error(`Competition format "${competition.format}" is not implemented yet`);
}

export * from "./types";
export { simulateKnockout } from "./knockout";
export {
  CALIBRATION,
  HOME_ADVANTAGE_XG,
  PENALTY_HIGHER_ELO_WIN_PROB,
  TOTAL_BASELINE_GOALS,
  expectedGoals,
  simulateMatch,
  winExpectancy,
} from "./match";
export { createRng, samplePoisson } from "./rng";
export type { Rng } from "./rng";
export type { ExpectedGoals, SimulatedMatch } from "./match";
