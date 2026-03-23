import { matchBlacklist, matchRiskTerms } from './blacklist.js';

const FULLWIDTH_RE = /[\uff01-\uff5e\u3000-\u303f\uff5f-\uff65]/;
const SPECIAL_CHAR_RE = /[^\u4e00-\u9fff\u3400-\u4dbf\w\s.,!?;:'"()\-\/\\@#$%&*+=<>[\]{}|~`^]/;

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
  const hasFullwidthPunctuation = !isEmpty && FULLWIDTH_RE.test(description);
  const hasSpecialChars = !isEmpty && SPECIAL_CHAR_RE.test(description);

  const issues = [];
  if (isEmpty) issues.push('description is empty');
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
  // (skip when description was never retrieved, e.g. --skip-descriptions or fetch failure)
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
