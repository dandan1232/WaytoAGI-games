import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { LEVELS } from "../src/core/levels";
import type { TaskId } from "../src/core/cleaning";
const state = (page: Page) =>
  page.evaluate(() => window.__cleanGame!.inspect());
async function start(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "开始清洁", exact: true }).click();
}
async function points(page: Page, task?: TaskId) {
  return page.evaluate(
    (task) =>
      window
        .__cleanGame!.samples()
        .filter(
          (point) =>
            (!task || point.task === task) &&
            document.elementFromPoint(point.x, point.y)?.tagName === "CANVAS",
        ),
    task,
  );
}
async function washPoint(page: Page) {
  const point = (await points(page))[0];
  expect(point).toBeTruthy();
  const before = (await state(page)).progress;
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await expect
    .poll(async () => (await state(page)).progress)
    .toBeGreaterThan(before);
  await page.mouse.up();
}
for (const level of LEVELS.slice(1)) {
  test(`${level.id}: three real cleaning tasks reach completion and survive reload`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await start(page);
    await page
      .getByRole("button", { name: `进入${level.name}`, exact: true })
      .click();
    expect((await state(page)).mode).toBe(level.mode);
    await page.screenshot({ path: `work/verified-${level.id}-before.png` });
    for (const task of level.tasks) {
      for (
        let pass = 0;
        pass < 5 && (await state(page)).tasks[task] !== 1;
        pass++
      ) {
        const samples = await points(page, task);
        expect(samples.length).toBeGreaterThan(0);
        for (const point of samples) {
          if ((await state(page)).tasks[task] === 1) break;
          await page.mouse.move(point.x, point.y);
          await page.mouse.down();
          await page.waitForTimeout(pass === 0 ? 60 : 120);
          await page.mouse.up();
        }
      }
      expect(
        (await state(page)).tasks[task],
        `${level.id}: ${task} is reachable and completable`,
      ).toBe(1);
    }
    await expect(
      page.getByRole("heading", {
        name: `${level.name}焕新完成！`,
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "欣赏我的成果", exact: true })
      .click();
    await page.mouse.move(1400, 50);
    await page.screenshot({ path: `work/verified-${level.id}-clean.png` });
    await page.reload();
    expect((await state(page)).complete).toBe(true);
    await expect(
      page.getByRole("heading", {
        name: `${level.name}焕新完成！`,
        exact: true,
      }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });
}
test("all four machines drag to clean, stay reachable, and stop on blur", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await start(page);
  for (const level of LEVELS) {
    await page
      .getByRole("button", { name: `进入${level.name}`, exact: true })
      .click();
    const target = (await points(page))[0];
    const before = await state(page);
    const handle = page.getByRole("button", {
      name: `拖动清洁设备 ${level.model}`,
      exact: true,
    });
    const bounds = (await handle.boundingBox())!;
    await page.mouse.move(
      bounds.x + bounds.width / 2,
      bounds.y + bounds.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(target.x, target.y, { steps: 10 });
    await expect
      .poll(async () => (await state(page)).progress)
      .toBeGreaterThan(before.progress);
    expect((await state(page)).device).not.toEqual(before.device);
    await page.screenshot({ path: `work/verified-drag-${level.id}.png` });
    await page.mouse.up();
    await expect(page.locator("#device-view")).not.toHaveClass(/dragging/);
    const cleaned = (await state(page)).progress;
    await page.waitForTimeout(200);
    expect((await state(page)).progress).toBe(cleaned);
    await handle.focus();
    const position = (await state(page)).device;
    await page.keyboard.press("ArrowLeft");
    expect((await state(page)).device.x).toBeLessThan(position.x);
    await page.getByRole("button", { name: "收回机器", exact: true }).click();
  }
  const handle = page.getByRole("button", {
    name: "拖动清洁设备 PUZZI 8-1",
    exact: true,
  });
  const bounds = (await handle.boundingBox())!;
  await page.mouse.move(bounds.x + 30, bounds.y + 40);
  await page.mouse.down();
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  const paused = await state(page);
  expect(paused.paused).toBe(true);
  await page.waitForTimeout(200);
  expect((await state(page)).progress).toBe(paused.progress);
  await page.mouse.up();
  expect(errors).toEqual([]);
});
test("scene switching, persistent settings and resetting only the selected scene", async ({
  page,
}) => {
  await start(page);
  await washPoint(page);
  const courtyard = (await state(page)).progress;
  await page.getByRole("button", { name: "进入晴天窗边", exact: true }).click();
  await washPoint(page);
  const glass = (await state(page)).progress;
  await page.getByRole("button", { name: "设置", exact: true }).click();
  const paused = await state(page);
  await page.getByRole("button", { name: "夜晚", exact: true }).click();
  await page.getByRole("button", { name: "清洁音效", exact: true }).click();
  await page.getByRole("button", { name: "环境动画", exact: true }).click();
  await page.locator("#setting-volume").focus();
  await page.keyboard.press("Home");
  for (let i = 0; i < 6; i++) await page.keyboard.press("ArrowRight");
  await expect(page.locator("output")).toHaveText("30%");
  expect((await state(page)).seconds).toBe(paused.seconds);
  await page.screenshot({ path: "work/verified-settings.png" });
  await page.getByRole("button", { name: "关闭设置", exact: true }).click();
  await page.reload();
  expect((await state(page)).level).toBe("glass");
  expect((await state(page)).progress).toBeCloseTo(glass, 7);
  await expect(page.locator("#app")).toHaveAttribute("data-night", "true");
  await expect(page.locator("#app")).toHaveAttribute("data-motion", "false");
  await expect(
    page.getByRole("button", { name: "开启音效", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await expect(page.locator("output")).toHaveText("30%");
  await page.getByRole("button", { name: "重新开始本关", exact: true }).click();
  await page.getByRole("button", { name: "重新开始", exact: true }).click();
  expect((await state(page)).progress).toBe(0);
  await page.getByRole("button", { name: "进入庭院日常", exact: true }).click();
  expect((await state(page)).progress).toBeCloseTo(courtyard, 7);
});
test("touch dragging cleans on mobile and settings work in short landscape", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await start(page);
  const point = (await points(page, "paving"))[20];
  const bounds = (await page.locator("#device-handle").boundingBox())!;
  const client = await context.newCDPSession(page);
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 },
    ],
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: point.x, y: point.y }],
  });
  await expect
    .poll(async () => (await state(page)).progress)
    .toBeGreaterThan(0);
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await page.getByRole("button", { name: "收回机器", exact: true }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "work/verified-mobile.png" });
  for (const viewport of [
    { width: 375, height: 667 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    await page.getByRole("button", { name: "设置", exact: true }).click();
    await page
      .getByRole("button", { name: "返回小世界", exact: true })
      .scrollIntoViewIfNeeded();
    await expect(
      page.getByRole("button", { name: "返回小世界", exact: true }),
    ).toBeInViewport();
    await page.getByRole("button", { name: "返回小世界", exact: true }).click();
    const device = await page.locator("#device-handle").boundingBox();
    expect(device!.x).toBeGreaterThanOrEqual(0);
    expect(device!.x + device!.width).toBeLessThanOrEqual(viewport.width);
  }
  await context.close();
});
