import type { Page } from '@playwright/test';
import { expect, freshStart, test } from './fixtures';

/** DoD items that had no dedicated assertion before M5 (spec §11). */

type Gws = { map: { getZoom(): number; getCenter(): { lng: number; lat: number } } };
const cam = (page: Page) =>
  page.evaluate(() => {
    const m = (window as unknown as { __gws: Gws }).__gws.map;
    return { z: m.getZoom(), ...m.getCenter() };
  });

test('DoD 2: the mouse wheel zooms and dragging pans', async ({ page }) => {
  await freshStart(page);
  const b = (await page.getByTestId('map-cell').boundingBox())!;
  const cx = b.x + b.width / 2;
  const cy = b.y + b.height / 2;
  const start = await cam(page);
  await page.mouse.move(cx, cy);
  await page.mouse.wheel(0, -500);
  await expect.poll(async () => (await cam(page)).z).toBeGreaterThan(start.z + 0.3);
  const zoomed = await cam(page);
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx - 200, cy + 120, { steps: 10 });
  await page.mouse.up();
  await expect.poll(async () => (await cam(page)).lng).toBeGreaterThan(zoomed.lng); // dragged left → map moves east
  expect((await cam(page)).lat).toBeGreaterThan(zoomed.lat);
});

test('DoD 3: rails are compact (44–52 px) — shown for registered domain/dev tools', async ({ page }) => {
  await freshStart(page);
  const rail = page.locator('[data-testid^="rail-"]').first();
  await expect(rail).toBeVisible(); // dev builds register Debug/Sample; production has no rail tools yet
  const w = (await rail.boundingBox())!.width;
  expect(w).toBeGreaterThanOrEqual(44);
  expect(w).toBeLessThanOrEqual(52);
});
