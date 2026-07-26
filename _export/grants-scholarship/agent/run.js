#!/usr/bin/env node
import 'dotenv/config';
import fs from 'fs';
import { runGrantsAgent } from './grants-agent.js';
import { getStats } from './storage.js';

const args = process.argv.slice(2);
const quiet = args.includes('--quiet') || args.includes('-q');

console.log('\n Grants & Opportunities Agent');
console.log('━'.repeat(40));

const before = getStats();
console.log(`Currently tracking: ${before.total} opportunities\n`);

const start = Date.now();
const newOpps = [];

// In GitHub Actions, write a markdown summary of the run to the job page.
function writeStepSummary(stats) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;

  const md = ['## Grants Agent Run', ''];
  md.push(`**${stats.saved} new** · ${stats.searches} searches · ${stats.skipped} duplicates skipped · ${stats.total} total tracked · ${stats.inputTokens + stats.outputTokens} tokens`);
  md.push('');

  if (newOpps.length > 0) {
    md.push('| Opportunity | Category | Amount | Deadline | Link |');
    md.push('|---|---|---|---|---|');
    for (const o of newOpps) {
      const title = `${o.title} (${o.organization})`.replace(/\|/g, '\\|');
      md.push(`| ${title} | ${o.category} | ${o.amount || '?'} | ${o.deadline || '?'} | [apply](${o.url}) |`);
    }
  } else {
    md.push('_No new opportunities found this run._');
  }

  fs.appendFileSync(summaryPath, md.join('\n') + '\n');
}

try {
  await runGrantsAgent({
    onProgress: msg => {
      if (!quiet) console.log(`  ${msg}`);
    },
    onOpportunity: opp => {
      newOpps.push(opp);
      console.log(`  ✓ ${opp.title} (${opp.organization})`);
    },
    onComplete: stats => {
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      console.log('\n' + '━'.repeat(40));
      console.log(' Agent Complete');
      console.log(`  Searches run:     ${stats.searches}`);
      console.log(`  New saved:        ${stats.saved}`);
      console.log(`  Duplicates:       ${stats.skipped}`);
      console.log(`  Errors:           ${stats.errors}`);
      console.log(`  Total in DB:      ${stats.total}`);
      console.log(`  Tokens:           ${stats.inputTokens} in / ${stats.outputTokens} out`);
      console.log(`  Time:             ${elapsed}s`);
      console.log('━'.repeat(40) + '\n');
      writeStepSummary(stats);
    }
  });

  // Individual search errors are recoverable; the run itself completed.
  process.exit(0);
} catch (err) {
  console.error('\n Error:', err.message);
  if (err.message.includes('GEMINI_API_KEY')) {
    console.error('  → Add GEMINI_API_KEY (env var or .env file)');
  }
  if (err.message.includes('BRAVE_API_KEY')) {
    console.error('  → Add BRAVE_API_KEY (env var or .env file)');
    console.error('  → Get a free key at https://api.search.brave.com/app/keys');
  }
  process.exit(1);
}
