import express from "express";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { google } from "googleapis";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import "dotenv/config";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(express.static(join(__dirname, "public")));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const adminSupabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── Public config for frontend ───────────────────────────────────────────────

app.get("/config.js", (_req, res) => {
  res.setHeader("Content-Type", "application/javascript");
  res.send(
    `window.__SUPABASE_URL=${JSON.stringify(process.env.SUPABASE_URL || "")};` +
    `window.__SUPABASE_ANON=${JSON.stringify(process.env.SUPABASE_ANON_KEY || "")};`
  );
});

// ── Auth middleware ──────────────────────────────────────────────────────────

async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  const { data: { user }, error } = await adminSupabase.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: "Unauthorized" });

  req.user = user;
  next();
}

// ── GET /lookup-contact ──────────────────────────────────────────────────────

app.get("/lookup-contact", requireAuth, async (req, res) => {
  const { email } = req.query;
  if (!email?.trim()) return res.json({ found: false });

  const { data: investor } = await adminSupabase
    .from("investors")
    .select("*")
    .eq("email", email.toLowerCase().trim())
    .single();

  if (!investor) return res.json({ found: false });

  const { data: recentUpdates } = await adminSupabase
    .from("crm_updates")
    .select("event_type, event_date, summary, created_by_email, created_at")
    .eq("investor_id", investor.id)
    .order("event_date", { ascending: false })
    .limit(3);

  const { count } = await adminSupabase
    .from("crm_updates")
    .select("id", { count: "exact", head: true })
    .eq("investor_id", investor.id);

  res.json({ found: true, investor, recentUpdates: recentUpdates ?? [], count: count ?? 0 });
});

// ── POST /analyze-contact ────────────────────────────────────────────────────

const ANALYZE_SYSTEM_PROMPT = `You are a personal CRM assistant. Extract structured contact notes from a voice memo or meeting notes.

Return ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "summary": "2-3 sentence overview of this specific interaction",
  "personalDetails": "personality traits, interests, communication style, memorable details about this person",
  "keyTopics": ["topic discussed 1", "topic discussed 2"],
  "followUps": ["specific follow-up item 1", "specific follow-up item 2"],
  "nextSteps": [{ "action": "concrete next action", "timing": "e.g. within 1 week" }],
  "tags": ["relevant-tag", "e.g. investor", "warm-lead", "mentor"]
}

Be specific and actionable. Extract real details — don't be generic.`;

app.post("/analyze-contact", requireAuth, async (req, res) => {
  const { contactName, eventType, eventDate, input, sourceUrl } = req.body;
  if (!input?.trim()) return res.status(400).json({ error: "No input provided." });

  try {
    const userMessage = [
      `Contact: ${contactName || "Unknown"}`,
      `Event Type: ${eventType || "Meeting"}`,
      `Event Date: ${eventDate || new Date().toLocaleDateString()}`,
      sourceUrl ? `Source: ${sourceUrl}` : null,
      ``,
      `Notes:`,
      input,
    ]
      .filter(Boolean)
      .join("\n");

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 1024,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: ANALYZE_SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
    });

    const notes = JSON.parse(completion.choices[0].message.content);
    res.json({ notes });
  } catch (err) {
    console.error("analyze-contact error:", err);
    res.status(500).json({ error: "Failed to analyze notes: " + err.message });
  }
});

// ── POST /save-contact ───────────────────────────────────────────────────────

const ROLLING_SUMMARY_PROMPT = `You are a CRM assistant. Given a list of interactions with a person, write a 3-5 sentence rolling summary that captures:
- Who this person is and what they do
- The current state of the relationship
- Key context and details to remember

Return only the summary text, no labels or formatting.`;

async function generateRollingSummary(contactName, updates) {
  const interactionText = updates
    .map((u, i) => `Interaction ${i + 1} (${u.event_date}, ${u.event_type}):\n${u.summary}\n${u.personal_details || ""}`)
    .join("\n\n");

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 300,
    messages: [
      { role: "system", content: ROLLING_SUMMARY_PROMPT },
      { role: "user", content: `Contact: ${contactName}\n\n${interactionText}` },
    ],
  });

  return completion.choices[0].message.content.trim();
}

