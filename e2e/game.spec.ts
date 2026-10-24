import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { ScreenSample } from '../src/game/game';

async function start(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: '开始清洁', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__cleanGame?.inspect().paused)).toBe(false);
}
async function state(page: Page) { return page.evaluate(() => window.__cleanGame!.inspect()); }
async function samples(page: Page): Promise<ScreenSample[]> { return page.evaluate(() => window.__cleanGame!.samples()); }
async function wash(page: Page, point: ScreenSample, duration = 260): Promise<void> {
  await page.mouse.move(point.x, point.y); await page.mouse.down(); await page.waitForTimeout(duration); await page.mouse.up();
}

test('real cleaning, saved masks, controls, pause and restart', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await start(page);
  await page.mouse.move(950, 100); await page.mouse.down(); await page.waitForTimeout(350); await page.mouse.up();
  expect((await state(page)).progress).toBe(0);
  const point = (await samples(page)).find((p) => p.task === 'paving')!;
  await wash(page, point, 650);
  await expect.poll(async () => (await state(page)).progress).toBeGreaterThan(0);
  const cleaned = (await state(page)).progress;
  expect((await state(page)).tasks.bicycle).toBe(0);
  await page.getByRole('button', { name: '集中点喷' }).click();
  expect((await state(page)).nozzle).toBe('detail');
  await page.keyboard.press('1'); expect((await state(page)).nozzle).toBe('wide');
  await page.getByRole('button', { name: '关闭音效', exact: true }).click();
  await expect(page.getByRole('button', { name: '开启音效', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '暂停游戏', exact: true }).click();
  expect((await state(page)).paused).toBe(true);
  const pausedTime = (await state(page)).seconds;
  await page.waitForTimeout(300); expect((await state(page)).seconds).toBe(pausedTime);
  await page.getByRole('button', { name: '继续清洁', exact: true }).click();
  await page.reload();
  await expect.poll(async () => (await state(page)).progress).toBeCloseTo(cleaned, 7);
  await expect(page.getByRole('button', { name: '开启音效', exact: true })).toBeVisible();
  const camera = (await state(page)).camera;
  await page.mouse.move(760, 420); await page.mouse.down({ button: 'right' });
  await page.mouse.move(870, 450, { steps: 10 }); await page.mouse.up({ button: 'right' });
  await page.waitForTimeout(400); expect((await state(page)).camera).not.toEqual(camera);
  await page.getByRole('button', { name: '复位视角', exact: true }).click();
  await expect.poll(async () => (await state(page)).camera[0]).toBeCloseTo(9, 1);
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: '重新开始本关', exact: true }).click();
  await page.getByRole('button', { name: '保留进度，返回场景', exact: true }).click();
  expect((await state(page)).progress).toBeCloseTo(cleaned, 7);
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: '重新开始本关', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '重新开始', exact: true }).click();
  expect((await state(page)).progress).toBe(0);
  await page.reload(); await expect.poll(async () => (await state(page)).progress).toBe(0);
  expect(errors).toEqual([]);
  await page.mouse.move(140, 40); await page.waitForTimeout(3000);
  await page.screenshot({ path: 'work/verified-desktop.png' });
});

test('all missions can be completed with actual surface pointer input', async ({ page }) => {
  await start(page);
  for (const task of ['bicycle', 'bench', 'paving'] as const) {
    for (let pass = 0; pass < 4; pass++) {
      if ((await state(page)).tasks[task] === 1) break;
      const points = (await samples(page)).filter((point) => point.task === task);
      // Each sample is projected from the visible surface; no progress mutation or finish shortcut.
      for (const point of points) {
        if ((await state(page)).tasks[task] === 1) break;
        await wash(page, point, pass === 0 ? 80 : 150);
      }
    }
    expect((await state(page)).tasks[task], `${task} can be finished`).toBe(1);
  }
  await expect(page.getByRole('heading', { name: '庭院日常焕新完成！' })).toBeVisible();
  expect((await state(page)).complete).toBe(true);
  await expect(page.getByTestId('total-progress')).toHaveText('100');
  await page.getByRole('button', { name: '欣赏我的成果' }).click();
  await page.mouse.move(140, 40); await page.waitForTimeout(3000);
  await page.screenshot({ path: 'work/verified-clean.png' });
  await page.reload();
  await expect(page.getByRole('heading', { name: '庭院日常焕新完成！' })).toBeVisible();
});

test('mobile layout, touch cleaning and recovery from corrupt storage', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await start(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole('button', { name: '广角清洗' })).toBeVisible();
  await expect(page.getByRole('button', { name: '聚焦庭院地砖' })).toBeVisible();
  await page.screenshot({ path: 'work/verified-mobile.png' });
  const point = (await samples(page)).find((p) => p.task === 'paving' && p.y < 550)!;
  const client = await context.newCDPSession(page);
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: point.x, y: point.y }] });
  await page.waitForTimeout(500);
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(async () => (await state(page)).progress).toBeGreaterThan(0);
  // Inject before the next application boot; the old page correctly saves on pagehide.
  await page.addInitScript(() => localStorage.setItem('clean-a-little:courtyard:v1', '{corrupt'));
  await page.reload();
  await expect(page.getByRole('button', { name: '开始清洁', exact: true })).toBeVisible();
  await context.close();
});

test('storage denial keeps the game playable and window blur stops cleaning', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Storage blocked', 'SecurityError'); } }));
  await start(page);
  await expect(page.locator('#save-status')).toContainText('无法保存');
  const point = (await samples(page)).find((p) => p.task === 'paving')!;
  await page.mouse.move(point.x, point.y); await page.mouse.down(); await page.waitForTimeout(400);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  expect((await state(page)).paused).toBe(true);
  const progress = (await state(page)).progress;
  expect(progress).toBeGreaterThan(0);
  await page.waitForTimeout(400);
  expect((await state(page)).progress).toBe(progress);
  await page.mouse.up();
  await page.getByRole('button', { name: '继续清洁', exact: true }).click();
  expect((await state(page)).paused).toBe(false);
});

test('WebGL initialization failure gives a usable recovery page', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      value: function(this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
        if (['webgl', 'webgl2', 'experimental-webgl'].includes(type)) return null;
        return Reflect.apply(original, this, [type, ...rest]);
      },
    });
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '这个小世界还没能展开。' })).toBeVisible();
  await expect(page.getByRole('link', { name: '重新打开小世界' })).toBeVisible();
});
