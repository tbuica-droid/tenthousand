// Generates one AI insight card per upcoming World Cup match and writes them
// all to data/insights.json. The file is overwritten fully on success; if any
// API call fails, the previous file is left untouched and we exit with an error.
// Usage: npm run insights   (needs ANTHROPIC_API_KEY, loaded from .env.local locally)

import Anthropic from "@anthropic-ai/sdk";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Competition, EloRatings, MatchResult, simulateCompetition } from "../lib/engine";
import { knownWinners, slotTeam } from "../lib/bracket-view";
import { InsightCard } from "../lib/insights";

const MODEL = "claude-sonnet-4-6"; // locked in CLAUDE.md

// Structured-output schema: the API guarantees the response matches this.
const CARD_SCHEMA = {
  type: "object",
  properties: {
    headline: { type: "string", description: "Punchy one-line headline" },
    body: { type: "string", description: "2-3 sentences, numbers included in the text" },
  },
  required: ["headline", "body"],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT =
  "You write insight cards for TenThousand, a free football probability site. " +
  "Its Monte Carlo model simulates every tournament 10,000 times. " +
  "Your angle is always 'model vs. conventional wisdom': what the simulation sees " +
  "that casual fans might not, like an underdog with a surprisingly good title path. " +
  "Every claim must be backed by the numbers provided, and the numbers must appear " +
  "explicitly in the text. Tone: sharp and neutral. Never use betting language — " +
  "no odds, stakes, picks, value, or gambling references.";

function loadEnvLocal(): void {
  if (process.env.ANTHROPIC_API_KEY) return;
  const envPath = join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}

function loadJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(join(process.cwd(), relativePath), "utf8")) as T;
}

const pct = (p: number) => `${(p * 100).toFixed(1)}%`;

async function main(): Promise<void> {
  loadEnvLocal();
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Error: ANTHROPIC_API_KEY is not set. Add it to .env.local or the environment.");
    process.exit(1);
  }

  const competition = loadJson<Competition>("data/competitions/world-cup-2026.json");
  const ratings = loadJson<EloRatings>("data/teams.json");
  const results = loadJson<MatchResult[]>("data/results.json");

  // Previous title chances (per team) from the last insights run, for shift lines.
  let previousTitle: Record<string, number> = {};
  try {
    const previous = loadJson<InsightCard[]>("data/insights.json");
    for (const card of previous) {
      for (const [team, p] of Object.entries(card.titleChances ?? {})) previousTitle[team] = p;
    }
  } catch {
    previousTitle = {};
  }

  const output = simulateCompetition(competition, ratings, { results });
  const semifinalRound = output.roundNames[output.roundNames.length - 2];
  const finalRound = output.roundNames[output.roundNames.length - 1];

  // Upcoming = not yet played, and both participants already known.
  const played = new Set(results.map((r) => r.matchId));
  const winners = knownWinners(results, {});
  const upcoming: { matchId: string; round: string; home: string; away: string }[] = [];
  for (const round of competition.bracket?.rounds ?? []) {
    for (const match of round.matches) {
      if (played.has(match.id)) continue;
      const home = slotTeam(match.home, winners);
      const away = slotTeam(match.away, winners);
      if (home && away) upcoming.push({ matchId: match.id, round: round.name, home, away });
    }
  }
  if (upcoming.length === 0) {
    console.log("No upcoming matches with known teams — nothing to generate.");
    return;
  }
  console.log(`Generating ${upcoming.length} insight cards with ${MODEL}...`);

  const client = new Anthropic();
  const cards: InsightCard[] = [];

  for (const match of upcoming) {
    const lines: string[] = [
      `Match ${match.matchId} (${match.round}), World Cup 2026 knockout: ${match.home} vs ${match.away}.`,
      "",
      "Model data from 10,000 tournament simulations:",
    ];
    for (const team of [match.home, match.away]) {
      const stats = output.teams[team];
      lines.push(
        `- ${team}: Elo ${ratings[team]}, wins this match ${pct(output.matches[match.matchId].winner[team] ?? 0)}, ` +
          `reaches semifinal ${pct(stats.reachedRound[semifinalRound] ?? 0)}, ` +
          `reaches final ${pct(stats.reachedRound[finalRound] ?? 0)}, ` +
          `wins the title ${pct(stats.champion)}`,
      );
      const prev = previousTitle[team];
      if (prev !== undefined && Math.abs(prev - stats.champion) >= 0.0005) {
        lines.push(
          `  (title chance moved from ${pct(prev)} to ${pct(stats.champion)} since the previous update)`,
        );
      }
    }
    lines.push(
      "",
      "Write one insight card for this match: a punchy one-line headline, then a body of " +
        "2-3 sentences with a model-vs-conventional-wisdom angle. Include the key numbers " +
        "explicitly in the text.",
    );

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      output_config: { format: { type: "json_schema", schema: CARD_SCHEMA } },
      messages: [{ role: "user", content: lines.join("\n") }],
    });

    const text = response.content.find((block) => block.type === "text")?.text;
    if (!text) {
      throw new Error(`Empty response for ${match.matchId} (stop_reason: ${response.stop_reason})`);
    }
    const card = JSON.parse(text) as { headline: string; body: string };
    cards.push({
      matchId: match.matchId,
      headline: card.headline,
      body: card.body,
      probabilities: {
        [match.home]: output.matches[match.matchId].winner[match.home] ?? 0,
        [match.away]: output.matches[match.matchId].winner[match.away] ?? 0,
      },
      titleChances: {
        [match.home]: output.teams[match.home].champion,
        [match.away]: output.teams[match.away].champion,
      },
      generatedAt: new Date().toISOString(),
    });
    console.log(`  ${match.matchId}: ${card.headline}`);
  }

  // All calls succeeded — only now overwrite the file.
  writeFileSync(
    join(process.cwd(), "data/insights.json"),
    JSON.stringify(cards, null, 2) + "\n",
  );
  console.log(`Wrote ${cards.length} cards to data/insights.json`);
}

main().catch((error) => {
  console.error("Insight generation failed — data/insights.json was left untouched.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
