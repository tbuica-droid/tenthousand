import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Methodology — TenThousand",
  description:
    "How TenThousand simulates every match 10,000 times: Elo ratings, expected goals, Poisson distributions, and honest limitations.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-cyan-300">{title}</h2>
      <div className="mt-3 flex flex-col gap-3 text-[15px] leading-relaxed text-zinc-300">
        {children}
      </div>
    </section>
  );
}

export default function Methodology() {
  return (
    <div className="min-h-screen">
      <main className="mx-auto w-full max-w-md px-4 pb-8 pt-10 sm:max-w-2xl">
        <header>
          <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-300">
            ← TenThousand
          </Link>
          <h1 className="mt-4 text-3xl font-bold tracking-tight">Methodology</h1>
          <p className="mt-2 text-zinc-400">
            Every match, simulated 10,000 times. Math shown. Here is the math.
          </p>
        </header>

        <Section title="Where the ratings come from">
          <p>
            Every team has an Elo rating — a single number that goes up when a team beats
            expectations and down when it falls short. The bigger the gap between two teams&apos;
            ratings, the more lopsided the matchup. For the World Cup, we hand-enter ratings
            from{" "}
            <a href="https://eloratings.net" className="underline underline-offset-2 hover:text-white">
              eloratings.net
            </a>
            . When club competitions arrive, those will use{" "}
            <a href="https://clubelo.com" className="underline underline-offset-2 hover:text-white">
              clubelo.com
            </a>{" "}
            and{" "}
            <a href="https://football-data.org" className="underline underline-offset-2 hover:text-white">
              football-data.org
            </a>
            .
          </p>
        </Section>

        <Section title="How one match is simulated">
          <p>
            First, the Elo difference between the two teams is turned into expected goals — how
            many goals each side would score in an average version of this match. The conversion
            is calibrated so that a 200-point Elo gap means the stronger team wins roughly 65–70%
            of the time, which matches how such games actually play out.
          </p>
          <p>
            Then each team&apos;s actual goals are drawn from a Poisson distribution — a simple
            recipe that answers &quot;if a team creates enough chances to score 1.8 goals on
            average, how often does it actually score 0, 1, 2, or 5?&quot; That randomness is why
            a weaker team sometimes wins: football is low-scoring, and one lucky goal matters.
          </p>
          <p>
            Where home advantage applies, the home team gets +0.25 expected goals. The World Cup
            is on neutral ground, so it doesn&apos;t apply there.
          </p>
          <p>
            If a knockout match is level after 90 simulated minutes, a penalty shootout decides
            it: the higher-rated team wins the shootout 55% of the time, the lower-rated team
            45%. Penalties are close to a coin flip, and the model treats them that way.
          </p>
        </Section>

        <Section title="How a tournament is simulated">
          <p>
            We take the entire remaining bracket and play it out start to finish — then do that
            10,000 times. Every percentage on this site is simply a count: if Spain lifts the
            trophy in 2,533 of the 10,000 simulated tournaments, we show 25.3%. No opinions, no
            adjustments — just counting.
          </p>
        </Section>

        <Section title="The what-if bracket">
          <p>
            Tap a team on the homepage bracket to pin it as the winner of its match. Your phone
            instantly re-runs all 10,000 tournament simulations with that result locked in, and
            every number on the page updates. Un-tap to undo. It&apos;s the same engine, running
            live in your browser.
          </p>
        </Section>

        <Section title="The AI insight cards">
          <p>
            The insight cards are written nightly by an AI model, working only from the
            simulation output. The numbers come from the simulation; the words come from the AI.
            If a card says 26.5%, that number was counted out of 10,000 runs, not invented.
          </p>
        </Section>

        <Section title="Honest limitations">
          <p>Things this model does not know, and we won&apos;t pretend otherwise:</p>
          <ul className="flex list-disc flex-col gap-2 pl-5">
            <li>
              Elo doesn&apos;t know about injuries, suspensions, tactics, weather, or what the
              manager said at yesterday&apos;s press conference. It only knows results.
            </li>
            <li>
              Small edges in penalty shootouts are close to coin flips — the 55/45 edge is a
              nudge, not a certainty.
            </li>
            <li>
              10,000 runs is a lot, but not infinite: every percentage carries roughly ±1% of
              statistical noise. Treat 34% and 35% as the same number.
            </li>
            <li>
              Probabilities are not predictions. &quot;70%&quot; means the outcome happens 7
              times out of 10 — and doesn&apos;t happen 3 times out of 10. Upsets are part of
              the math, not a failure of it.
            </li>
          </ul>
        </Section>

        <p className="mt-12 rounded-xl border border-zinc-800 p-4 text-sm text-zinc-400">
          TenThousand is free, has no ads, and no betting links. Nothing here is betting advice.
        </p>

        <footer className="mt-10 border-t border-zinc-800 pt-6 pb-8 text-xs text-zinc-500">
          <Link href="/" className="underline underline-offset-2 hover:text-zinc-300">
            ← Back to the bracket
          </Link>
        </footer>
      </main>
    </div>
  );
}
