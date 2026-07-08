# TenThousand — locked decisions (never revisit, never "improve")

- Product: free football probability site. Tagline: "Every match, simulated 10,000 times. Math shown." No ads, no betting affiliate links, no paywalls. Ever.

- Stack: Next.js on Vercel free tier, TypeScript, no backend, no database. All data = JSON files in the repo. All pages statically generated; the only server piece is the Vercel OG image route.

- Simulation runs client-side in the browser (and in Node for scripts, sharing the same TypeScript engine code).

- Model: Elo → expected goals (calibrated so a 200 Elo gap ≈ 65–70% win probability) → independent Poisson goals per team → +0.25 xG home advantage when the competition's homeAdvantage flag is true (false for World Cup) → knockout draws resolved by a penalty model weighted 55/45 to the higher-Elo team → 10,000 tournament runs.

- A competition is a config object: { teams, format: "knockout" | "league", homeAdvantage: boolean }. One engine, all competitions. Premier League, La Liga, Serie A, Bundesliga, Ligue 1, Champions League arrive in August via config + data source change only.

- Data files: data/competitions/*.json (one config per competition), data/teams.json (Elo ratings), data/results.json (completed matches), data/insights.json (AI-generated cards — never hand-edit).

- Nightly GitHub Actions job: re-simulate → generate one insight card per upcoming match via Anthropic API (model claude-sonnet-4-6) → commit → Vercel auto-redeploys.

- Never commit API keys. Secrets live in .env.local (gitignored) locally and GitHub Actions secrets in CI.

- Engine changes require the unit tests to pass first. Never touch engine math during UI work, and vice versa.

- Prefer boring, readable code over clever code. The operator is not a developer.

- Mobile-first design. Every share graphic carries "simulated 10,000×".
