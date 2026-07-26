import express from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import "dotenv/config";
import { loadOpportunities, getStats } from "./agent/storage.js";
import { runGrantsAgent } from "./agent/grants-agent.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(express.static(join(__dirname, "public")));

// ── Opportunities API ───────────────────────────────────────────────────────

app.get("/api/opportunities", (req, res) => {
  const { category, status, search, sort = "newest" } = req.query;
  let opps = loadOpportunities();

  if (category && category !== "all") {
    opps = opps.filter(o => o.category === category);
  }
  if (status && status !== "all") {
    opps = opps.filter(o => o.status === status);
  }
  if (search) {
    const q = search.toLowerCase();
    opps = opps.filter(
      o =>
        o.title?.toLowerCase().includes(q) ||
        o.organization?.toLowerCase().includes(q) ||
        o.description?.toLowerCase().includes(q) ||
        o.tags?.some(t => t.toLowerCase().includes(q))
    );
  }

  if (sort === "deadline") {
    opps = opps.sort((a, b) => {
      const da = a.deadline && a.deadline.match(/^\d{4}-\d{2}-\d{2}$/) ? new Date(a.deadline) : new Date("2099-01-01");
      const db = b.deadline && b.deadline.match(/^\d{4}-\d{2}-\d{2}$/) ? new Date(b.deadline) : new Date("2099-01-01");
      return da - db;
    });
  }

  res.json({ opportunities: opps, stats: getStats() });
});

app.get("/api/opportunities/stats", (req, res) => {
  res.json(getStats());
});

// ── Agent runs ──────────────────────────────────────────────────────────────

let agentRunning = false;

async function runAgentOnce({ send, shouldStop } = {}) {
  agentRunning = true;
  try {
    return await runGrantsAgent({
      onProgress: msg => send?.("progress", { message: msg }),
      onOpportunity: opp => send?.("opportunity", { opportunity: opp }),
      onComplete: s => send?.("complete", { stats: s }),
      shouldStop
    });
  } finally {
    agentRunning = false;
  }
}

app.post("/api/agent/run", async (req, res) => {
  if (agentRunning) {
    return res.status(409).json({ error: "Agent is already running" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // Stop the agent loop (at the next iteration boundary) if the client goes away,
  // so a closed browser tab doesn't keep burning API tokens.
  let clientGone = false;
  req.on("close", () => { clientGone = true; });

  const send = (type, data) => {
    if (!clientGone) res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
  };

  send("start", { message: "Agent starting..." });

  try {
    const stats = await runAgentOnce({ send, shouldStop: () => clientGone });
    send("done", { stats });
  } catch (err) {
    send("error", { message: err.message });
  } finally {
    res.end();
  }
});

app.get("/api/agent/status", (req, res) => {
  res.json({ running: agentRunning });
});

// ── Optional scheduled runs (for always-on hosting) ─────────────────────────
// Set AGENT_AUTO_RUN_HOURS in .env (e.g. 336 for two weeks) to re-run
// automatically while the server is up. GitHub Actions handles scheduling
// when the server isn't deployed anywhere.

const autoRunHours = Number(process.env.AGENT_AUTO_RUN_HOURS);
if (autoRunHours > 0) {
  const intervalMs = autoRunHours * 60 * 60 * 1000;
  setInterval(async () => {
    if (agentRunning) return;
    console.log(`[auto-run] Starting scheduled agent run (every ${autoRunHours}h)`);
    try {
      const stats = await runAgentOnce();
      console.log(`[auto-run] Done: ${stats.saved} new, ${stats.total} total tracked`);
    } catch (err) {
      console.error(`[auto-run] Failed: ${err.message}`);
    }
  }, intervalMs);
  console.log(`Scheduled agent runs enabled: every ${autoRunHours}h`);
}

// ── Start ───────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Opportunity Radar running at http://localhost:${PORT}`);
});
