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

test('fixed top bar and status bar; the map fills everything between them, edge to edge', async ({ page }) => {
  const vp = page.viewportSize()!;
  const top = await box(page, 'header');
  const map = await box(page, 'main');
  const status = await box(page, '[data-testid="status-bar"]');
  expect(map.x).toBe(0);
  expect(map.width).toBe(vp.width);
  expect(map.y).toBeCloseTo(top.height, 0);
  expect(status.height).toBeGreaterThanOrEqual(24); // spec §9.1: 24 px (+1 px border)
  expect(status.height).toBeLessThanOrEqual(28);
  expect(map.y + map.height).toBeCloseTo(status.y, 0); // the status bar is below the map, never on it
  expect(status.y + status.height).toBeCloseTo(vp.height, 0);
  const canvas = await box(page, '.maplibregl-canvas');
  expect(Math.round(canvas.width)).toBe(vp.width); // MAP-02
  expect(Math.round(canvas.height)).toBe(Math.round(map.height));
});

test('status bar shows cursor coordinates, zoom and basemap (DoD 16)', async ({ page }) => {
  const map = await box(page, 'main');
  await page.mouse.move(map.x + map.width / 2, map.y + map.height / 2);
  await expect(page.getByTestId('cursor-coords')).toHaveText(/^\d+\.\d{5} [NS], \d+\.\d{5} [EW]$/);
  await expect(page.getByTestId('zoom-level')).toHaveText(/^\d+\.\d$/);
  await expect(page.getByTestId('status-basemap')).toHaveText('מפה · בהיר');
  // Leaving the map keeps the last position (dimmed) so it can be copied.
  await page.mouse.move(5, 5);
  await expect(page.getByTestId('cursor-coords')).toHaveAttribute('data-stale', 'true');
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  const shown = await page.getByTestId('cursor-coords').textContent();
  await page.getByTestId('status-coords').click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(shown);
  // Map Only hides the status bar (spec §4.6) and gives the row to the map.
  await page.getByTestId('map-only').click();
  await expect(page.getByTestId('status-bar')).toBeHidden();
  const full = await box(page, 'main');
  expect(full.y + full.height).toBeCloseTo(page.viewportSize()!.height, 0);
});

test('the layers button opens the Layers panel, where the basemap is chosen', async ({ page }) => {
  await expect(page.getByTestId('theme-toggle')).toHaveAccessibleName('מעבר למפה כהה');
  await page.getByTestId('layers-button').click();
  await expect(page.getByTestId('panel-layers')).toBeVisible();
  await expect(page.getByTestId('layers-button')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('layers-basemap-map')).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('layers-basemap-satellite').click();
  await expect(page.getByTestId('theme-toggle')).toHaveCount(0);
  await expect
    .poll(() => gws(page, () => (window as unknown as { __gws: Gws }).__gws.map.getStyle()?.layers[0]?.id))
    .toBe('basemap-imagery');
  await page.getByTestId('layers-basemap-map').click();
  await page.getByTestId('theme-toggle').click();
  await expect(page.getByTestId('theme-toggle')).toHaveAccessibleName('מעבר למפה בהירה');
  await page.getByTestId('layers-button').click();
  await expect(page.getByTestId('panel-layers')).toHaveCount(0);
  expect(await mapInstances(page)).toBe(1);
});

test('settings open from the top bar only; no built-in buttons on the map edges', async ({ page }) => {
  await expect(page.getByTestId('rail-btn-settings')).toHaveCount(0);
  await expect(page.getByTestId('rail-btn-layers')).toHaveCount(0);
  await page.getByTestId('topbar-settings').click();
  await expect(page.getByTestId('panel-settings')).toBeVisible();
  await page.getByTestId('topbar-settings').click();
  await expect(page.getByTestId('panel-settings')).toHaveCount(0);
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
  await page.getByTestId('layers-button').click();
  await page.getByTestId('layers-basemap-satellite').click();
  const map = await box(page, 'main');
  await page.mouse.move(map.x + map.width / 2, map.y + map.height / 2);
  await page.mouse.wheel(0, -600);
  await page.waitForTimeout(800);
  const before = await page.getByTestId('zoom-level').textContent();
  await page.waitForTimeout(400); // debounce
  await page.reload();
  await page.locator('.maplibregl-canvas').waitFor();
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.getByTestId('layers-basemap-satellite')).toHaveAttribute('aria-checked', 'true'); // panel restored too
  await page.getByTestId('layers-basemap-map').click();
  await expect(page.getByTestId('theme-toggle')).toHaveAccessibleName('Switch to light map'); // dark kept
  await expect(page.getByTestId('zoom-level')).toHaveText(before!);
});
