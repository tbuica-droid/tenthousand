import Link from "next/link";
import {
  Competition,
  EloRatings,
  MatchResult,
  simulateCompetition,
} from "@/lib/engine";
import { WhatIf } from "@/components/what-if";
import competitionJson from "@/data/competitions/world-cup-2026.json";
import ratingsJson from "@/data/teams.json";
import resultsJson from "@/data/results.json";

const competition = competitionJson as Competition;
const ratings = ratingsJson as EloRatings;
const results = resultsJson as MatchResult[];

export default function Home() {
  // Runs once at build time; the page ships as static HTML with numbers in it.
  const initialOutput = simulateCompetition(competition, ratings, { results });

  return (
    <div className="min-h-screen">
      <main className="mx-auto w-full max-w-md px-4 pb-8 pt-10 sm:max-w-3xl">
        <header className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight">TenThousand</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Every match, simulated 10,000 times. Math shown.
          </p>
        </header>

        <WhatIf
          competition={competition}
          ratings={ratings}
          results={results}
          initialOutput={initialOutput}
        />

        <footer className="mt-16 border-t border-zinc-800 pt-6 pb-8 text-xs text-zinc-500">
          <Link href="/methodology" className="underline underline-offset-2 hover:text-zinc-300">
            Methodology
          </Link>
          <p className="mt-3">Free forever. No ads. No betting links. Not betting advice.</p>
        </footer>
      </main>
    </div>
  );
}
