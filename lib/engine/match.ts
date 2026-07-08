// Single-match model, exactly as locked in CLAUDE.md:
// Elo -> win expectancy -> expected goals -> independent Poisson goals,
// level knockout matches resolved by a 55/45 penalty shootout model.

import { Rng, samplePoisson } from "./rng";

/** Shared baseline: about 2.6 total goals per match, split between the teams. */
export const TOTAL_BASELINE_GOALS = 2.6;

/** Extra expected goals for the home team when the competition has homeAdvantage: true. */
export const HOME_ADVANTAGE_XG = 0.25;

/** The higher-Elo team wins a penalty shootout with this probability. */
export const PENALTY_HIGHER_ELO_WIN_PROB = 0.55;

/**
 * The single calibration constant: how sharply the goal split follows Elo.
 * Solved numerically (and verified by simulation in the tests) so that a
 * 200 Elo gap gives the stronger team a ~67.5% knockout win probability
 * after draws are resolved by the penalty model.
 */
export const CALIBRATION = 0.4866;

/** Standard Elo win expectancy: p = 1 / (1 + 10^(-diff/400)). */
export function winExpectancy(eloDiff: number): number {
  return 1 / (1 + Math.pow(10, -eloDiff / 400));
}

export interface ExpectedGoals {
  home: number;
  away: number;
}

export function expectedGoals(
  eloHome: number,
  eloAway: number,
  homeAdvantage: boolean,
): ExpectedGoals {
  const p = winExpectancy(eloHome - eloAway);
  const strong = Math.pow(p, CALIBRATION);
  const weak = Math.pow(1 - p, CALIBRATION);
  const homeShare = strong / (strong + weak);
  return {
    home: TOTAL_BASELINE_GOALS * homeShare + (homeAdvantage ? HOME_ADVANTAGE_XG : 0),
    away: TOTAL_BASELINE_GOALS * (1 - homeShare),
  };
}

export interface SimulatedMatch {
  homeGoals: number;
  awayGoals: number;
  /** "draw" can only happen in league matches; knockout always has a winner. */
  winner: "home" | "away" | "draw";
  /** True if a level knockout match was decided by the penalty shootout model. */
  penalties: boolean;
}

export function simulateMatch(
  rng: Rng,
  eloHome: number,
  eloAway: number,
  opts: { homeAdvantage: boolean; knockout: boolean },
): SimulatedMatch {
  const xg = expectedGoals(eloHome, eloAway, opts.homeAdvantage);
  const homeGoals = samplePoisson(rng, xg.home);
  const awayGoals = samplePoisson(rng, xg.away);

  if (homeGoals > awayGoals) {
    return { homeGoals, awayGoals, winner: "home", penalties: false };
  }
  if (awayGoals > homeGoals) {
    return { homeGoals, awayGoals, winner: "away", penalties: false };
  }
  if (!opts.knockout) {
    return { homeGoals, awayGoals, winner: "draw", penalties: false };
  }

  // Level knockout match: penalty shootout, 55/45 to the higher-Elo team.
  let pHomeWinsShootout = 0.5;
  if (eloHome > eloAway) pHomeWinsShootout = PENALTY_HIGHER_ELO_WIN_PROB;
  if (eloHome < eloAway) pHomeWinsShootout = 1 - PENALTY_HIGHER_ELO_WIN_PROB;
  const winner = rng() < pHomeWinsShootout ? "home" : "away";
  return { homeGoals, awayGoals, winner, penalties: true };
}
