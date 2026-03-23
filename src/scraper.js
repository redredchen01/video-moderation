import { CONFIG } from './config.js';
import { retry } from './retry.js';
import fs from 'fs';
import path from 'path';

/**
 * Navigate to video management > video list.
 * The admin panel uses an iframe-based layout (HPlus/inspinia style).
 * Menu items have class .J_menuItem and load content into iframes.
 *
 * @param {import('playwright').Page} page
 * @returns {Promise<import('playwright').Frame>} the iframe Frame containing the video list
 */
// Derive video list URL from base URL (replace /index/index with /webvideo/index)
const VIDEO_LIST_URL = CONFIG.baseUrl.replace(/\/index\/index$/, '/webvideo/index');

export async function navigateToVideoList(page) {
  console.log('[scraper] Navigating to video list...');

  // Reset per-page flag on every navigation so setPerPage runs again after iframe reload
  _perPageApplied = false;

  // Check if an iframe with the video list already exists
  const existingIframe = page.locator(`iframe[src*="webvideo"]`).first();
  if (await existingIframe.count() > 0) {
    // Reset iframe to page 1 by setting its src
    await existingIframe.evaluate((el, url) => { el.src = url; }, VIDEO_LIST_URL);
    const frame = await existingIframe.contentFrame();
    if (frame) {
      await waitForTableReady(frame);
      console.log('[scraper] Video list iframe reloaded.');
      await setPerPage(frame, 1000);
      return frame;
    }
  }

  // First time: expand menu and click
  await page.click(`span.nav-label:has-text("${CONFIG.menuLabel}")`);
  await page.locator('a.J_menuItem[href*="webvideo/index"]').waitFor({ timeout: 5000 });
  await page.click('a.J_menuItem[href*="webvideo/index"]');

  // Wait for iframe to appear
  const iframeEl = page.locator('iframe[src*="webvideo"]').first();
  await iframeEl.waitFor({ timeout: 10000 });
  const frame = await iframeEl.contentFrame();

  if (!frame) {
    throw new Error('[scraper] Could not find webvideo iframe');
  }

  await waitForTableReady(frame);
  console.log('[scraper] Video list iframe loaded.');

  // Switch to max items per page to minimize pagination
  await setPerPage(frame, 1000);

  return frame;
}

const TABLE_ROW_SELECTOR = '.layui-table-body table tbody tr';

/** Wait for the iframe table content to be ready */
async function waitForTableReady(frame) {
  await frame.locator('.layui-table-body').first()
    .waitFor({ timeout: 15000 }).catch(() => {});
}

/**
 * Get all table rows from the video list.
 * @param {import('playwright').Frame} frame
 */
export async function getTableRows(frame) {
  return frame.locator(TABLE_ROW_SELECTOR).all();
}

let _perPageApplied = false;

/**
 * Change the per-page items count via LayUI laypage select.
 * Tries the requested count first, then falls back to the largest available option.
 */
async function setPerPage(frame, count) {
  if (_perPageApplied) return;
  const select = frame.locator('.layui-laypage-limits select').first();
  if (await select.count() === 0) return;

  // Get all available options
  const options = await select.locator('option').allTextContents();

  // Try exact match first, then pick the largest available
  const targetLabel = `${count} 条/页`;
  let chosenLabel = targetLabel;

  if (!options.includes(targetLabel)) {
    // Parse numeric values and pick the largest
    const parsed = options.map(opt => ({ label: opt, num: parseInt(opt) || 0 }));
    parsed.sort((a, b) => b.num - a.num);
    if (parsed.length > 0) {
      chosenLabel = parsed[0].label;
      console.log(`[scraper] ${targetLabel} not available, using: ${chosenLabel}`);
    } else {
      console.warn('[scraper] No per-page options found, skipping.');
      return;
    }
  }

  // Count current rows before changing
  const rowsBefore = await frame.locator(TABLE_ROW_SELECTOR).count();

  await select.selectOption({ label: chosenLabel });

  // Wait for table to reload — row count should change (unless it was already at target)
  // Poll until row count differs from before, or timeout after 15s
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 500));
    const rowsNow = await frame.locator(TABLE_ROW_SELECTOR).count();
    if (rowsNow !== rowsBefore || rowsNow >= count) break;
  }

  _perPageApplied = true;
  const finalRows = await frame.locator(TABLE_ROW_SELECTOR).count();
  console.log(`[scraper] Per-page set to ${chosenLabel} (${finalRows} rows loaded)`);
}

/**
 * Extract video data from the current page of the video list.
 * Table structure (LayUI table):
 *   cell[0]: checkbox
 *   cell[1]: ID (data-field="id")
 *   cell[2]: 标识 (identifier info block)
 *   cell[3]: 封面 (cover images)
 *   cell[4]: 属性 (title, tags, category, duration — HTML formatted)
 *   ...remaining cells: stats, status, operations
 *
 * @param {import('playwright').Frame} frame
 * @returns {Promise<Array<{id: string, title: string, tags: string, coverUrl: string}>>}
 */
