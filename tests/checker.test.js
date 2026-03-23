import { describe, it } from 'node:test';
import assert from 'node:assert';
import { checkVideo, checkDescription } from '../src/checker.js';

describe('checkDescription', () => {
  it('flags empty description', () => {
    const result = checkDescription('');
    assert.ok(result.isEmpty);
  });

  it('flags fullwidth punctuation', () => {
    const result = checkDescription('这是描述，包含全角标点。');
    assert.ok(result.hasFullwidthPunctuation);
  });

  it('flags special characters', () => {
    const result = checkDescription('描述包含★特殊符号♂');
    assert.ok(result.hasSpecialChars);
  });

  it('passes clean description', () => {
    const result = checkDescription('This is a normal description');
    assert.strictEqual(result.issues.length, 0);
  });
});

describe('checkVideo — hard violations', () => {
  it('flags blacklisted title', () => {
    const video = { id: '1', title: '高中生视频', tags: '', description: 'ok' };
    const result = checkVideo(video);
    assert.ok(result.hasViolation);
    assert.ok(result.violations.some(v => v.type === 'title_blacklist'));
  });

  it('flags blacklisted tags', () => {
    const video = { id: '2', title: 'ok', tags: '迷奸,下药', description: 'ok' };
    const result = checkVideo(video);
    assert.ok(result.hasViolation);
    assert.ok(result.violations.some(v => v.type === 'tag_blacklist'));
  });

  it('no violation for clean video', () => {
    const video = { id: '3', title: 'normal', tags: 'tag1', description: 'ok' };
    const result = checkVideo(video);
    assert.ok(!result.hasViolation);
  });
});

describe('checkVideo — risk flags', () => {
  it('flags risk terms in title', () => {
    const video = { id: '4', title: '十八岁嫩妹下海', tags: '', description: '' };
    const result = checkVideo(video);
    assert.ok(result.hasRisk);
    assert.ok(result.risks.some(r => r.type === 'title_risk'));
    assert.ok(result.risks[0].keywords.includes('嫩妹'));
  });

  it('flags risk terms in tags', () => {
    const video = { id: '5', title: 'normal', tags: '少女,美腿', description: '' };
    const result = checkVideo(video);
    assert.ok(result.hasRisk);
    assert.ok(result.risks.some(r => r.type === 'tag_risk'));
  });

  it('flags 偷拍 in tags', () => {
    const video = { id: '6', title: 'normal', tags: '探花,偷拍,酒店', description: '' };
    const result = checkVideo(video);
    assert.ok(result.hasRisk);
    assert.ok(result.risks[0].keywords.includes('偷拍'));
  });

  it('no risk for clean adult content', () => {
    const video = { id: '7', title: '极品美腿女神约会', tags: '美腿,女神', description: '' };
    const result = checkVideo(video);
    assert.ok(!result.hasRisk);
  });

  it('empty description IS a format violation when fetched', () => {
    const video = { id: '8', title: 'normal', tags: 'tag1', description: '', descriptionFetched: true };
    const result = checkVideo(video);
    assert.ok(result.hasViolation);
    assert.ok(result.violations.some(v => v.type === 'description_format'));
  });

  it('empty description is NOT a violation when not fetched', () => {
    const video = { id: '8b', title: 'normal', tags: 'tag1', description: '' };
    const result = checkVideo(video);
    assert.ok(!result.hasViolation);
  });
});

describe('checkVideo — combined', () => {
  it('can have both violation and risk', () => {
    const video = { id: '9', title: '强奸少女视频', tags: '偷拍', description: '', descriptionFetched: true };
    const result = checkVideo(video);
    assert.ok(result.hasViolation);
    assert.ok(result.hasRisk);
    assert.ok(result.violations.some(v => v.categories.includes('violence')));
    assert.ok(result.risks.some(r => r.categories.includes('risk_age')));
  });
});
