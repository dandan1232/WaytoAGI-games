import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
const equipmentButton = (page: Page) => page.getByRole('button', { name: '查看卡赫装备库', exact: true });
const inspect = (page: Page) => page.evaluate(() => window.__cleanGame!.inspect());
async function start(page: Page): Promise<void> { await page.goto('/'); await page.getByRole('button', { name: '开始清洁', exact: true }).click(); }
async function imageLoaded(page: Page): Promise<void> {
  await expect.poll(() => page.locator('#equipment-hero').evaluate((image) => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0)).toBe(true);
}
test('manufacturer gallery, folding view, paused browsing and playable scene links', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
  await start(page); await equipmentButton(page).click(); const before = await inspect(page);
  expect(before.paused).toBe(true); await imageLoaded(page);
  await page.getByRole('button', { name: '折叠收纳', exact: true }).click();
  await expect(page.locator('#equipment-hero')).toHaveAttribute('src', /khb-air-folded\.webp$/); await imageLoaded(page);
  await expect(page.getByRole('button', { name: '折叠收纳', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '展开机身', exact: true }).click(); await imageLoaded(page);
  await page.screenshot({ path: 'work/equipment-library.png' });
  for (const [id, model, use] of [['wv2', 'WV 2', '玻璃 · 窗户 · 镜面'], ['sc4d', 'SC4D', '硬质地面 · 瓷砖 · 厨房'], ['puzzi-8-1', 'PUZZI 8-1', '沙发 · 地毯 · 布艺座椅']]) {
    await page.locator(`[data-product="${id}"]`).click();
    await expect(page.getByRole('heading', { name: model, exact: true })).toBeVisible(); await expect(page.locator('.equipment-use')).toHaveText(use); await imageLoaded(page);
  }
  expect((await inspect(page)).seconds).toBe(before.seconds); expect((await inspect(page)).progress).toBe(before.progress);
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).not.toBeVisible(); await expect(equipmentButton(page)).toBeFocused();
  await equipmentButton(page).click(); await page.locator('[data-product="wv2"]').click();
  await page.getByRole('dialog').getByRole('button', { name: '进入晴天窗边', exact: true }).click();
  expect((await inspect(page)).level).toBe('glass'); expect((await inspect(page)).paused).toBe(false); expect(errors).toEqual([]);
});
test('equipment gallery stays usable on phones, tablets, landscape and reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await start(page);
  for (const viewport of [{ width: 375, height: 667 }, { width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport); await equipmentButton(page).click(); await page.locator('[data-product="puzzi-8-1"]').click(); await imageLoaded(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.getByRole('dialog').evaluate((dialog) => dialog.scrollWidth <= dialog.clientWidth)).toBe(true);
    await page.getByRole('button', { name: '返回场景', exact: true }).scrollIntoViewIfNeeded();
    await expect(page.getByRole('button', { name: '返回场景', exact: true })).toBeInViewport();
    if (viewport.width === 390) await page.screenshot({ path: 'work/equipment-mobile.png' });
    await page.getByRole('button', { name: '返回场景', exact: true }).click();
    if (viewport.width === 390) await page.screenshot({ path: 'work/equipment-courtyard-mobile.png' });
  }
});
test('missing product photos leave names, return controls and cleaning usable', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/products/*.webp', (route) => route.abort()); await start(page); await equipmentButton(page).click();
  await page.locator('[data-product="wv2"]').click(); await expect(page.getByRole('heading', { name: 'WV 2', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '关闭装备库', exact: true }).click();
  const point = await page.evaluate(() => window.__cleanGame!.samples().find((point) => point.task === 'paving')!);
  await page.mouse.move(point.x, point.y); await page.mouse.down(); await expect.poll(async () => (await inspect(page)).progress).toBeGreaterThan(0); await page.mouse.up();
  expect(errors).toEqual([]);
});
