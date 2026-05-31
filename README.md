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

## Stack

Node.js · Express · OpenAI GPT-4o · Server-sent events (streaming)
