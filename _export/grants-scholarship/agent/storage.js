import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, '../data/opportunities.json');
const HISTORY_FILE = path.join(__dirname, '../data/run-history.json');

const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'ref', 'fbclid', 'gclid', 'mc_cid', 'mc_eid'
]);

// Canonical form for dedup: https, lowercase host, no tracking params, no trailing slash.
// Returns null for anything that isn't a plain http(s) URL (blocks javascript: etc.).
export function normalizeUrl(raw) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;

  u.protocol = 'https:';
  u.hostname = u.hostname.toLowerCase().replace(/^www\./, '');
  u.hash = '';
  for (const param of [...u.searchParams.keys()]) {
    if (TRACKING_PARAMS.has(param)) u.searchParams.delete(param);
  }
  let s = u.toString();
  if (s.endsWith('/')) s = s.slice(0, -1);
  return s;
}

function ensureDir() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// A dated deadline in the past means the opportunity is closed regardless of
// what status was recorded when it was discovered.
function withEffectiveStatus(opp) {
  if (opp.deadline && /^\d{4}-\d{2}-\d{2}$/.test(opp.deadline)) {
    if (new Date(opp.deadline) < new Date()) {
      return { ...opp, status: 'closed' };
    }
  }
  return opp;
}

export function loadOpportunities() {
  ensureDir();
  if (!fs.existsSync(DATA_FILE)) return [];
  try {
    const opps = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    return opps.map(withEffectiveStatus);
  } catch {
    return [];
  }
}

export function saveOpportunity(opp) {
  const normalized = normalizeUrl(opp.url);
  if (!normalized) {
    throw new Error(`Invalid or unsafe URL: ${opp.url}`);
  }

  ensureDir();
  let opps = [];
  if (fs.existsSync(DATA_FILE)) {
    try {
      opps = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch {
      opps = [];
    }
  }

  const record = { ...opp, url: normalized, normalizedUrl: normalized };
  const idx = opps.findIndex(o => (o.normalizedUrl || normalizeUrl(o.url)) === normalized);
  const now = new Date().toISOString();

  if (idx >= 0) {
    opps[idx] = { ...opps[idx], ...record, updatedAt: now };
  } else {
    opps.unshift({
      ...record,
      id: `opp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      discoveredAt: now,
      updatedAt: now
    });
  }

  fs.writeFileSync(DATA_FILE, JSON.stringify(opps, null, 2));
  return opps;
}

// Run history powers incremental searching: each run records the queries it
// used so the next run can avoid repeating them and hunt for fresh angles.
export function loadRunHistory() {
  if (!fs.existsSync(HISTORY_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
  } catch {
    return [];
  }
}

export function recordRun({ saved, searches, queries }) {
  ensureDir();
  const history = loadRunHistory();
  history.push({
    at: new Date().toISOString(),
    saved,
    searches,
    queries: queries.slice(0, 60)
  });
  // Keep the last 30 runs — enough query memory without unbounded growth
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history.slice(-30), null, 2));
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
    closed: opps.filter(o => o.status === 'closed').length,
    byCategory,
    lastUpdated: opps.length > 0 ? opps[0].updatedAt : null
  };
}
