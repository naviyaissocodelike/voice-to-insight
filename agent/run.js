#!/usr/bin/env node
import 'dotenv/config';
import { runGrantsAgent } from './grants-agent.js';
import { getStats } from './storage.js';

const args = process.argv.slice(2);
const quiet = args.includes('--quiet') || args.includes('-q');

console.log('\n Grants & Opportunities Agent');
console.log('━'.repeat(40));

const before = getStats();
console.log(`Currently tracking: ${before.total} opportunities\n`);

const start = Date.now();

try {
  const result = await runGrantsAgent({
    onProgress: msg => {
      if (!quiet) console.log(`  ${msg}`);
    },
    onOpportunity: opp => {
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
      console.log(`  Time:             ${elapsed}s`);
      console.log('━'.repeat(40) + '\n');
    }
  });

  process.exit(result.errors > 0 ? 1 : 0);
} catch (err) {
  console.error('\n Error:', err.message);
  if (err.message.includes('ANTHROPIC_API_KEY')) {
    console.error('  → Add ANTHROPIC_API_KEY to your .env file');
  }
  if (err.message.includes('BRAVE_API_KEY')) {
    console.error('  → Add BRAVE_API_KEY to your .env file');
    console.error('  → Get a free key at https://api.search.brave.com/app/keys');
  }
  process.exit(1);
}
