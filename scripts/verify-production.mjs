import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { chromium } from '@playwright/test';

// Let the OS choose an available port, including on Windows with reserved port ranges.
const probe = createServer();
await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', resolve); });
const port = probe.address().port;
await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
const baseURL = `http://127.0.0.1:${port}/`;

// Own a separate preview server and browser context; never attach to personal browser data.
const server = spawn(process.execPath, [
  'node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort',
], { windowsHide: true, stdio: 'pipe' });
let output = '';
server.stdout.on('data', (chunk) => { output += chunk; });
server.stderr.on('data', (chunk) => { output += chunk; });
let browser;

try {
  let ready = false;
  for (let attempt = 0; attempt < 80; attempt++) {
    if (server.exitCode !== null) throw new Error(`Production preview exited: ${output}`);
    if (output.includes(baseURL)) {
      try {
        const response = await fetch(baseURL);
        if (response.ok) { ready = true; break; }
      } catch { /* Wait for the owned server to finish listening. */ }
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  if (!ready) throw new Error(`Production preview did not start: ${output}`);

  browser = await chromium.launch({
    channel: 'chrome', headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  const warnings = [];
  const externalRequests = [];
  const failedRequests = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
    if (message.type() === 'warning') warnings.push(message.text());
  });
  page.on('request', (request) => {
    if (!request.url().startsWith(baseURL)) externalRequests.push(request.url());
  });
  page.on('requestfailed', (request) => failedRequests.push(request.url()));
  page.on('response', (response) => { if (response.status() >= 400) failedRequests.push(`${response.status()} ${response.url()}`); });

  await page.goto(baseURL);
  await page.getByRole('button', { name: '开始清洁', exact: true }).click();
  if (await page.evaluate(() => '__cleanGame' in window)) throw new Error('Development probe exposed in production');
  await page.mouse.move(650, 565);
  await page.mouse.down();
  await page.waitForTimeout(1300);
  await page.mouse.up();
  const progress = await page.locator('#percent-paving').textContent();
  if (progress === '0%') throw new Error('Production cleaning did not change the surface');
  await page.getByRole('button', { name: '查看卡赫装备库，当前设备 KHB AIR' }).click();
  const products = ['khb-air', 'wv2', 'sc4d', 'puzzi-8-1'];
  for (const product of products) {
    await page.locator(`[data-product="${product}"]`).click();
    await page.waitForFunction(() => {
      const image = document.querySelector('#equipment-hero');
      return image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0;
    });
  }
  await page.locator('[data-product="khb-air"]').click();
  await page.getByRole('button', { name: '折叠收纳', exact: true }).click();
  await page.waitForFunction(() => {
    const image = document.querySelector('#equipment-hero');
    return image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0 && image.src.endsWith('khb-air-folded.webp');
  });
  await page.getByRole('button', { name: '返回庭院', exact: true }).click();
  await page.reload();
  if (await page.locator('#percent-paving').textContent() !== progress) throw new Error('Production progress was not restored');
  if (errors.length || warnings.length || externalRequests.length || failedRequests.length) throw new Error(JSON.stringify({ errors, warnings, externalRequests, failedRequests }));
  console.log(JSON.stringify({ productionHTTP: 200, pavingProgress: progress, savedProgressRestored: true, products, foldingPhoto: true, errors, warnings, externalRequests, failedRequests, developmentProbe: false }));
} finally {
  await browser?.close();
  server.kill();
}
