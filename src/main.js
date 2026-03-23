import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
import { CONFIG } from './config.js';
import { login } from './login.js';
import { navigateToVideoList, extractVideosFromPage, downloadCover, getVideoDescription, getTableRows, getRowVideoId, goToNextPage } from './scraper.js';
import { checkVideo } from './checker.js';
import { createReporter } from './reporter.js';
import { generateCoverReviewPage, importFlaggedCovers } from './cover-analyzer.js';

/** Run async tasks with concurrency limit */
async function parallelLimit(items, limit, fn) {
  const results = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

async function main() {
  console.log('=== Video Content Moderation Tool ===\n');

  const browser = await chromium.launch({
    headless: CONFIG.headless,
  });
  console.log(`[main] Browser: ${CONFIG.headless ? 'headless' : 'visible'} | Max pages: ${CONFIG.maxPages}`);
  const context = await browser.newContext();
  const page = await context.newPage();
  const reporter = createReporter();

  try {
    // Step 1: Login
    await login(page);

    // Step 2: Navigate to video list
    const frame = await navigateToVideoList(page);

    // Step 3: Phase 1 — Collect all videos from all pages (title, tags, cover)
    //   Clicking edit modals can interfere with pagination, so we collect first.
    const allVideos = [];
    let pageNum = 1;

    while (pageNum <= CONFIG.maxPages) {
      console.log(`\n--- Scanning Page ${pageNum} ---`);

      const videos = await extractVideosFromPage(frame);
      if (videos.length === 0) {
        console.log('[main] No videos found on page, stopping scan.');
        break;
      }

      // Download covers with concurrency limit to avoid overwhelming the server
      if (!CONFIG.skipCovers) {
        await parallelLimit(videos, CONFIG.coverDownloadConcurrency, async (video) => {
          try {
            video.coverLocalPath = await downloadCover(video.coverUrl, video.id);
          } catch (e) {
            console.warn(`[main] Cover download failed for ${video.id}:`, e.message);
          }
        });
      }
      allVideos.push(...videos);

      const hasNext = await goToNextPage(frame);
      if (!hasNext) break;
      pageNum++;
    }

    // Deduplicate by video ID (edge case: same video appearing across page boundaries)
    const seenIds = new Set();
    const dedupedVideos = [];
    for (const v of allVideos) {
      if (!seenIds.has(v.id)) {
        seenIds.add(v.id);
        dedupedVideos.push(v);
      }
    }
    if (dedupedVideos.length < allVideos.length) {
      console.log(`[main] Removed ${allVideos.length - dedupedVideos.length} duplicate videos.`);
    }
    allVideos.length = 0;
    allVideos.push(...dedupedVideos);

    console.log(`\n[main] Scan complete: ${allVideos.length} videos across ${pageNum} pages.`);

    // Step 4: Phase 2 — Fetch descriptions by revisiting each page
    if (CONFIG.skipDescriptions) {
      console.log('\n--- Phase 2: Skipped (--skip-descriptions) ---');
    } else {
      console.log('\n--- Phase 2: Fetching descriptions ---');

      // Build a lookup map for quick ID → video reference
      const videoMap = new Map(allVideos.map(v => [v.id, v]));
      let descFetched = 0;

      // Re-navigate to page 1
      const frame2 = await navigateToVideoList(page);
      let descPageNum = 1;

      while (descPageNum <= pageNum) {
        console.log(`\n[main] Description fetch — Page ${descPageNum}`);
        const rows = await getTableRows(frame2);

        if (rows.length === 0) {
          console.warn(`[main] No rows found on page ${descPageNum}, stopping description fetch.`);
          break;
        }

        for (let i = 0; i < rows.length; i++) {
          // Verify row identity by ID instead of assuming index order
          const rowId = await getRowVideoId(rows[i]);
          const video = videoMap.get(rowId);

          if (!video) {
            console.warn(`  [${rowId}] Not found in Phase 1 data, skipping.`);
            continue;
          }

          try {
            video.description = await getVideoDescription(frame2, i);
            video.descriptionFetched = true;
            descFetched++;
            if (video.description) {
              console.log(`  [${video.id}] description: ${video.description.substring(0, 50)}...`);
            }
          } catch (e) {
            console.warn(`  [${video.id}] Failed to get description:`, e.message);
          }
        }

        const hasNext = await goToNextPage(frame2);
        if (!hasNext) break;
        descPageNum++;
      }

      console.log(`[main] Descriptions fetched: ${descFetched}/${allVideos.length}`);
    }

    // Step 5: Run checks on all collected videos
    console.log('\n--- Running content checks ---');
    let totalViolations = 0;
    let totalRisks = 0;

    for (const video of allVideos) {
      const result = checkVideo(video);

      if (result.hasViolation) {
        console.log(`  🚨 ${video.id}: VIOLATION — ${result.violations.map(v => `${v.type}[${v.keywords?.join(',')}]`).join(', ')}`);
        for (const v of result.violations) reporter.addRecord(video, v, 'VIOLATION');
        totalViolations++;
      }

      if (result.hasRisk) {
        console.log(`  ⚠️  ${video.id}: RISK — ${result.risks.map(r => `${r.type}[${r.keywords?.join(',')}]`).join(', ')}`);
        for (const r of result.risks) reporter.addRecord(video, r, 'RISK');
        totalRisks++;
      }

      if (!result.hasViolation && !result.hasRisk) {
        console.log(`  ✓  ${video.id}: clean`);
      }
    }

    // Cover review: generate HTML page + import previous flags
    const reviewPagePath = generateCoverReviewPage(allVideos);
    if (reviewPagePath) {
      console.log(`\n[main] Cover review page: ${reviewPagePath}`);
      console.log('[main] Open in browser, flag violations, export JSON, then re-run.');
    }

    const flagsPath = path.join(CONFIG.outputDir, 'flagged_covers.json');
    if (fs.existsSync(flagsPath)) {
      importFlaggedCovers(flagsPath, allVideos, reporter);
    }

    // Step 6: Write report
    await reporter.flush();

    // Step 7: Generate dashboard
    try {
      const { generateDashboardFromData } = await import('./dashboard.js');
      const dashPath = generateDashboardFromData(reporter.records, allVideos.length);
      console.log(`[main] Dashboard: ${dashPath}`);
    } catch (e) {
      console.warn('[main] Dashboard generation failed:', e.message);
    }

    console.log(`\n=== Moderation Complete ===`);
    console.log(`Total videos checked: ${allVideos.length}`);
    console.log(`VIOLATIONS (hard): ${totalViolations}`);
    console.log(`RISKS (review): ${totalRisks}`);
    console.log(`Total records: ${reporter.count}`);
    console.log(`Report: ${CONFIG.reportPath}`);
    console.log(`Covers saved to: ${CONFIG.coversDir}/`);

  } catch (error) {
    console.error('[main] Fatal error:', error);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();
