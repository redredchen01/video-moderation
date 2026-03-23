import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { matchBlacklist, matchRiskTerms } from './blacklist.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, '..', 'data', 'blacklist.json');

// Load description rules from JSON (with sensible defaults)
function loadDescriptionRules() {
  try {
    const raw = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
    const rules = raw.description_rules || {};
    return {
      flagEmpty: rules.flag_empty !== false,
      flagFullwidth: rules.flag_fullwidth_punctuation !== false,
      flagSpecialChars: rules.flag_special_chars !== false,
      fullwidthRe: new RegExp(rules.fullwidth_regex || '[\\uff01-\\uff5e\\u3000-\\u303f\\uff5f-\\uff65]'),
      specialCharRe: new RegExp(rules.special_char_regex || '[^\\u4e00-\\u9fff\\u3400-\\u4dbf\\w\\s.,!?;:\'"()\\-\\/\\\\@#$%&*+=<>\\[\\]{}|~`^]'),
    };
  } catch {
    return {
      flagEmpty: true,
      flagFullwidth: true,
      flagSpecialChars: true,
      fullwidthRe: /[\uff01-\uff5e\u3000-\u303f\uff5f-\uff65]/,
      specialCharRe: /[^\u4e00-\u9fff\u3400-\u4dbf\w\s.,!?;:'"()\-\/\\@#$%&*+=<>[\]{}|~`^]/,
    };
  }
}

const descRules = loadDescriptionRules();

const CHECK_FIELDS = [
  { field: 'title', flagType: 'title_blacklist', matcher: matchBlacklist, target: 'violations' },
  { field: 'tags',  flagType: 'tag_blacklist',   matcher: matchBlacklist, target: 'violations' },
  { field: 'description', flagType: 'description_blacklist', matcher: matchBlacklist, target: 'violations', optional: true },
  { field: 'title', flagType: 'title_risk', matcher: matchRiskTerms, target: 'risks' },
  { field: 'tags',  flagType: 'tag_risk',   matcher: matchRiskTerms, target: 'risks' },
  { field: 'description', flagType: 'description_risk', matcher: matchRiskTerms, target: 'risks', optional: true },
];

export function checkDescription(description) {
  const isEmpty = !description || description.trim().length === 0;
  const hasFullwidthPunctuation = !isEmpty && descRules.flagFullwidth && descRules.fullwidthRe.test(description);
  const hasSpecialChars = !isEmpty && descRules.flagSpecialChars && descRules.specialCharRe.test(description);

  const issues = [];
  if (isEmpty && descRules.flagEmpty) issues.push('description is empty');
  if (hasFullwidthPunctuation) issues.push('contains fullwidth punctuation');
  if (hasSpecialChars) issues.push('contains special characters');

  return { isEmpty, hasFullwidthPunctuation, hasSpecialChars, issues };
}

export function checkVideo(video) {
  const violations = [];
  const risks = [];

  for (const { field, flagType, matcher, target, optional } of CHECK_FIELDS) {
    const value = video[field];
    if (optional && !value) continue;

    const result = matcher(value);
    if (result.matched) {
      (target === 'violations' ? violations : risks).push({
        type: flagType,
        field,
        value,
        keywords: result.keywords,
        categories: result.categories,
      });
    }
  }

  // Description format check — only if description was actually fetched
  if (video.descriptionFetched) {
    const descResult = checkDescription(video.description);
    if (descResult.issues.length > 0) {
      violations.push({
        type: 'description_format',
        field: 'description',
        value: video.description,
        issues: descResult.issues,
      });
    }
  }

  return {
    videoId: video.id,
    hasViolation: violations.length > 0,
    hasRisk: risks.length > 0,
    violations,
    risks,
  };
}
