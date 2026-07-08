// AI-generated insight cards, one per upcoming match. Hidden when there are none.

import { InsightCard } from "@/lib/insights";

export function Insights({ cards }: { cards: InsightCard[] }) {
  if (cards.length === 0) return null;
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-zinc-500">
        Insights
      </h2>
      <div className="flex flex-col gap-3 sm:grid sm:grid-cols-2">
        {cards.map((card) => (
          <article key={card.matchId} className="rounded-xl border border-zinc-800 p-4">
            <p className="text-xs uppercase tracking-widest text-zinc-600">{card.matchId}</p>
            <h3 className="mt-1 font-semibold leading-snug">{card.headline}</h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">{card.body}</p>
            <p className="mt-3 flex gap-4 font-mono text-sm tabular-nums text-zinc-300">
              {Object.entries(card.probabilities).map(([team, p]) => (
                <span key={team}>
                  {team} <span className="font-semibold">{Math.round(p * 100)}%</span>
                </span>
              ))}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
