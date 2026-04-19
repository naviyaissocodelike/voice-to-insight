import express from "express";
import OpenAI from "openai";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import "dotenv/config";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(express.static(join(__dirname, "public")));

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
    const stream = await client.chat.completions.create({
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Voice-to-Actions running at http://localhost:${PORT}`);
});
