// src/cover-analyzer.js
import fs from 'fs';
import path from 'path';
import { CONFIG } from './config.js';

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function generateCoverReviewPage(videos) {
  const coversWithImages = videos.filter(v => v.coverLocalPath && fs.existsSync(v.coverLocalPath));

  if (coversWithImages.length === 0) {
    console.log('[cover-analyzer] No cover images to review.');
    return null;
  }

  const cards = coversWithImages.map(v => {
    const relPath = path.relative(CONFIG.outputDir, path.resolve(v.coverLocalPath));
    const safeTitle = escapeHtml(v.title || '');
    const safeId = escapeHtml(v.id);
    return `
      <div class="card" data-id="${safeId}" onclick="toggleFlag(this)">
        <img src="${escapeHtml(relPath)}" alt="${safeId}" loading="lazy" />
        <div class="info">
          <span class="vid">${safeId}</span>
          <span class="title" title="${safeTitle}">${safeTitle.substring(0, 30)}</span>
        </div>
        <div class="flag-badge">FLAGGED</div>
      </div>`;
  }).join('\n');

  const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<title>封面審查 — Cover Review</title>
<style>
  body { font-family: system-ui; background: #1a1a1a; color: #eee; margin: 20px; }
  h1 { text-align: center; }
  .toolbar { text-align: center; margin: 20px 0; }
  .toolbar button { padding: 10px 24px; font-size: 16px; cursor: pointer; margin: 0 8px;
    background: #4CAF50; color: white; border: none; border-radius: 6px; }
  .toolbar button.danger { background: #f44336; }
  .toolbar .count { font-size: 18px; margin: 0 16px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
  .card { position: relative; cursor: pointer; border: 3px solid transparent;
    border-radius: 8px; overflow: hidden; transition: border-color 0.2s; }
  .card:hover { border-color: #666; }
  .card.flagged { border-color: #f44336; }
  .card img { width: 100%; height: 150px; object-fit: cover; display: block; }
  .info { padding: 6px 8px; background: #333; font-size: 12px; }
  .vid { font-weight: bold; margin-right: 8px; color: #4fc3f7; }
  .title { color: #aaa; }
  .flag-badge { display: none; position: absolute; top: 8px; right: 8px;
    background: #f44336; color: white; padding: 2px 8px; border-radius: 4px;
    font-size: 12px; font-weight: bold; }
  .card.flagged .flag-badge { display: block; }
</style>
</head>
<body>
<h1>封面審查 (Cover Review)</h1>
<p style="text-align:center;color:#aaa;">點擊封面標記為違規 / Click cover to flag as violation</p>
<div class="toolbar">
  <span class="count">已標記: <strong id="flagCount">0</strong> / ${coversWithImages.length}</span>
  <button onclick="exportFlagged()">匯出違規清單 (Export)</button>
  <button class="danger" onclick="clearAll()">清除全部 (Clear All)</button>
</div>
<div class="grid">
${cards}
</div>
<script>
  const flagged = new Set();

  function toggleFlag(el) {
    const id = el.dataset.id;
    if (flagged.has(id)) {
      flagged.delete(id);
      el.classList.remove('flagged');
    } else {
      flagged.add(id);
      el.classList.add('flagged');
    }
    document.getElementById('flagCount').textContent = flagged.size;
  }

  function clearAll() {
    flagged.clear();
    document.querySelectorAll('.card.flagged').forEach(c => c.classList.remove('flagged'));
    document.getElementById('flagCount').textContent = 0;
  }

  function exportFlagged() {
    if (flagged.size === 0) { alert('沒有標記任何封面'); return; }
    const data = JSON.stringify([...flagged], null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'flagged_covers.json';
    a.click();
    alert('已匯出 ' + flagged.size + ' 筆違規封面 ID');
  }
</script>
</body>
</html>`;

  const outputPath = path.join(CONFIG.outputDir, 'cover-review.html');
  fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  fs.writeFileSync(outputPath, html, 'utf-8');
  console.log(`[cover-analyzer] Review page generated: ${outputPath}`);
  return outputPath;
}

export function importFlaggedCovers(jsonPath, allVideos, reporter) {
  if (!fs.existsSync(jsonPath)) {
    console.log('[cover-analyzer] No flagged covers file found.');
    return 0;
  }

  const flaggedIds = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  const videoMap = new Map(allVideos.map(v => [v.id, v]));
  let count = 0;

  for (const id of flaggedIds) {
    const video = videoMap.get(id);
    if (video) {
      reporter.addRecord(video, {
        type: 'cover_visual',
        field: 'cover',
        value: video.coverLocalPath || '',
        keywords: ['人工標記'],
        categories: ['cover_violation'],
      });
      count++;
    }
  }

  console.log(`[cover-analyzer] Imported ${count} flagged cover violations.`);
  return count;
}
