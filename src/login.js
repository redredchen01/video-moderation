import { CONFIG } from './config.js';

/**
 * Automate login to the admin panel.
 * @param {import('playwright').Page} page
 */
export async function login(page) {
  console.log('[login] Navigating to admin panel...');
  await page.goto(CONFIG.baseUrl, { waitUntil: 'networkidle' });

  // Selectors calibrated against actual login page (LayUI-based)
  await page.fill('input[name="user_name"]', CONFIG.credentials.username);
  await page.fill('input[name="password"]', CONFIG.credentials.password);

  // card_num field may not exist on all admin panels
  const cardNumField = page.locator('input[name="card_num"]');
  if (await cardNumField.isVisible({ timeout: 2000 }).catch(() => false)) {
    await cardNumField.fill(CONFIG.credentials.cardNum);
  }

  // Click login button and wait for navigation
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }).catch(() => {}),
    page.click('.layui-btn.layui-btn-fluid'),
  ]);
  await page.waitForLoadState('networkidle').catch(() => {});

  // Verify login success by checking if login form is still present
  const url = page.url();
  const loginFormStillVisible = await page.locator('input[type="password"]').isVisible().catch(() => false);

  if (loginFormStillVisible) {
    // Still on login page — check for error messages
    const errorText = await page.textContent('.error, .alert-danger, .layui-layer-content').catch(() => null);
    throw new Error(`[login] Login failed: ${errorText || 'login form still visible after submit'}`);
  }

  console.log('[login] Login successful. Current URL:', url);
}
