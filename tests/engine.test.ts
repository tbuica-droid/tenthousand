import { describe, expect, it } from "vitest";
import {
  Competition,
  EloRatings,
  HOME_ADVANTAGE_XG,
  createRng,
  expectedGoals,
  simulateCompetition,
  simulateMatch,
} from "../lib/engine";
import worldCupJson from "../data/competitions/world-cup-2026.json";
import teamsJson from "../data/teams.json";

const worldCup = worldCupJson as Competition;
const ratings = teamsJson as EloRatings;

/** Fraction of knockout matches the home team wins over `n` simulated matches. */
function knockoutWinRate(eloHome: number, eloAway: number, n: number, seed = 7): number {
  const rng = createRng(seed);
  let wins = 0;
  for (let i = 0; i < n; i++) {
    const sim = simulateMatch(rng, eloHome, eloAway, { homeAdvantage: false, knockout: true });
    if (sim.winner === "home") wins += 1;
  }
  return wins / n;
}

describe("probabilities are coherent", () => {
  const output = simulateCompetition(worldCup, ratings, { seed: 42 });

  it("each match's outcome probabilities sum to ~1", () => {
    for (const [matchId, match] of Object.entries(output.matches)) {
      const sum = Object.values(match.winner).reduce((a, b) => a + b, 0);
      expect(Math.abs(sum - 1), `match ${matchId}`).toBeLessThan(0.001);
    }
  });

  it("tournament title probabilities across all teams sum to ~1", () => {
    const sum = Object.values(output.teams).reduce((a, t) => a + t.champion, 0);
    expect(Math.abs(sum - 1)).toBeLessThan(0.001);
  });

  it("runs the requested 10,000 tournaments by default", () => {
    expect(output.runs).toBe(10000);
  });
});

describe("elo drives outcomes", () => {
  it("the higher-Elo team wins more often, monotonically in the gap", () => {
    const n = 50000;
    const gaps = [0, 100, 200, 300, 400];
    const rates = gaps.map((gap) => knockoutWinRate(2000 + gap, 2000, n));
    expect(Math.abs(rates[0] - 0.5)).toBeLessThan(0.02); // equal Elo -> coin flip
    for (let i = 1; i < rates.length; i++) {
      expect(rates[i], `gap ${gaps[i]} vs ${gaps[i - 1]}`).toBeGreaterThan(rates[i - 1]);
      expect(rates[i], `gap ${gaps[i]} beats 50%`).toBeGreaterThan(0.5);
    }
  });

  it("a 200 Elo gap gives a knockout win probability between 65% and 70%", () => {
    const rate = knockoutWinRate(2100, 1900, 150000);
    expect(rate).toBeGreaterThan(0.65);
    expect(rate).toBeLessThan(0.7);
  });
});

describe("home advantage", () => {
  it("homeAdvantage: false has zero effect on expected goals", () => {
    const off = expectedGoals(2100, 1900, false);
    const flipped = expectedGoals(1900, 2100, false);
    expect(off.home).toBeCloseTo(flipped.away, 12); // perfectly symmetric
    expect(off.away).toBeCloseTo(flipped.home, 12);
  });

  it("homeAdvantage: true adds exactly +0.25 xG to the home team only", () => {
    const off = expectedGoals(2100, 1900, false);
    const on = expectedGoals(2100, 1900, true);
    expect(on.home).toBeCloseTo(off.home + HOME_ADVANTAGE_XG, 12);
    expect(on.away).toBeCloseTo(off.away, 12);
  });

  it("with homeAdvantage off, equal-Elo home and away win equally often", () => {
    const rng = createRng(11);
    let homeWins = 0;
    const n = 100000;
    for (let i = 0; i < n; i++) {
      const sim = simulateMatch(rng, 2000, 2000, { homeAdvantage: false, knockout: true });
      if (sim.winner === "home") homeWins += 1;
    }
    expect(Math.abs(homeWins / n - 0.5)).toBeLessThan(0.01);
  });
});

describe("fixed results and pins", () => {
  it("pinning a match forces that outcome in 100% of runs", () => {
    const output = simulateCompetition(worldCup, ratings, {
      seed: 42,
      pinned: [{ matchId: "QF1", winner: "Morocco" }],
    });
    expect(output.matches.QF1.winner.Morocco).toBe(1);
    expect(output.matches.QF1.winner.France ?? 0).toBe(0);
    expect(output.teams.France.reachedRound.Semifinals).toBe(0);
    expect(output.teams.Morocco.reachedRound.Semifinals).toBe(1);
  });

  it("completed results in results.json format are fixed the same way", () => {
    const output = simulateCompetition(worldCup, ratings, {
      seed: 42,
      results: [{ matchId: "QF2", homeGoals: 2, awayGoals: 2, winner: "Belgium", penalties: true }],
    });
    expect(output.matches.QF2.winner.Belgium).toBe(1);
    expect(output.matches.QF2.penalties).toBe(1);
    expect(output.matches.QF2.fixed).toBe(true);
    expect(output.teams.Spain.champion).toBe(0);
  });
});

describe("reproducibility", () => {
  it("the same seed gives identical output", () => {
    const a = simulateCompetition(worldCup, ratings, { seed: 123, runs: 2000 });
    const b = simulateCompetition(worldCup, ratings, { seed: 123, runs: 2000 });
    expect(a).toEqual(b);
  });

  it("different seeds give different output", () => {
    const a = simulateCompetition(worldCup, ratings, { seed: 1, runs: 2000 });
    const b = simulateCompetition(worldCup, ratings, { seed: 2, runs: 2000 });
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });
});