async function appendToGoogleSheets(row) {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
    range: "Sheet1!A:Q",
    valueInputOption: "RAW",
    resource: { values: [row] },
  });
}

app.post("/save-contact", requireAuth, async (req, res) => {
  const {
    contactName, email, phone, linkedinUrl,
    eventType, eventDate, sourceUrl,
    notes, rawInput, followUpDate,
  } = req.body;

  try {
    // 1. Upsert investor record
    let investor;
    if (email?.trim()) {
      const { data: existing } = await adminSupabase
        .from("investors")
        .select("*")
        .eq("email", email.toLowerCase().trim())
        .single();

      if (existing) {
        const { data: updated } = await adminSupabase
          .from("investors")
          .update({
            name: contactName || existing.name,
            phone: phone || existing.phone,
            linkedin_url: linkedinUrl || existing.linkedin_url,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id)
          .select()
          .single();
        investor = updated;
      }
    }

    if (!investor) {
      const { data: created, error } = await adminSupabase
        .from("investors")
        .insert({
          name: contactName || "Unknown",
          email: email?.toLowerCase().trim() || null,
          phone: phone || null,
          linkedin_url: linkedinUrl || null,
        })
        .select()
        .single();

      if (error) throw error;
      investor = created;
    }

    // 2. Insert crm_updates row
    const { error: updateError } = await adminSupabase.from("crm_updates").insert({
      investor_id: investor.id,
      event_type: eventType || "Meeting",
      event_date: eventDate || new Date().toISOString().split("T")[0],
      raw_input: rawInput || "",
      source_url: sourceUrl || null,
      summary: notes.summary || "",
      personal_details: notes.personalDetails || "",
      key_topics: notes.keyTopics || [],
      follow_ups: notes.followUps || [],
      next_steps: notes.nextSteps || [],
      follow_up_date: followUpDate || null,
      tags: notes.tags || [],
      created_by_id: req.user.id,
      created_by_email: req.user.email,
    });

    if (updateError) throw updateError;

    // 3. Regenerate rolling summary for investor
    const { data: allUpdates } = await adminSupabase
      .from("crm_updates")
      .select("event_type, event_date, summary, personal_details")
      .eq("investor_id", investor.id)
      .order("event_date", { ascending: true });

    const rollingSummary = await generateRollingSummary(investor.name, allUpdates ?? []);
    const allTags = [...new Set((allUpdates ?? []).flatMap((u) => u.tags ?? []))];

    await adminSupabase
      .from("investors")
      .update({
        summary: rollingSummary,
        tags: allTags,
        updated_at: new Date().toISOString(),
      })
      .eq("id", investor.id);

    // 4. Append to Google Sheets
    const sheetRow = [
      new Date().toISOString(),
      contactName || "",
      email || "",
      phone || "",
      linkedinUrl || "",
      eventType || "Meeting",
      eventDate || "",
      notes.summary || "",
      notes.personalDetails || "",
      (notes.keyTopics || []).join("; "),
      (notes.followUps || []).join("; "),
      (notes.nextSteps || []).map((s) => `${s.action} (${s.timing})`).join("; "),
      (notes.tags || []).join(", "),
      followUpDate || "",
      sourceUrl || "",
      req.user.email,
      rawInput || "",
    ];

    try {
      await appendToGoogleSheets(sheetRow);
    } catch (sheetsErr) {
      console.error("Google Sheets append failed (non-fatal):", sheetsErr.message);
    }

    const { count } = await adminSupabase
      .from("crm_updates")
      .select("id", { count: "exact", head: true })
      .eq("investor_id", investor.id);

    const sheetUrl = `https://docs.google.com/spreadsheets/d/${process.env.GOOGLE_SHEETS_SPREADSHEET_ID}`;

    res.json({ success: true, investorId: investor.id, interactionCount: count ?? 1, sheetUrl });
  } catch (err) {
    console.error("save-contact error:", err);
    res.status(500).json({ error: "Failed to save contact: " + err.message });
  }
});

// ── Start ────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Voice CRM running at http://localhost:${PORT}`);
});
