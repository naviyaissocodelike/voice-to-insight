# Opportunity Radar — Grants & Scholarship Agent

An AI research agent (free to run) that deep-searches the web for grants, fellowships, competitions, and AI programs relevant to US-based entrepreneurs and AI practitioners — entrepreneurship grants, angel-investing fellowships, AI-for-good funding, programs abroad for US citizens, prize challenges, and non-dilutive "free money" opportunities.

## How it works

Google Gemini (`gemini-2.5-flash`, free tier) runs an agentic tool-use loop: it issues 20+ targeted web searches via the Brave Search API, evaluates each result against a quality bar, and saves structured records (title, org, amount, deadline, eligibility, category, status) to `data/opportunities.json`. URLs are normalized for dedup, unsafe URLs are rejected, and opportunities whose dated deadline has passed are automatically shown as closed.

Runs are **incremental**: each run records its search queries to `data/run-history.json`, and the next run is shown what's already tracked plus which queries were already tried — so it hunts for newly announced programs and fresh angles instead of rediscovering the same ones.

## Automated runs (GitHub Actions)

`.github/workflows/grants-agent.yml` runs the agent **twice a month (1st and 15th, 13:00 UTC)** and commits new finds back to the repo. Requirements:

1. Add repository secrets (Settings → Secrets and variables → Actions):
   - `GEMINI_API_KEY` — **free** at [aistudio.google.com/apikey](https://aistudio.google.com/apikey), no card required
   - `BRAVE_API_KEY` — free at [api.search.brave.com/app/keys](https://api.search.brave.com/app/keys)
2. Trigger manually anytime: Actions tab → Grants Agent → **Run workflow**.

Each run's new opportunities appear as a table in the job summary.

## Run locally

```bash
npm install
cp .env.example .env   # fill in your keys
npm start              # dashboard at http://localhost:3000
npm run grants         # or run the agent from the CLI
```

The dashboard shows every opportunity as a card with deadline urgency, amounts, and eligibility — filter by status/category, search, and sort by deadline. Click **Run Agent** to watch a discovery run live.

## Stack

Node.js · Express · Google Gemini 2.5 Flash (free tier) · Brave Search API · GitHub Actions
