import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, '..', 'data', 'blacklist.json');

// === Load keyword data from JSON (hot-reloadable) ===

function loadData() {
  const raw = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));

  const violationEntries = Object.entries(raw.violations);
  const riskEntries = Object.entries(raw.risks);

  const blacklistMap = buildCategoryMap(violationEntries);
  const riskMap = buildCategoryMap(riskEntries);

  const violencePatterns = (raw.violence_patterns || []).map(p => ({
    re: new RegExp(p.regex),
    desc: p.desc,
  }));
  const violenceSafeWords = raw.violence_safe_words || [];

  return { blacklistMap, riskMap, violencePatterns, violenceSafeWords, raw };
}

function buildCategoryMap(entries) {
  const map = new Map();
  for (const [category, keywords] of entries) {
    for (const kw of keywords) map.set(kw, category);
  }
  return map;
}

// Load once at startup
let data = loadData();

/** Reload blacklist data from JSON file. Call this to pick up changes without restarting. */
export function reloadBlacklist() {
  data = loadData();
  console.log('[blacklist] Reloaded from', DATA_PATH);
}

export const BLACKLIST = () => data.raw.violations;
export const RISK_TERMS = () => data.raw.risks;

// === Matching logic ===

function matchKeywords(text, categoryMap) {
  const found = [];
  const cats = new Set();

  if (!text || typeof text !== 'string') return { found, cats };

  for (const [kw, cat] of categoryMap) {
    if (text.includes(kw)) {
      found.push(kw);
      cats.add(cat);
    }
  }

  return { found, cats };
}

export function matchBlacklist(text) {
  if (!text || typeof text !== 'string') {
    return { matched: false, keywords: [], categories: [] };
  }

  const { found, cats } = matchKeywords(text, data.blacklistMap);

  // Pattern matching — violence (sanitize safe words first)
  let sanitized = text;
  for (const sw of data.violenceSafeWords) {
    sanitized = sanitized.replaceAll(sw, '\u25A1'.repeat(sw.length));
  }
  for (const { re, desc } of data.violencePatterns) {
    if (re.test(sanitized)) {
      found.push(desc);
      cats.add('violence');
    }
  }

  return {
    matched: found.length > 0,
    keywords: [...new Set(found)],
    categories: [...cats],
  };
}

export function matchRiskTerms(text) {
  const { found, cats } = matchKeywords(text, data.riskMap);
  return {
    matched: found.length > 0,
    keywords: [...new Set(found)],
    categories: [...cats],
  };
}
