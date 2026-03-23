// src/dashboard.js — Generate an HTML dashboard report from scan results
import fs from 'fs';
import path from 'path';
import { CONFIG } from './config.js';

const JSON_PATH = CONFIG.latestJsonReportPath;

function loadData() {
  if (!fs.existsSync(JSON_PATH)) {
    throw new Error(`No report found at ${JSON_PATH}. Run a scan first.`);
  }
  return JSON.parse(fs.readFileSync(JSON_PATH, 'utf-8'));
}

function escapeHtml(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function analyze(records) {
  const totalRecords = records.length;
  const uniqueVideoIds = new Set(records.map(r => r.videoId));
  const totalVideos = uniqueVideoIds.size;

  // By severity
  const bySeverity = {};
  for (const r of records) {
    bySeverity[r.severity] = (bySeverity[r.severity] || 0) + 1;
  }

  // By flag type
  const byFlagType = {};
  for (const r of records) {
    byFlagType[r.flagType] = (byFlagType[r.flagType] || 0) + 1;
  }

  // By category
  const byCategory = {};
  for (const r of records) {
    for (const c of r.categories.split(', ').filter(Boolean)) {
      byCategory[c] = (byCategory[c] || 0) + 1;
    }
  }

  // Keyword frequency
  const kwCount = {};
  for (const r of records) {
    for (const kw of r.matchedKeywords.split(', ').filter(Boolean)) {
      kwCount[kw] = (kwCount[kw] || 0) + 1;
    }
  }
  const topKeywords = Object.entries(kwCount).sort((a, b) => b[1] - a[1]).slice(0, 30);

  // Severity x Category cross-tab
  const severityCategory = {};
  for (const r of records) {
    for (const c of r.categories.split(', ').filter(Boolean)) {
      const key = `${r.severity}|${c}`;
      severityCategory[key] = (severityCategory[key] || 0) + 1;
    }
  }

  // Per-video flag count
  const videoFlags = {};
  for (const r of records) {
    if (!videoFlags[r.videoId]) {
      videoFlags[r.videoId] = { violations: 0, risks: 0, title: r.title, tags: r.tags, id: r.videoId, coverPath: r.coverPath };
    }
    if (r.severity === 'VIOLATION') videoFlags[r.videoId].violations++;
    else videoFlags[r.videoId].risks++;
  }

  // Videos sorted by severity
  const videoList = Object.values(videoFlags);
  const topFlagged = [...videoList].sort((a, b) => (b.violations * 10 + b.risks) - (a.violations * 10 + a.risks)).slice(0, 50);

  // Violation-only videos
  const violationVideos = videoList.filter(v => v.violations > 0);
  violationVideos.sort((a, b) => b.violations - a.violations);

  // Category labels (Chinese)
  const categoryLabels = {
    underage: '未成年內容',
    violence: '暴力/強制',
    animal: '獸交',
    gore: '血腥',
    risk_age: '年齡擦邊',
    risk_consent: '偷拍/非自願',
    risk_incest: '亂倫相關',
  };

  return {
    totalRecords, totalVideos, bySeverity, byFlagType, byCategory,
    topKeywords, severityCategory, topFlagged, violationVideos,
    categoryLabels, timestamp: records[0]?.timestamp || new Date().toISOString(),
  };
}

function generateDashboard(stats) {
  const {
    totalRecords, totalVideos, bySeverity, byFlagType, byCategory,
    topKeywords, topFlagged, violationVideos, categoryLabels, timestamp,
  } = stats;

  const violationCount = bySeverity['VIOLATION'] || 0;
  const riskCount = bySeverity['RISK'] || 0;

  // Category bars
  const maxCatCount = Math.max(...Object.values(byCategory));
  const categoryBars = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, count]) => {
      const pct = (count / maxCatCount * 100).toFixed(1);
      const label = categoryLabels[cat] || cat;
      const color = cat.startsWith('risk_') ? '#ff9800' : '#f44336';
      return `<div class="bar-row">
        <span class="bar-label">${escapeHtml(label)}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${color}"></div></div>
        <span class="bar-count">${count}</span>
      </div>`;
    }).join('\n');

  // Keyword bars
  const maxKwCount = topKeywords[0]?.[1] || 1;
  const keywordBars = topKeywords.map(([kw, count]) => {
    const pct = (count / maxKwCount * 100).toFixed(1);
    return `<div class="bar-row">
      <span class="bar-label">${escapeHtml(kw)}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:#2196F3"></div></div>
      <span class="bar-count">${count}</span>
    </div>`;
  }).join('\n');

  // Flag type bars
  const maxFtCount = Math.max(...Object.values(byFlagType));
  const flagTypeBars = Object.entries(byFlagType)
    .sort((a, b) => b[1] - a[1])
    .map(([ft, count]) => {
      const pct = (count / maxFtCount * 100).toFixed(1);
      const color = ft.includes('blacklist') ? '#f44336' : '#ff9800';
      const label = ft.replace('_', ' → ').replace('blacklist', 'VIOLATION').replace('risk', 'RISK');
      return `<div class="bar-row">
        <span class="bar-label">${escapeHtml(label)}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${color}"></div></div>
        <span class="bar-count">${count}</span>
      </div>`;
    }).join('\n');

  // Violation table rows
  const violationRows = violationVideos.slice(0, 100).map(v => {
    const coverRel = v.coverPath ? path.relative(CONFIG.outputDir, path.resolve(v.coverPath)) : '';
    const coverImg = coverRel ? `<img src="${escapeHtml(coverRel)}" class="thumb" loading="lazy"/>` : '';
    return `<tr>
      <td>${escapeHtml(v.id)}</td>
      <td>${coverImg}</td>
      <td title="${escapeHtml(v.title)}">${escapeHtml(v.title.substring(0, 60))}${v.title.length > 60 ? '...' : ''}</td>
      <td>${escapeHtml(v.tags.substring(0, 40))}</td>
      <td class="num violation">${v.violations}</td>
      <td class="num risk">${v.risks}</td>
    </tr>`;
  }).join('\n');

  // Top flagged table rows
  const topRows = topFlagged.map(v => {
    const coverRel = v.coverPath ? path.relative(CONFIG.outputDir, path.resolve(v.coverPath)) : '';
    const coverImg = coverRel ? `<img src="${escapeHtml(coverRel)}" class="thumb" loading="lazy"/>` : '';
    return `<tr class="${v.violations > 0 ? 'row-violation' : 'row-risk'}">
      <td>${escapeHtml(v.id)}</td>
      <td>${coverImg}</td>
      <td title="${escapeHtml(v.title)}">${escapeHtml(v.title.substring(0, 60))}${v.title.length > 60 ? '...' : ''}</td>
      <td class="num violation">${v.violations}</td>
      <td class="num risk">${v.risks}</td>
    </tr>`;
  }).join('\n');

  const scanDate = new Date(timestamp).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });

  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>內容審核報告 — Moderation Dashboard</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    background: #0d1117; color: #e6edf3; line-height: 1.6; }
  .container { max-width: 1400px; margin: 0 auto; padding: 24px; }

  header { text-align: center; margin-bottom: 32px; padding: 32px 0; border-bottom: 1px solid #30363d; }
  header h1 { font-size: 28px; margin-bottom: 8px; }
  header .meta { color: #8b949e; font-size: 14px; }

  /* KPI Cards */
  .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 32px; }
  .kpi { background: #161b22; border: 1px solid #30363d; border-radius: 12px; padding: 24px; text-align: center; }
  .kpi .number { font-size: 42px; font-weight: 700; line-height: 1.2; }
  .kpi .label { font-size: 14px; color: #8b949e; margin-top: 4px; }
  .kpi.violation .number { color: #f85149; }
  .kpi.risk .number { color: #d29922; }
  .kpi.clean .number { color: #3fb950; }
  .kpi.total .number { color: #58a6ff; }

  /* Section */
  .section { background: #161b22; border: 1px solid #30363d; border-radius: 12px; padding: 24px; margin-bottom: 24px; }
  .section h2 { font-size: 18px; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid #30363d; }

  /* Two column layout */
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
  @media (max-width: 900px) { .two-col { grid-template-columns: 1fr; } }

  /* Bar chart */
  .bar-row { display: flex; align-items: center; margin-bottom: 8px; }
  .bar-label { width: 140px; font-size: 13px; text-align: right; padding-right: 12px; flex-shrink: 0; color: #c9d1d9; }
  .bar-track { flex: 1; height: 24px; background: #21262d; border-radius: 4px; overflow: hidden; }
  .bar-fill { height: 100%; border-radius: 4px; transition: width 0.5s; min-width: 2px; }
  .bar-count { width: 50px; text-align: right; font-size: 13px; font-weight: 600; padding-left: 8px; color: #c9d1d9; }

  /* Tables */
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; padding: 10px 8px; border-bottom: 2px solid #30363d; color: #8b949e; font-weight: 600; }
  td { padding: 8px; border-bottom: 1px solid #21262d; vertical-align: middle; }
  tr:hover { background: #1c2128; }
  .row-violation { border-left: 3px solid #f85149; }
  .row-risk { border-left: 3px solid #d29922; }
  .num { text-align: center; font-weight: 700; }
  .num.violation { color: #f85149; }
  .num.risk { color: #d29922; }
  .thumb { width: 60px; height: 40px; object-fit: cover; border-radius: 4px; }

  /* Donut */
  .donut-wrap { display: flex; align-items: center; justify-content: center; gap: 32px; margin: 16px 0; }
  .donut-legend { font-size: 14px; }
  .donut-legend .dot { display: inline-block; width: 12px; height: 12px; border-radius: 50%; margin-right: 6px; }
  .donut-legend div { margin-bottom: 6px; }

  .severity-summary { display: flex; justify-content: center; gap: 48px; margin: 16px 0; font-size: 16px; }
  .severity-summary .item { text-align: center; }
  .severity-summary .item .val { font-size: 32px; font-weight: 700; }

  /* Search & Filter */
  .filter-bar { display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; align-items: center; }
  .filter-bar input[type="text"] { flex: 1; min-width: 200px; padding: 8px 12px; border-radius: 6px;
    border: 1px solid #30363d; background: #0d1117; color: #e6edf3; font-size: 14px; outline: none; }
  .filter-bar input[type="text"]:focus { border-color: #58a6ff; }
  .filter-bar .btn { padding: 8px 16px; border-radius: 6px; border: 1px solid #30363d; background: #21262d;
    color: #c9d1d9; cursor: pointer; font-size: 13px; transition: all 0.15s; }
  .filter-bar .btn:hover { background: #30363d; }
  .filter-bar .btn.active { background: #58a6ff; color: #0d1117; border-color: #58a6ff; }
  .filter-bar .btn.active-v { background: #f85149; color: white; border-color: #f85149; }
  .filter-bar .btn.active-r { background: #d29922; color: white; border-color: #d29922; }
  .match-count { color: #8b949e; font-size: 13px; margin-left: auto; }
</style>
</head>
<body>
<div class="container">

<header>
  <h1>內容審核總覽報告</h1>
  <div class="meta">掃描時間：${escapeHtml(scanDate)} | 資料來源：${escapeHtml(CONFIG.baseUrl)}</div>
</header>

<!-- KPI Cards -->
<div class="kpi-grid">
  <div class="kpi total"><div class="number">${(stats.totalScanned || totalVideos).toLocaleString()}</div><div class="label">掃描影片總數</div></div>
  <div class="kpi violation"><div class="number">${violationVideos.length}</div><div class="label">硬違規影片</div></div>
  <div class="kpi risk"><div class="number">${totalVideos - violationVideos.length}</div><div class="label">風險標記影片</div></div>
  <div class="kpi clean"><div class="number">${((stats.totalScanned || totalVideos) - totalVideos).toLocaleString()}</div><div class="label">通過（乾淨）</div></div>
</div>

<!-- Severity Breakdown -->
<div class="section">
  <h2>嚴重度分佈</h2>
  <div class="severity-summary">
    <div class="item"><div class="val" style="color:#f85149">${violationCount}</div><div>VIOLATION 記錄</div></div>
    <div class="item"><div class="val" style="color:#d29922">${riskCount}</div><div>RISK 記錄</div></div>
    <div class="item"><div class="val" style="color:#58a6ff">${totalRecords}</div><div>總記錄數</div></div>
  </div>
  <p style="color:#8b949e;text-align:center;font-size:13px;">（一支影片可能同時有多筆 VIOLATION 和 RISK 記錄）</p>
</div>

<div class="two-col">
  <!-- Category Distribution -->
  <div class="section">
    <h2>違規類別分佈</h2>
    ${categoryBars}
  </div>

  <!-- Flag Type Distribution -->
  <div class="section">
    <h2>觸發來源（標題 vs 標籤）</h2>
    ${flagTypeBars}
  </div>
</div>

<!-- Keyword Ranking -->
<div class="section">
  <h2>關鍵字命中排行 Top 30</h2>
  ${keywordBars}
</div>

<!-- Top Flagged Videos -->
<div class="section">
  <h2>最高風險影片 Top 50</h2>
  <div class="filter-bar">
    <input type="text" id="searchTop" placeholder="搜尋 ID 或標題..." oninput="filterTable('topTable','searchTop','filterTop')">
    <button class="btn active" data-filter="all" onclick="setFilter('filterTop',this,'topTable','searchTop')">全部</button>
    <button class="btn" data-filter="violation" onclick="setFilter('filterTop',this,'topTable','searchTop')">VIOLATION</button>
    <button class="btn" data-filter="risk" onclick="setFilter('filterTop',this,'topTable','searchTop')">RISK</button>
    <span class="match-count" id="countTop"></span>
  </div>
  <table id="topTable">
    <thead><tr><th>ID</th><th>封面</th><th>標題</th><th>VIOLATION</th><th>RISK</th></tr></thead>
    <tbody>${topRows}</tbody>
  </table>
</div>

<!-- All Violations Table -->
<div class="section">
  <h2>硬違規影片清單（前 100 筆）</h2>
  <div class="filter-bar">
    <input type="text" id="searchViol" placeholder="搜尋 ID、標題或標籤..." oninput="filterTable('violTable','searchViol','filterViol')">
    <span class="match-count" id="countViol"></span>
  </div>
  <table id="violTable">
    <thead><tr><th>ID</th><th>封面</th><th>標題</th><th>標籤</th><th>VIOLATION</th><th>RISK</th></tr></thead>
    <tbody>${violationRows}</tbody>
  </table>
</div>

<footer style="text-align:center;color:#484f58;font-size:12px;margin-top:32px;padding:16px 0;border-top:1px solid #21262d;">
  Generated by Video Content Moderation Tool | ${escapeHtml(scanDate)}
</footer>

</div>
<script>
const filters = { filterTop: 'all', filterViol: 'all' };

function setFilter(filterKey, btn, tableId, searchId) {
  filters[filterKey] = btn.dataset.filter;
  btn.parentElement.querySelectorAll('.btn').forEach(b => {
    b.className = 'btn';
  });
  const f = btn.dataset.filter;
  btn.className = 'btn ' + (f === 'all' ? 'active' : f === 'violation' ? 'active-v' : 'active-r');
  filterTable(tableId, searchId, filterKey);
}

function filterTable(tableId, searchId, filterKey) {
  const table = document.getElementById(tableId);
  const searchInput = document.getElementById(searchId);
  const query = (searchInput?.value || '').toLowerCase();
  const severity = filters[filterKey] || 'all';
  const rows = table.querySelectorAll('tbody tr');
  let shown = 0;

  rows.forEach(row => {
    const text = row.textContent.toLowerCase();
    const matchSearch = !query || text.includes(query);
    let matchFilter = true;

    if (severity !== 'all') {
      const isViolation = row.classList.contains('row-violation');
      const isRisk = row.classList.contains('row-risk');
      if (severity === 'violation') matchFilter = isViolation;
      else if (severity === 'risk') matchFilter = isRisk && !isViolation;
    }

    const visible = matchSearch && matchFilter;
    row.style.display = visible ? '' : 'none';
    if (visible) shown++;
  });

  const countId = tableId === 'topTable' ? 'countTop' : 'countViol';
  const countEl = document.getElementById(countId);
  if (countEl) countEl.textContent = shown + ' / ' + rows.length + ' 筆';
}

// Init counts
filterTable('topTable', 'searchTop', 'filterTop');
filterTable('violTable', 'searchViol', 'filterViol');
</script>
</body>
</html>`;
}

/** Generate dashboard from in-memory records (called by main.js) */
export function generateDashboardFromData(records, totalScanned) {
  const stats = analyze(records);
  stats.totalScanned = totalScanned;
  const html = generateDashboard(stats);
  const outputPath = path.join(CONFIG.outputDir, 'dashboard.html');
  fs.writeFileSync(outputPath, html, 'utf-8');
  console.log(`[dashboard] Report generated: ${outputPath}`);
  return outputPath;
}

// Standalone mode: node src/dashboard.js
const isMain = process.argv[1]?.endsWith('dashboard.js');
if (isMain) {
  const records = loadData();
  const stats = analyze(records);
  const html = generateDashboard(stats);
  const outputPath = path.join(CONFIG.outputDir, 'dashboard.html');
  fs.writeFileSync(outputPath, html, 'utf-8');
  console.log(`[dashboard] Report generated: ${outputPath}`);
  console.log(`[dashboard] Open in browser: file://${path.resolve(outputPath)}`);
}
