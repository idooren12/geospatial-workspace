import { expect, test, type Page } from '@playwright/test';

const mapInstances = (page: Page) =>
  page.evaluate(() => (window as unknown as { __gws: { mapService: { instanceCount: number } } }).__gws.mapService.instanceCount);

const box = async (page: Page, selector: string) => {
  const b = await page.locator(selector).first().boundingBox();
  if (!b) throw new Error(`no box for ${selector}`);
  return b;
};

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('.maplibregl-canvas').waitFor();
});

test('MapLibre worker loads (tiles can render)', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && /worker/i.test(m.text()) && errors.push(m.text()));
  await page.reload();
  await page.locator('.maplibregl-canvas').waitFor();
  await page.waitForTimeout(1500);
  expect(errors).toEqual([]);
});

test('opens in Hebrew RTL with one map instance', async ({ page }) => {
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'he');
  expect(await mapInstances(page)).toBe(1);
});

test('rails are compact and the map fills the space between them', async ({ page }) => {
  const vp = page.viewportSize()!;
  const rails = page.locator('nav');
  await expect(rails).toHaveCount(2);
  for (const r of await rails.all()) {
    const w = (await r.boundingBox())!.width;
    expect(w).toBeGreaterThanOrEqual(44);
    expect(w).toBeLessThanOrEqual(52);
  }
  const map = await box(page, 'main');
  expect(map.width).toBeCloseTo(vp.width - 2 * 48, 0);
  const canvas = await box(page, '.maplibregl-canvas');
  expect(Math.round(canvas.width)).toBe(Math.round(map.width)); // MAP-02
});

test('switching language mirrors the layout without recreating the map', async ({ page }) => {
  const railStart = await box(page, 'nav >> nth=0');
  expect(railStart.x).toBeGreaterThan(page.viewportSize()!.width / 2); // RTL: first rail on the right
  await page.getByRole('button', { name: 'Switch to English' }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  const railStartLtr = await box(page, 'nav >> nth=0');
  expect(railStartLtr.x).toBeLessThan(10);
  await expect(page.getByTestId('basemap-toggle')).toHaveText('Light');
  expect(await mapInstances(page)).toBe(1);
});

test('status bar shows cursor coordinates and zoom', async ({ page }) => {
  const map = await box(page, 'main');
  await page.mouse.move(map.x + map.width / 2, map.y + map.height / 2);
  await expect(page.getByTestId('cursor-coords')).toHaveText(/^\d+\.\d{5} [NS], \d+\.\d{5} [EW]$/);
  await expect(page.getByTestId('zoom-level')).toHaveText(/^\d+\.\d$/);
});

test('first open frames all of Israel', async ({ page }) => {
  const center = await page.evaluate(() =>
    (window as unknown as { __gws: { mapService: { getView(): { center: [number, number] } } } }).__gws.mapService.getView(),
  );
  expect(center.center[0]).toBeGreaterThan(34.5);
  expect(center.center[0]).toBeLessThan(35.7);
  expect(center.center[1]).toBeGreaterThan(31);
  expect(center.center[1]).toBeLessThan(31.8);
});

test('language, basemap and camera survive a refresh', async ({ page }) => {
  await page.getByRole('button', { name: 'Switch to English' }).click();
  await page.getByTestId('basemap-toggle').click();
  await expect(page.getByTestId('basemap-toggle')).toHaveText('Dark');
  const map = await box(page, 'main');
  await page.mouse.move(map.x + map.width / 2, map.y + map.height / 2);
  await page.mouse.wheel(0, -600);
  await page.waitForTimeout(800);
  const before = await page.getByTestId('zoom-level').textContent();
  await page.waitForTimeout(400); // debounce
  await page.reload();
  await page.locator('.maplibregl-canvas').waitFor();
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.getByTestId('basemap-toggle')).toHaveText('Dark');
  await expect(page.getByTestId('zoom-level')).toHaveText(before!);
});
