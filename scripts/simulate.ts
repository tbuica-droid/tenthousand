// Runs 10,000 World Cup tournaments and prints the probability table.
// Usage: npm run simulate

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Competition, EloRatings, MatchResult, simulateCompetition } from "../lib/engine";

function loadJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(join(process.cwd(), relativePath), "utf8")) as T;
}

const competition = loadJson<Competition>("data/competitions/world-cup-2026.json");
const ratings = loadJson<EloRatings>("data/teams.json");
const results = loadJson<MatchResult[]>("data/results.json");

const output = simulateCompetition(competition, ratings, { results });

const semifinalRound = output.roundNames[output.roundNames.length - 2];
const finalRound = output.roundNames[output.roundNames.length - 1];

// A team's next match: the first not-yet-fixed match it can still appear in.
function nextMatch(team: string): { id: string; winProb: number } | null {
  for (const [matchId, match] of Object.entries(output.matches)) {
    if (!match.fixed && (match.appeared[team] ?? 0) > 0) {
      return { id: matchId, winProb: match.winner[team] ?? 0 };
    }
  }
  return null;
}

const pct = (p: number) => `${(p * 100).toFixed(1)}%`;
const rows = competition.teams
  .map((team) => {
    const stats = output.teams[team];
    const next = nextMatch(team);
    return {
      team,
      next: next ? next.id : "—",
      winNext: next ? next.winProb : 0,
      semifinal: stats.reachedRound[semifinalRound] ?? 0,
      final: stats.reachedRound[finalRound] ?? 0,
      champion: stats.champion,
    };
  })
  .sort((a, b) => b.champion - a.champion);

const header = ["Team", "Next", "Win next", "Semifinal", "Final", "Champion"];
const table = rows.map((r) => [
  r.team,
  r.next,
  pct(r.winNext),
  pct(r.semifinal),
  pct(r.final),
  pct(r.champion),
]);
const championTotal = rows.reduce((a, r) => a + r.champion, 0);
table.push(["TOTAL", "", "", "", "", pct(championTotal)]);

const widths = header.map((h, col) => Math.max(h.length, ...table.map((row) => row[col].length)));
const line = (cells: string[]) =>
  cells.map((cell, col) => (col === 0 ? cell.padEnd(widths[col]) : cell.padStart(widths[col]))).join("  ");

console.log(`\n${competition.name} — ${output.runs.toLocaleString("en-US")} simulated tournaments\n`);
console.log(line(header));
console.log(widths.map((w) => "-".repeat(w)).join("  "));
for (const row of table) console.log(line(row));
console.log("");
