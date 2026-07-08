// The one allowed server route (locked decision): Vercel OG share images.
// Renders a 1200x630 dark branded card. Default: title odds. ?match=QF1: match card.
// Numbers come from the same committed data + engine the homepage uses at build
// time (same default seed), so cards always match the site.

import { ImageResponse } from "next/og";
import {
  Competition,
  EloRatings,
  MatchResult,
  simulateCompetition,
} from "@/lib/engine";
import { knownWinners, remainingTeams, slotTeam } from "@/lib/bracket-view";
import competitionJson from "@/data/competitions/world-cup-2026.json";
import ratingsJson from "@/data/teams.json";
import resultsJson from "@/data/results.json";

const competition = competitionJson as Competition;
const ratings = ratingsJson as EloRatings;
const results = resultsJson as MatchResult[];

// Computed once per server instance — identical numbers to the built homepage.
const output = simulateCompetition(competition, ratings, { results });

const SIZE = { width: 1200, height: 630 };
const pct1 = (p: number) => `${(p * 100).toFixed(1)}%`;
const pct0 = (p: number) => `${Math.round(p * 100)}%`;

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#09090b",
        color: "#f4f4f5",
        padding: "48px 56px",
        fontFamily: "sans-serif",
        position: "relative",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
        <div style={{ fontSize: 40, fontWeight: 700 }}>TenThousand</div>
        <div style={{ fontSize: 20, color: "#a1a1aa" }}>Math shown.</div>
      </div>
      {children}
      <div
        style={{
          position: "absolute",
          bottom: 32,
          right: 56,
          fontSize: 24,
          fontWeight: 700,
          color: "#22d3ee",
        }}
      >
        simulated 10,000×
      </div>
    </div>
  );
}

function TitleOddsCard() {
  const rows = remainingTeams(competition, results)
    .map((team) => ({ team, chance: output.teams[team].champion }))
    .sort((a, b) => b.chance - a.chance);
  const max = Math.max(...rows.map((r) => r.chance), 0.0001);

  return (
    <Frame>
      <div style={{ fontSize: 30, color: "#a1a1aa", marginTop: 20, display: "flex" }}>
        World Cup 2026 — title odds
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
        {rows.map((row) => (
          <div
            key={row.team}
            style={{ display: "flex", alignItems: "center", gap: 16, height: 44 }}
          >
            <div style={{ width: 200, fontSize: 26, fontWeight: 600, display: "flex" }}>
              {row.team}
            </div>
            <div
              style={{
                display: "flex",
                width: 700 * (row.chance / max),
                height: 30,
                backgroundColor: "rgba(34, 211, 238, 0.35)",
                borderRadius: 6,
              }}
            />
            <div style={{ fontSize: 26, fontWeight: 700, display: "flex" }}>
              {pct1(row.chance)}
            </div>
          </div>
        ))}
      </div>
    </Frame>
  );
}

function MatchCard({ matchId, round, home, away }: { matchId: string; round: string; home: string; away: string }) {
  const stats = output.matches[matchId];
  return (
    <Frame>
      <div style={{ fontSize: 30, color: "#a1a1aa", marginTop: 40, display: "flex" }}>
        {matchId} · {round} · World Cup 2026
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 56,
        }}
      >
        {[home, away].map((team, index) => (
          <div
            key={team}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: index === 0 ? "flex-start" : "flex-end",
              width: 460,
            }}
          >
            <div style={{ fontSize: 52, fontWeight: 700, display: "flex" }}>{team}</div>
            <div
              style={{ fontSize: 96, fontWeight: 700, color: "#22d3ee", display: "flex" }}
            >
              {pct0(stats.winner[team] ?? 0)}
            </div>
            <div style={{ fontSize: 26, color: "#a1a1aa", display: "flex" }}>
              wins the title {pct1(output.teams[team].champion)}
            </div>
          </div>
        ))}
      </div>
      <div
        style={{
          position: "absolute",
          top: 300,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          fontSize: 34,
          color: "#52525b",
        }}
      >
        vs
      </div>
    </Frame>
  );
}

export async function GET(request: Request) {
  const matchId = new URL(request.url).searchParams.get("match");
  if (!matchId) {
    return new ImageResponse(<TitleOddsCard />, SIZE);
  }

  const winners = knownWinners(results, {});
  for (const round of competition.bracket?.rounds ?? []) {
    for (const match of round.matches) {
      if (match.id !== matchId) continue;
      const home = slotTeam(match.home, winners);
      const away = slotTeam(match.away, winners);
      if (!home || !away) {
        return new Response(`Match ${matchId} does not have both teams decided yet`, { status: 404 });
      }
      return new ImageResponse(
        <MatchCard matchId={matchId} round={round.name} home={home} away={away} />,
        SIZE,
      );
    }
  }
  return new Response(`Unknown match "${matchId}"`, { status: 404 });
}