export async function extractVideosFromPage(frame) {
  // Wait for LayUI table body to render
  await frame.locator(TABLE_ROW_SELECTOR).first()
    .waitFor({ timeout: 10000 }).catch(() => {});

  const rows = await getTableRows(frame);
  const videos = [];

  for (const row of rows) {
    try {
      const cells = await row.locator('td').all();
      if (cells.length < 5) continue;

      // ID is in cell with data-field="id"
      const id = (await row.locator('td[data-field="id"]').textContent().catch(() => ''))?.trim() || '';

      // Cover image is in cell[3] (data-field="3") — may have multiple images, take the first
      const coverUrl = await row.locator('td[data-field="3"] img').first()
        .getAttribute('src').catch(() => '') || '';

      // Title and tags are in cell[4] (data-field="4") — embedded in HTML
      const cell4Html = await row.locator('td[data-field="4"]').innerHTML().catch(() => '');
      const title = extractField(cell4Html, '标题：');
      const tags = extractField(cell4Html, '标签：');

      if (!id) continue;

      videos.push({
        id,
        title,
        tags,
        coverUrl: coverUrl.trim(),
        description: '',
      });
    } catch (e) {
      console.warn('[scraper] Error extracting row:', e.message);
    }
  }

  console.log(`[scraper] Extracted ${videos.length} videos from current page`);
  return videos;
}

/**
 * Extract a field value from the cell HTML.
 * Pattern: "标题：VALUE <br>" or "标签：</span>VALUE <br>"
 */
function extractField(html, label) {
  // Handle labels that might be inside a <span> tag (e.g. <span style="...">标签：</span>VALUE)
  const patterns = [
    new RegExp(`${label}<\\/span>([^<]*)<`, 'i'),
    new RegExp(`${label}([^<]*)<`, 'i'),
  ];

  for (const re of patterns) {
    const match = html.match(re);
    if (match && match[1]) return match[1].trim();
  }
  return '';
}

/**
 * Download a cover image to local disk.
 * @param {string} url
 * @param {string} videoId
 */
export async function downloadCover(url, videoId) {
  if (!url) return null;

  const absoluteUrl = url.startsWith('http')
    ? url
    : new URL(url, CONFIG.baseUrl).href;

  const parsedUrl = new URL(absoluteUrl);
  const ext = path.extname(parsedUrl.pathname) || '.jpg';
  const filename = `${videoId}${ext}`;
  const filepath = path.join(CONFIG.coversDir, filename);

  fs.mkdirSync(CONFIG.coversDir, { recursive: true });

  await retry(async () => {
    const response = await fetch(absoluteUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${absoluteUrl}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(filepath, buffer);
  }, { retries: 3, baseDelay: 1000, label: `cover:${videoId}` });

  return filepath;
}

/**
 * Get the video ID from a table row.
 * @param {import('playwright').Locator} row
 * @returns {Promise<string>}
 */
export async function getRowVideoId(row) {
  return (await row.locator('td[data-field="id"]').textContent().catch(() => ''))?.trim() || '';
}

/**
 * Click edit button for a video row to get description.
 * The LayUI layer (modal) renders INSIDE the iframe, not on the top-level page.
 * The modal contains a form with textarea[name="description"].
 *
 * @param {import('playwright').Frame} frame — the iframe Frame
 * @param {number} rowIndex — 0-based row index
 * @returns {Promise<string>} description text
 */
export async function getVideoDescription(frame, rowIndex) {
  const editBtns = await frame.locator('a[lay-event="edit"]').all();

  if (rowIndex >= editBtns.length) return '';

  // Force click to bypass any residual overlay interception
  await editBtns[rowIndex].click({ force: true });

  // Wait for modal to appear instead of hardcoded delay
  const textarea = frame.locator('.layui-layer textarea[name="description"]').first();
  let description = '';
  if (await textarea.isVisible({ timeout: 5000 }).catch(() => false)) {
    description = await textarea.inputValue().catch(() => '') || '';
  }

  // Close the modal — escalate strategies only if prior ones fail
  await frame.locator('.layui-layer-close').first().click({ force: true }).catch(() => {});

  // Wait for modal to disappear
  await frame.locator('.layui-layer').first()
    .waitFor({ state: 'hidden', timeout: 2000 }).catch(async () => {
      // Fallback: click cancel button
      await frame.locator('.layui-layer-btn1').first().click({ force: true }).catch(() => {});
      await frame.locator('.layui-layer').first()
        .waitFor({ state: 'hidden', timeout: 2000 }).catch(async () => {
          // Last resort: force remove via DOM
          await frame.evaluate(() => {
            document.querySelectorAll('.layui-layer-shade').forEach(el => el.remove());
            document.querySelectorAll('.layui-layer').forEach(el => el.remove());
          }).catch(() => {});
        });
    });

  return description.trim();
}

/**
 * Go to next page. Returns false if no next page.
 * Pagination uses LayUI laypage with class .layui-laypage-next.
 * When disabled, it has class .layui-disabled.
 *
 * @param {import('playwright').Frame} frame
 */
export async function goToNextPage(frame) {
  const nextBtn = frame.locator('.layui-laypage-next').first();

  const count = await nextBtn.count();
  if (count === 0) return false;

  const classes = await nextBtn.getAttribute('class').catch(() => '');
  if (classes && classes.includes('layui-disabled')) return false;

  try {
    await nextBtn.click();
    // Wait for table to reload after pagination
    await frame.locator(TABLE_ROW_SELECTOR).first()
      .waitFor({ timeout: 10000 }).catch(() => {});
    return true;
  } catch {
    return false;
  }
}
