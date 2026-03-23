import { describe, it } from 'node:test';
import assert from 'node:assert';
import { matchBlacklist, matchRiskTerms, BLACKLIST, RISK_TERMS } from '../src/blacklist.js';

describe('matchBlacklist (hard violations)', () => {
  it('detects underage keywords', () => {
    const result = matchBlacklist('这是一个高中生的视频');
    assert.ok(result.matched);
    assert.ok(result.keywords.includes('高中生'));
  });

  it('detects age keywords', () => {
    const result = matchBlacklist('15岁少女');
    assert.ok(result.matched);
    assert.ok(result.keywords.includes('15岁'));
  });

  it('detects violence keywords', () => {
    const result = matchBlacklist('强奸内容');
    assert.ok(result.matched);
    assert.ok(result.keywords.includes('强奸'));
  });

  it('detects animal keywords', () => {
    const result = matchBlacklist('人兽交配视频');
    assert.ok(result.matched);
    assert.ok(result.keywords.includes('人兽'));
  });

  it('does not false-positive on common words', () => {
    const result = matchBlacklist('牛逼的技术马上就来');
    assert.ok(!result.matched);
  });

  it('detects drug/drunk keywords', () => {
    const result = matchBlacklist('迷奸下药');
    assert.ok(result.matched);
    assert.ok(result.keywords.some(k => ['迷奸', '下药'].includes(k)));
  });

  it('returns no match for clean text', () => {
    const result = matchBlacklist('正常的成人视频标题');
    assert.ok(!result.matched);
    assert.strictEqual(result.keywords.length, 0);
  });

  it('handles empty string', () => {
    const result = matchBlacklist('');
    assert.ok(!result.matched);
  });

  it('catches any text containing 奸 character', () => {
    for (const text of ['轮奸', '诱奸', '奸污', '通奸视频', '奸杀']) {
      const result = matchBlacklist(text);
      assert.ok(result.matched, `should match: ${text}`);
      assert.ok(result.categories.includes('violence'), `${text} should be violence`);
    }
  });

  it('catches 强 prefix patterns', () => {
    for (const text of ['强干', '强入', '强迫', '强制', '强行']) {
      const result = matchBlacklist(text);
      assert.ok(result.matched, `should match: ${text}`);
    }
  });

  it('does not false-positive 强 in normal words', () => {
    for (const text of ['强大的力量', '强调重点', '增强体质', '坚强的意志']) {
      const result = matchBlacklist(text);
      assert.ok(!result.matched, `should NOT match: ${text}`);
    }
  });

  it('catches 强 + violence even when safe words coexist', () => {
    const result = matchBlacklist('他强干了人之后变得更坚强');
    assert.ok(result.matched);
  });
});

describe('matchRiskTerms (soft flags)', () => {
  it('detects age-ambiguous terms', () => {
    const result = matchRiskTerms('少女,美腿,巨乳');
    assert.ok(result.matched);
    assert.ok(result.keywords.includes('少女'));
    assert.ok(result.categories.includes('risk_age'));
  });

  it('detects 嫩妹 in title', () => {
    const result = matchRiskTerms('十八岁嫩妹休学下海');
    assert.ok(result.matched);
    assert.ok(result.keywords.includes('嫩妹'));
    assert.ok(result.keywords.includes('下海'));
    assert.ok(result.keywords.includes('十八岁'));
  });

  it('detects non-consensual recording terms', () => {
    const result = matchRiskTerms('偷拍酒店女神');
    assert.ok(result.matched);
    assert.ok(result.keywords.includes('偷拍'));
    assert.ok(result.categories.includes('risk_consent'));
  });

  it('detects exploitation terms', () => {
    const result = matchRiskTerms('猎艳师约美女');
    assert.ok(result.matched);
    assert.ok(result.keywords.includes('猎艳'));
  });

  it('detects incest terms', () => {
    const result = matchRiskTerms('继母诱惑');
    assert.ok(result.matched);
    assert.ok(result.categories.includes('risk_incest'));
  });

  it('detects school uniform terms', () => {
    const result = matchRiskTerms('校服制服诱惑');
    assert.ok(result.matched);
    assert.ok(result.keywords.includes('校服'));
    assert.ok(result.keywords.includes('制服诱惑'));
  });

  it('does not flag clean adult content', () => {
    const result = matchRiskTerms('极品美腿女神酒店约会');
    assert.ok(!result.matched);
  });

  it('handles empty string', () => {
    const result = matchRiskTerms('');
    assert.ok(!result.matched);
  });
});
