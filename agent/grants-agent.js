import Anthropic from '@anthropic-ai/sdk';
import { searchWeb } from './search.js';
import { loadOpportunities, saveOpportunity } from './storage.js';

const TOOLS = [
  {
    name: 'search_web',
    description:
      'Search the web for grants, fellowships, competitions, and funding opportunities. Returns up to 10 results with titles, URLs, and descriptions.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'Specific search query. Include year (2025 or 2026) for recency. Be targeted.'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'save_opportunity',
    description:
      'Save a real, open or upcoming opportunity to the database. Only call this for genuine programs a US entrepreneur or AI practitioner can apply to — not articles or lists.',
    input_schema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Official name of the grant, fellowship, competition, or program'
        },
        organization: {
          type: 'string',
          description: 'Name of the organization offering this opportunity'
        },
        url: {
          type: 'string',
          description: 'Direct URL to apply or learn more about this specific opportunity'
        },
        description: {
          type: 'string',
          description:
            '2-3 sentences: what it is, who it is for, and why someone should care. Be specific and informative.'
        },
        category: {
          type: 'string',
          enum: [
            'entrepreneurship',
            'angel-investing',
            'ai-for-good',
            'work-abroad',
            'competition',
            'ai-program',
            'grant',
            'fellowship'
          ],
          description: 'Best matching primary category'
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Relevant tags like ["AI", "non-dilutive", "US citizens", "stipend", "no equity", "remote", "international"]'
        },
        amount: {
          type: 'string',
          description:
            'Funding amount or prize value (e.g. "$50,000", "up to $1M", "$2,500/month stipend", "unknown")'
        },
        deadline: {
          type: 'string',
          description:
            'Application deadline as YYYY-MM-DD if known, or descriptive: "Rolling", "Spring 2026", "Unknown"'
        },
        eligibility: {
          type: 'string',
          description:
            'Who can apply: citizenship requirements, stage, field, etc. (e.g. "US citizens", "early-stage startups", "individuals worldwide")'
        },
        status: {
          type: 'string',
          enum: ['open', 'upcoming', 'rolling', 'unknown'],
          description:
            '"open" = accepting applications now, "upcoming" = opens soon, "rolling" = ongoing, "unknown" = unclear'
        }
      },
      required: [
        'title',
        'organization',
        'url',
        'description',
        'category',
        'tags',
        'eligibility',
        'status'
      ]
    }
  }
];

const SYSTEM_PROMPT = `You are an elite research agent tracking funding, fellowship, and competition opportunities for US-based entrepreneurs and AI practitioners.

## YOUR MISSION
Find and catalog ALL open or upcoming opportunities in these categories:

**1. Entrepreneurship Grants & Fellowships**
Non-dilutive grants, founder fellowships, entrepreneur-in-residence programs, startup grants (US focus)
Search: "entrepreneurship fellowship 2025 apply", "founder grant 2026 open", "startup grant non-dilutive US", "entrepreneur in residence fellowship"

**2. Angel Investing Fellowships**
Programs training or placing angel investors, VC fellowships, investor residencies
Search: "angel investing fellowship 2025", "VC fellowship program open", "investor in residence 2025", "venture capital training fellowship"

**3. AI for Good / AI for Impact**
Grants and fellowships using AI for social impact, AI ethics, responsible AI, humanitarian AI
Search: "AI for good grant 2025", "AI social impact fellowship", "responsible AI funding", "Mozilla fellowship AI", "AI ethics grant open applications"

**4. US Citizens Working Abroad**
International fellowships for Americans, Fulbright variants, global tech programs, work/learn abroad for US citizens
Search: "Fulbright fellowship 2026 apply", "international fellowship US citizens 2025", "global entrepreneurship fellowship Americans", "work abroad tech fellowship"

**5. AI Competitions & Prize Challenges**
Prize competitions, hackathons, AI grand challenges with real prize money
Search: "AI competition prize 2025 open", "machine learning challenge prize money", "AI innovation challenge 2025 register", "xPrize AI 2025", "AI hackathon 2026"

**6. AI Programs & Accelerators**
Cohort programs with stipends, equity-free AI accelerators, AI research programs with funding
Search: "AI accelerator equity free 2025", "AI cohort program stipend", "AI fellowship stipend 2025", "OpenAI startup fund", "NSF AI fellowship"

**7. Free Money / Non-Dilutive Funding**
Government grants, foundation grants, prize money, SBIR/STTR, any non-equity funding
Search: "SBIR AI 2025 open", "foundation grant AI entrepreneur", "government AI grant individuals 2025", "free money AI startup"

## SEARCH STRATEGY
Run 20+ targeted searches. Vary your queries — don't just search once per category.
Try: organization names, "open applications", "apply now 2025", "deadline 2025", different keywords.

## QUALITY BAR
ONLY save if:
✓ Real program with an organization behind it
✓ Application is open, upcoming, or rolling
✓ Direct URL to apply or official program page
✓ Relevant to: entrepreneurship, AI, angel investing, or working abroad for US person
✗ Skip: news articles, "top 10 grants" listicles, generic resources
✗ Skip: opportunities that clearly closed in 2024 or earlier

Be exhaustive. This is a comprehensive opportunity database, not a quick scan.`;

