// Generates AI insight cards for all upcoming World Cup matches in ONE API call
// and writes them to data/insights.json. The file is overwritten fully on success;
// if the API call fails or the response is incomplete, the previous file is left
// untouched and we exit with an error.
// Usage: npm run insights   (needs ANTHROPIC_API_KEY, loaded from .env.local locally)

import Anthropic from "@anthropic-ai/sdk";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Competition, EloRatings, MatchResult, simulateCompetition } from "../lib/engine";
import { knownWinners, slotTeam } from "../lib/bracket-view";
import { InsightCard } from "../lib/insights";

const MODEL = "claude-sonnet-4-6"; // locked in CLAUDE.md

// One response containing every card. Structured output guarantees the shape.
const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    cards: {
      type: "array",
      items: {
        type: "object",
        properties: {
          matchId: { type: "string" },
          headline: { type: "string", description: "Punchy one-line headline" },
          body: { type: "string", description: "2-3 sentences, numbers quoted verbatim" },
        },
        required: ["matchId", "headline", "body"],
        additionalProperties: false,
      },
    },
  },
  required: ["cards"],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT = `You write insight cards for TenThousand, a free football probability site whose Monte Carlo model simulates every tournament 10,000 times.

HARD RULES — violating any of these makes the output unusable:
1. Every claim must trace to a number provided in the data, and that number must appear verbatim in the text. Quote numbers exactly as given; never re-round or estimate.
2. Never invent team traits, form, history, narrative qualities, or explanations that are not in the data. Words like "resilience", "experience", "momentum", "pedigree" are banned unless the data literally says so (it never does — the data is only Elo ratings and simulation probabilities).
3. For a quarterfinalist, "reaches the semifinal" IS the probability of winning this match — the exact same number. Never present them as two separate facts and never call the semifinal-reach number surprising by itself.
4. No betting language: no odds, stakes, picks, value, bets, or gambling references. Tone is sharp and neutral.
5. Variety is mandatory across the set: each card takes a DIFFERENT angle from the menu, and no two headlines may share the same grammatical template. If one headline is "X is strong, but Y...", no other headline may use that construction.
6. Superlatives and cross-match comparisons ("biggest", "closest", "most", "highest") must be verifiably true against ALL the provided numbers — before claiming one match is the largest/smallest/tightest on some measure, check that measure for every other match in the data. If it isn't true, don't claim it.
7. Never compute numbers yourself — no arithmetic, no Elo gaps you derived, no ratios. Only use numbers exactly as they literally appear in the data (Elo gaps and the Elo ranking are provided precomputed). Attribute every number to the match and team it belongs to in the data.
8. Never invent composite metrics ("Elo-adjusted title equity", "structural threat index"). Rank or compare teams only on measures that literally appear in the data: Elo, match win probability, final probability, title probability, penalties probability, Elo gap, combined side title chance. If a superlative can't be verified from those, rewrite the sentence without the superlative — a card is better with one fewer claim than with one wrong claim.`;

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

  // Previous title chances (per team) from the last run, for shift context.
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
  const finalRound = output.roundNames[output.roundNames.length - 1];
  const semifinalRoundIndex = output.roundNames.length - 2;

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

  // ---- Build the data section: all matches side by side ----
  const dataLines: string[] = ["MATCH DATA (10,000 tournament simulations):"];
  for (const match of upcoming) {
    const stats = output.matches[match.matchId];
    dataLines.push("", `${match.matchId} (${match.round}): ${match.home} vs ${match.away}`);
    for (const team of [match.home, match.away]) {
      const t = output.teams[team];
      dataLines.push(
        `- ${team}: Elo ${ratings[team]} | wins this match ${pct(stats.winner[team] ?? 0)} | ` +
          `reaches final ${pct(t.reachedRound[finalRound] ?? 0)} | wins title ${pct(t.champion)}`,
      );
      const prev = previousTitle[team];
      if (prev !== undefined && Math.abs(prev - t.champion) >= 0.0005) {
        dataLines.push(`  (title chance was ${pct(prev)} at the previous update)`);
      }
    }
    dataLines.push(`- Elo gap between these two teams: ${Math.abs(ratings[match.home] - ratings[match.away])} points`);
    dataLines.push(`- Probability this match is level after 90 minutes and goes to penalties: ${pct(stats.penalties)}`);

    // Real what-if: pin the lower-Elo team as the winner and report title swings.
    const underdog = ratings[match.home] <= ratings[match.away] ? match.home : match.away;
    const upset = simulateCompetition(competition, ratings, {
      results,
      pinned: [{ matchId: match.matchId, winner: underdog }],
    });
    const swings = competition.teams
      .map((team) => ({ team, before: output.teams[team].champion, after: upset.teams[team].champion }))
      .filter((s) => Math.abs(s.after - s.before) >= 0.02)
      .sort((a, b) => Math.abs(b.after - b.before) - Math.abs(a.after - a.before))
      .slice(0, 4);
    dataLines.push(
      `- If ${underdog} wins this match, title chances become: ` +
        swings.map((s) => `${s.team} ${pct(s.before)} -> ${pct(s.after)}`).join(", "),
    );
  }

  // Bracket halves: combined title chance of every team that can reach each semifinal.
  const semifinalMatches = competition.bracket!.rounds[semifinalRoundIndex].matches;
  dataLines.push("", "BRACKET CONTEXT:");
  const eloRanking = [...competition.teams].sort((a, b) => ratings[b] - ratings[a]);
  dataLines.push(`- All teams ranked by Elo: ${eloRanking.map((t) => `${t} ${ratings[t]}`).join(" > ")}`);
  for (const semi of semifinalMatches) {
    const pool = competition.teams.filter((t) => (output.matches[semi.id].appeared[t] ?? 0) > 0);
    const combined = pool.reduce((a, t) => a + output.teams[t].champion, 0);
    dataLines.push(
      `- ${semi.id} side of the bracket (${pool.join(", ")}): combined title chance ${pct(combined)}`,
    );
  }

  const userPrompt = `${dataLines.join("\n")}

ANGLE MENU — pick the single most interesting angle for each match; never use the same angle twice across the set:
- The tightest matchup of the round
- A mismatch even bigger than fans assume
- Bracket-side imbalance: one semifinal path is much easier than the other
- A team whose title chance is high or low relative to its match chance because of who likely awaits next round
- How much a specific upset would swing the title picture (use the provided "If X wins" numbers)
- Penalty-lottery risk in a near-even tie (use the provided penalties probability)

TASK: Write exactly one insight card per match (${upcoming.map((m) => m.matchId).join(", ")}). Each card: a punchy one-line headline plus a body of 2-3 sentences built on its chosen angle, with every number quoted verbatim from the data above. Remember: no two cards may share an angle or a headline template.`;

  console.log(`Generating ${upcoming.length} insight cards with ${MODEL}...`);
  const client = new Anthropic();

  async function callModel(system: string, prompt: string) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system,
      output_config: { format: { type: "json_schema", schema: RESPONSE_SCHEMA } },
      messages: [{ role: "user", content: prompt }],
    });
    const text = response.content.find((block) => block.type === "text")?.text;
    if (!text) throw new Error(`Empty response (stop_reason: ${response.stop_reason})`);
    return JSON.parse(text) as { cards: { matchId: string; headline: string; body: string }[] };
  }

  const draft = await callModel(SYSTEM_PROMPT, userPrompt);

  // Second pass: fact-check the draft against the same data. The model is far
  // more reliable at verifying claims than at not making them in the first place.
  console.log("Fact-checking draft cards against the data...");
  const checkPrompt = `${dataLines.join("\n")}

DRAFT CARDS:
${JSON.stringify(draft.cards, null, 2)}

TASK: You are the fact-checker. Verify every single claim in every card against the data above:
- Every number must appear verbatim in the data and be attributed to the correct match and team.
- Every superlative or ranking ("highest of the round", "third largest", "tightest") must be checked against ALL matches/teams on that exact measure. If false, fix it or remove it.
- Cards must not contradict each other.
- For a quarterfinalist, "reaches the semifinal" is the same number as winning this match — never presented as two facts.
- No invented team traits, no invented metrics, no betting language.
Rewrite only what is wrong; keep correct claims, angles, style, and headline variety intact. Return the full corrected set of cards in the same JSON shape.`;
  const parsed = await callModel(SYSTEM_PROMPT, checkPrompt);

  // Programmatic guard: every percentage in the final text must appear verbatim
  // in the data we provided. Misquoted numbers abort the run (old file kept).
  const allowedPercentages = new Set(dataLines.join("\n").match(/\d+(?:\.\d+)?%/g) ?? []);
  for (const card of parsed.cards) {
    const quoted = `${card.headline} ${card.body}`.match(/\d+(?:\.\d+)?%/g) ?? [];
    const unknown = quoted.filter((token) => !allowedPercentages.has(token));
    if (unknown.length > 0) {
      throw new Error(`Card ${card.matchId} quotes numbers not in the data: ${unknown.join(", ")}`);
    }
  }

  // The response must cover every upcoming match exactly once.
  const byId = new Map(parsed.cards.map((c) => [c.matchId, c]));
  const missing = upcoming.filter((m) => !byId.has(m.matchId));
  if (missing.length > 0 || byId.size !== upcoming.length) {
    throw new Error(`Response did not cover every match exactly once (missing: ${missing.map((m) => m.matchId).join(", ") || "none"})`);
  }

  const generatedAt = new Date().toISOString();
  const cards: InsightCard[] = upcoming.map((match) => {
    const card = byId.get(match.matchId)!;
    return {
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
      generatedAt,
    };
  });

  // All good — only now overwrite the file.
  writeFileSync(join(process.cwd(), "data/insights.json"), JSON.stringify(cards, null, 2) + "\n");
  for (const card of cards) console.log(`  ${card.matchId}: ${card.headline}`);
  console.log(`Wrote ${cards.length} cards to data/insights.json`);
}

main().catch((error) => {
  console.error("Insight generation failed — data/insights.json was left untouched.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
