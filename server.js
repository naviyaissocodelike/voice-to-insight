import express from "express";
import OpenAI from "openai";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import "dotenv/config";
import { loadOpportunities, getStats } from "./agent/storage.js";
import { runGrantsAgent } from "./agent/grants-agent.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(express.static(join(__dirname, "public")));

let _openaiClient = null;
function getOpenAIClient() {
  if (!_openaiClient) _openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openaiClient;
}

const SYSTEM_PROMPT = `You are a sharp executive assistant. Given a raw spoken transcript, extract:
1. **Key Points** — concise bullet summaries of what was said (max 6 bullets)
2. **Action Items** — specific, actionable next steps with clear ownership language (max 6 items)

Format your response exactly like this:

## Key Points
- bullet
- bullet

## Action Items
- [ ] action
- [ ] action

Be terse. No filler. No preamble.`;

app.post("/extract", async (req, res) => {
  const { transcript } = req.body;
  if (!transcript?.trim()) {
    return res.status(400).json({ error: "No transcript provided." });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const stream = await getOpenAIClient().chat.completions.create({
      model: "gpt-4o",
      max_tokens: 1024,
      stream: true,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Transcript:\n\n${transcript}` },
      ],
    });

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content ?? "";
      if (text) res.write(`data: ${JSON.stringify({ text })}\n\n`);
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

// ── Grants & Opportunities API ─────────────────────────────────────────────

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

let agentRunning = false;

app.post("/api/agent/run", async (req, res) => {
  if (agentRunning) {
    return res.status(409).json({ error: "Agent is already running" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const send = (type, data) => res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);

  agentRunning = true;
  send("start", { message: "Agent starting..." });

  try {
    const stats = await runGrantsAgent({
      onProgress: msg => send("progress", { message: msg }),
      onOpportunity: opp => send("opportunity", { opportunity: opp }),
      onComplete: s => send("complete", { stats: s })
    });
    send("done", { stats });
  } catch (err) {
    send("error", { message: err.message });
  } finally {
    agentRunning = false;
    res.end();
  }
});

app.get("/api/agent/status", (req, res) => {
  res.json({ running: agentRunning });
});

// ── Start ───────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Voice-to-Actions running at http://localhost:${PORT}`);
  console.log(`Grants tracker:    http://localhost:${PORT}/grants.html`);
});
