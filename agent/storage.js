import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, '../data/opportunities.json');

function ensureDir() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function loadOpportunities() {
  ensureDir();
  if (!fs.existsSync(DATA_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return [];
  }
}

export function saveOpportunity(opp) {
  const opps = loadOpportunities();
  const idx = opps.findIndex(o => o.url === opp.url);
  const now = new Date().toISOString();

  if (idx >= 0) {
    opps[idx] = { ...opps[idx], ...opp, updatedAt: now };
  } else {
    opps.unshift({
      ...opp,
      id: `opp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      discoveredAt: now,
      updatedAt: now
    });
  }

  ensureDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(opps, null, 2));
  return opps;
}

export function getStats() {
  const opps = loadOpportunities();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const byCategory = {};
  for (const o of opps) {
    byCategory[o.category] = (byCategory[o.category] || 0) + 1;
  }

  return {
    total: opps.length,
    newThisWeek: opps.filter(o => new Date(o.discoveredAt) > weekAgo).length,
    open: opps.filter(o => o.status === 'open' || o.status === 'rolling').length,
    byCategory,
    lastUpdated: opps.length > 0 ? opps[0].updatedAt : null
  };
}
