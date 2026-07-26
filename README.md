# Voice to Insight

Paste a meeting transcript or voice note. Get key points and action items out in seconds.

A lightweight tool that takes messy spoken text and returns a clean structured summary — what was said and what needs to happen next, with nothing else.

## What it produces

- **Key Points** — up to 6 bullet summaries of what was discussed
- **Action Items** — up to 6 specific, ownable next steps in checkbox format

Output streams token-by-token so results appear as they're generated.

## Setup

### 1. Install

```bash
npm install
```

### 2. Configure

Create a `.env` file:

```
OPENAI_API_KEY=sk-...
PORT=3000
```

### 3. Run

```bash
npm start
```

Open `http://localhost:3000`, paste a transcript, and hit Extract.

## Opportunity Radar (Grants & Fellowships Agent)

A Claude-powered research agent that deep-searches the web for grants, fellowships, competitions, and AI programs relevant to US-based entrepreneurs and AI practitioners — entrepreneurship grants, angel-investing fellowships, AI-for-good funding, programs abroad for US citizens, prize challenges, and non-dilutive "free money" opportunities.

### How it works

Claude (`claude-opus-5`) runs an agentic tool-use loop: it issues 20+ targeted web searches via the Brave Search API, evaluates each result against a quality bar, and saves structured records (title, org, amount, deadline, eligibility, category, status) to a local JSON database. URLs are normalized for dedup (tracking params stripped, scheme/host canonicalized), unsafe URLs are rejected, and opportunities whose dated deadline has passed are automatically shown as closed.

### Setup

Add to `.env`:

```
ANTHROPIC_API_KEY=sk-ant-...   # console.anthropic.com
BRAVE_API_KEY=BSA...           # free at api.search.brave.com/app/keys (2000 queries/month)
# AGENT_AUTO_RUN_HOURS=24      # optional: re-run automatically every N hours
```

### Run it

- **Web UI**: `npm start` → open `http://localhost:3000/grants.html` → click **Run Agent**. Progress streams live; cards appear as opportunities are found. Filter by status/category, search, and sort by deadline.
- **CLI**: `npm run grants` (add `--quiet` to only print saved opportunities).
- **Automated (GitHub Actions)**: `.github/workflows/grants-agent.yml` runs the agent daily at 13:00 UTC and commits new finds back to the repo. Requires `ANTHROPIC_API_KEY` and `BRAVE_API_KEY` as repository Actions secrets (Settings → Secrets and variables → Actions). Trigger it manually anytime from the Actions tab (**Run workflow**). Each run's new opportunities appear as a table in the job summary.

Data lives in `data/opportunities.json` (committed, so state persists across CI runs). Runs are **incremental**: the agent is shown what's already tracked and which search queries previous runs used (`data/run-history.json`), so each run hunts for newly announced programs and fresh angles instead of rediscovering the same ones. Duplicates are also caught by canonicalized-URL dedup as a backstop.

## Stack

Node.js · Express · OpenAI GPT-4o (voice summaries) · Claude Opus 5 via Anthropic SDK (grants agent) · Brave Search API · Server-sent events (streaming)