export async function runGrantsAgent({ onProgress, onOpportunity, onComplete } = {}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY not set. Add it to your .env file.'
    );
  }

  const client = new Anthropic({ apiKey });
  const existing = loadOpportunities();
  const existingUrls = new Set(existing.map(o => o.url));

  const stats = { searches: 0, saved: 0, skipped: 0, errors: 0 };
  const log = msg => onProgress?.(msg);

  log(`Starting search. ${existingUrls.size} opportunities already tracked.`);

  const messages = [
    {
      role: 'user',
      content: `Begin your comprehensive search now.

${existingUrls.size > 0
  ? `We already have ${existingUrls.size} opportunities tracked. Focus on finding NEW opportunities not yet in our database.`
  : 'This is a fresh database — build it from scratch with the best opportunities you can find.'
}

Run at least 20 searches across all categories. Save every quality opportunity you find. Go!`
    }
  ];

  let iterations = 0;
  const MAX_ITERATIONS = 50;

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    const response = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages
    });

    messages.push({ role: 'assistant', content: response.content });

    if (response.stop_reason === 'end_turn') {
      log('Agent finished search.');
      break;
    }

    const toolResults = [];

    for (const block of response.content) {
      if (block.type !== 'tool_use') continue;

      let resultContent;

      try {
        if (block.name === 'search_web') {
          stats.searches++;
          log(`Searching: "${block.input.query}"`);
          const results = await searchWeb(block.input.query);
          resultContent = JSON.stringify({ count: results.length, results });
        } else if (block.name === 'save_opportunity') {
          const opp = block.input;
          if (existingUrls.has(opp.url)) {
            stats.skipped++;
            resultContent = JSON.stringify({ status: 'duplicate', message: 'Already in database' });
          } else {
            const all = saveOpportunity(opp);
            existingUrls.add(opp.url);
            stats.saved++;
            onOpportunity?.(opp);
            log(`Saved: "${opp.title}" [${opp.category}]`);
            resultContent = JSON.stringify({ status: 'saved', totalInDatabase: all.length });
          }
        }
      } catch (err) {
        stats.errors++;
        log(`Error (${block.name}): ${err.message}`);
        resultContent = JSON.stringify({ error: err.message });
      }

      toolResults.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: resultContent
      });
    }

    if (toolResults.length === 0) break;
    messages.push({ role: 'user', content: toolResults });
  }

  const finalStats = {
    ...stats,
    total: loadOpportunities().length
  };

  onComplete?.(finalStats);
  return finalStats;
}
