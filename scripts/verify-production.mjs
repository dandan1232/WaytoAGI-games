import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { chromium, expect } from '@playwright/test';

// Optional explicit URL verifies the deployed site; otherwise own an isolated preview.
let server;
let output = '';
let baseURL = process.argv[2];
if (!baseURL) {
  const probe = createServer();
  await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', resolve); });
  const port = probe.address().port;
  await new Promise((resolve, reject) => probe.close(error => error ? reject(error) : resolve()));
  baseURL = `http://127.0.0.1:${port}/`;
  server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { windowsHide: true, stdio: 'pipe' });
  server.stdout.on('data', chunk => { output += chunk; }); server.stderr.on('data', chunk => { output += chunk; });
}
let browser;
try {
  if (server) {
    let ready = false;
    for (let attempt = 0; attempt < 80; attempt++) {
      if (server.exitCode !== null) throw new Error(`Production preview exited: ${output}`);
      if (output.includes(baseURL)) { ready = true; break; }
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    if (!ready) throw new Error(`Production preview did not start: ${output}`);
  }
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [], warnings = [], externalRequests = [], failedRequests = [];
  const origin = new URL(baseURL).origin;
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); if (message.type() === 'warning') warnings.push(message.text()); });
  page.on('request', request => { if (new URL(request.url()).origin !== origin) externalRequests.push(request.url()); });
  page.on('requestfailed', request => failedRequests.push(request.url()));
  page.on('response', response => { if (response.status() >= 400) failedRequests.push(`${response.status()} ${response.url()}`); });
  const response = await page.goto(baseURL);
  await page.getByRole('button', { name: '开始清洁', exact: true }).click();
  if (await page.evaluate(() => '__cleanGame' in window)) throw new Error('Development probe exposed in production');
  const levels = [
    { id: 'courtyard', name: '庭院日常', task: '庭院地砖', taskId: 'paving' },
    { id: 'glass', name: '晴天窗边', task: '中央玻璃', taskId: 'window-center' },
    { id: 'kitchen', name: '元气厨房', task: '油污灶台', taskId: 'stove' },
    { id: 'fabric', name: '柔软客厅', task: '客厅地毯', taskId: 'rug' },
  ];
  const results = [];
  for (const level of levels) {
    await page.getByRole('button', { name: `进入${level.name}`, exact: true }).click();
    await page.getByRole('button', { name: `聚焦${level.task}`, exact: true }).click();
    await page.mouse.move(720, 450); await page.mouse.down();
    await expect(page.locator(`#percent-${level.taskId}`)).not.toHaveText('0%');
    await page.mouse.up();
    const progress = await page.locator(`#percent-${level.taskId}`).textContent();
    results.push({ level: level.id, task: level.taskId, progress });
  }
  await page.getByRole('button', { name: '查看卡赫装备库', exact: true }).click();
  for (const product of ['khb-air', 'wv2', 'sc4d', 'puzzi-8-1']) {
    await page.locator(`[data-product="${product}"]`).click();
    await page.waitForFunction(() => { const image = document.querySelector('#equipment-hero'); return image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0; });
  }
  await page.locator('[data-product="khb-air"]').click(); await page.getByRole('button', { name: '折叠收纳', exact: true }).click();
  await page.waitForFunction(() => { const image = document.querySelector('#equipment-hero'); return image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0 && image.src.endsWith('khb-air-folded.webp'); });
  await page.getByRole('button', { name: '返回场景', exact: true }).click();
  await page.getByRole('button', { name: '设置', exact: true }).click(); await page.getByRole('button', { name: '夜晚', exact: true }).click();
  await page.getByRole('button', { name: '关闭设置', exact: true }).click(); await page.reload();
  await expect(page.locator('#scene-title')).toHaveText('柔软客厅'); await expect(page.locator('#app')).toHaveAttribute('data-night', 'true');
  await expect(page.locator('#percent-rug')).toHaveText(results[3].progress);
  // Exercise production dragging without any developer probes.
  const tool = await page.locator('#device-handle').boundingBox();
  await page.mouse.move(tool.x + tool.width / 2, tool.y + tool.height / 2); await page.mouse.down(); await page.mouse.move(720, 450, { steps: 12 });
  await expect(page.locator('#device-view')).toHaveClass(/dragging/); await page.mouse.up();
  await expect(page.locator('#device-view')).not.toHaveClass(/dragging/);
  await page.getByRole('button', { name: '收回机器', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('Mobile layout overflows');
  await page.getByRole('button', { name: '设置', exact: true }).click(); await page.getByRole('button', { name: '返回小世界', exact: true }).click();
  if (errors.length || warnings.length || externalRequests.length || failedRequests.length) throw new Error(JSON.stringify({ errors, warnings, externalRequests, failedRequests }));
  console.log(JSON.stringify({ url: baseURL, productionHTTP: response.status(), levels: results, savedProgressRestored: true, nightPreferenceRestored: true, dragging: true, foldingPhoto: true, mobileWidth: 390, errors, warnings, externalRequests, failedRequests, developmentProbe: false }));
} finally { await browser?.close(); server?.kill(); }
