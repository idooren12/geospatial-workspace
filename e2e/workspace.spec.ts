import { expect, test, type Page } from '@playwright/test';

type Gws = { mapService: { instanceCount: number; getView(): { center: [number, number] } }; map: { getStyle(): { layers: { id: string }[] } | undefined } };
const gws = <T>(page: Page, fn: (g: Gws) => T) => page.evaluate(fn as never, undefined) as Promise<T>;
const mapInstances = (page: Page) => page.evaluate(() => (window as unknown as { __gws: Gws }).__gws.mapService.instanceCount);

const box = async (page: Page, selector: string) => {
  const b = await page.locator(selector).first().boundingBox();
  if (!b) throw new Error(`no box for ${selector}`);
  return b;
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('e2e-seeded')) return;
    sessionStorage.setItem('e2e-seeded', '1');
    localStorage.clear();
  });
  await page.goto('/');
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

test('only the top bar is fixed; the map fills everything below it, edge to edge', async ({ page }) => {
  const vp = page.viewportSize()!;
  const top = await box(page, 'header');
  const map = await box(page, 'main');
  expect(map.x).toBe(0);
  expect(map.width).toBe(vp.width);
  expect(map.y).toBeCloseTo(top.height, 0);
  expect(map.y + map.height).toBeCloseTo(vp.height, 0);
  const canvas = await box(page, '.maplibregl-canvas');
  expect(Math.round(canvas.width)).toBe(vp.width); // MAP-02
});

test('status readout floats inside the map', async ({ page }) => {
  const map = await box(page, 'main');
  const status = await box(page, '.gws-slot-status');
  expect(status.y + status.height).toBeLessThanOrEqual(map.y + map.height);
  expect(status.y).toBeGreaterThan(map.y);
  await page.mouse.move(map.x + map.width / 2, map.y + map.height / 2);
  await expect(page.getByTestId('cursor-coords')).toHaveText(/^\d+\.\d{5} [NS], \d+\.\d{5} [EW]$/);
  await expect(page.getByTestId('zoom-level')).toHaveText(/^\d+\.\d$/);
});

test('basemap picker switches between map and satellite; theme switch only for the map', async ({ page }) => {
  await expect(page.getByTestId('theme-toggle')).toHaveAccessibleName('מעבר למפה כהה');
  await page.getByTestId('basemap-picker').click();
  await expect(page.getByTestId('basemap-option-map')).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('basemap-option-satellite').click();
  await expect(page.getByTestId('basemap-option-satellite')).toBeHidden(); // popover closed
  await expect(page.getByTestId('theme-toggle')).toHaveCount(0);
  await expect
    .poll(() => gws(page, () => (window as unknown as { __gws: Gws }).__gws.map.getStyle()?.layers[0]?.id))
    .toBe('basemap-imagery');
  await page.getByTestId('basemap-picker').click();
  await page.getByTestId('basemap-option-map').click();
  await page.getByTestId('theme-toggle').click();
  await expect(page.getByTestId('theme-toggle')).toHaveAccessibleName('מעבר למפה בהירה');
  expect(await mapInstances(page)).toBe(1);
});

test('switching language mirrors the controls without recreating the map', async ({ page }) => {
  const vp = page.viewportSize()!;
  const toolsRtl = await box(page, '.gws-slot-tools');
  expect(toolsRtl.x).toBeLessThan(vp.width / 2); // RTL: controls on the left
  await page.getByRole('button', { name: 'Switch to English' }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  const toolsLtr = await box(page, '.gws-slot-tools');
  expect(toolsLtr.x).toBeGreaterThan(vp.width / 2);
  await expect(page.getByTestId('theme-toggle')).toHaveAccessibleName('Switch to dark map');
  expect(await mapInstances(page)).toBe(1);
});

test('first open frames all of Israel', async ({ page }) => {
  const v = await page.evaluate(() => (window as unknown as { __gws: Gws }).__gws.mapService.getView());
  expect(v.center[0]).toBeGreaterThan(34.5);
  expect(v.center[0]).toBeLessThan(35.7);
  expect(v.center[1]).toBeGreaterThan(31);
  expect(v.center[1]).toBeLessThan(31.8);
});

test('language, basemap, theme and camera survive a refresh', async ({ page }) => {
  await page.getByRole('button', { name: 'Switch to English' }).click();
  await page.getByTestId('theme-toggle').click();
  await page.getByTestId('basemap-picker').click();
  await page.getByTestId('basemap-option-satellite').click();
  const map = await box(page, 'main');
  await page.mouse.move(map.x + map.width / 2, map.y + map.height / 2);
  await page.mouse.wheel(0, -600);
  await page.waitForTimeout(800);
  const before = await page.getByTestId('zoom-level').textContent();
  await page.waitForTimeout(400); // debounce
  await page.reload();
  await page.locator('.maplibregl-canvas').waitFor();
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await page.getByTestId('basemap-picker').click();
  await expect(page.getByTestId('basemap-option-satellite')).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Escape');
  await page.getByTestId('basemap-picker').click();
  await page.getByTestId('basemap-option-map').click();
  await expect(page.getByTestId('theme-toggle')).toHaveAccessibleName('Switch to light map'); // dark kept
  await expect(page.getByTestId('zoom-level')).toHaveText(before!);
});
