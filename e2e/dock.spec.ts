import { expect, test, type Locator, type Page } from '@playwright/test';

type Box = { x: number; y: number; width: number; height: number };
const boxOf = async (l: Locator): Promise<Box> => {
  const b = await l.boundingBox();
  if (!b) throw new Error('no bounding box');
  return b;
};
const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width - 0.5 && b.x < a.x + a.width - 0.5 && a.y < b.y + b.height - 0.5 && b.y < a.y + a.height - 0.5;

/** Built-ins open from the map's layers button / the top bar; dev tools from the rails. */
const openerOf = (page: Page, id: string) =>
  page.getByTestId(id === 'layers' ? 'layers-button' : id === 'settings' ? 'topbar-settings' : `rail-btn-${id}`);

const mapInstances = (page: Page) =>
  page.evaluate(() => (window as unknown as { __gws: { mapService: { instanceCount: number } } }).__gws.mapService.instanceCount);

/** Panels, map and canvas must tile the body: no overlap, canvas = map cell (DCK-01/02, MAP-02). */
async function assertLayout(page: Page) {
  const columns = await page.getByTestId('dock-column').all();
  const visible: Box[] = [];
  for (const c of columns) if (await c.isVisible()) visible.push(await boxOf(c));
  const map = await boxOf(page.getByTestId('map-cell'));
  for (let i = 0; i < visible.length; i++) {
    expect(overlaps(visible[i]!, map), 'panel overlaps map').toBe(false);
    for (let j = i + 1; j < visible.length; j++) expect(overlaps(visible[i]!, visible[j]!), 'panels overlap').toBe(false);
  }
  expect(map.width).toBeGreaterThanOrEqual(499);
  await expect
    .poll(async () => Math.round((await boxOf(page.locator('.maplibregl-canvas'))).width))
    .toBe(Math.round(map.width));
}

for (const lang of ['he', 'en'] as const) {
  test.describe(`dock (${lang})`, () => {
    test.beforeEach(async ({ page }) => {
      // Seed storage before the app runs, once per test (reloads inside a test keep their state).
      await page.addInitScript((l) => {
        if (sessionStorage.getItem('e2e-seeded')) return;
        sessionStorage.setItem('e2e-seeded', '1');
        localStorage.clear();
        if (l === 'en') localStorage.setItem('gws:workspace:v1', JSON.stringify({ settings: { language: 'en' } }));
      }, lang);
      await page.goto('/');
      await page.locator('.maplibregl-canvas').waitFor();
    });

    test('a panel takes width from the map and gives it all back when closed (DCK-01, DCK-05)', async ({ page }) => {
      const full = (await boxOf(page.getByTestId('map-cell'))).width;
      await openerOf(page, 'layers').click();
      await expect(page.getByTestId('panel-layers')).toBeVisible();
      const withPanel = (await boxOf(page.getByTestId('map-cell'))).width;
      expect(full - withPanel).toBeCloseTo(280 + 4, 0);
      await assertLayout(page);
      await page.getByTestId('panel-close').click();
      await expect(page.getByTestId('dock-column')).toHaveCount(0);
      await expect.poll(async () => (await boxOf(page.getByTestId('map-cell'))).width).toBeCloseTo(full, 0);
      expect(await mapInstances(page)).toBe(1);
    });

    test('the Layers panel docks on the reading-start side', async ({ page }) => {
      await openerOf(page, 'layers').click();
      const col = await boxOf(page.getByTestId('dock-column'));
      const vp = page.viewportSize()!;
      if (lang === 'he') expect(col.x + col.width).toBeCloseTo(vp.width, 0);
      else expect(col.x).toBeCloseTo(0, 0);
    });

    test('both sides open at once, several panels per side, never overlapping (DCK-02..04)', async ({ page }) => {
      for (const id of ['layers', 'sample', 'settings', 'debug']) await openerOf(page, id).click();
      await assertLayout(page);
      const vp = page.viewportSize()!;
      const columns = page.getByTestId('dock-column');
      // At 1366 the fourth panel becomes a tab; wider screens fit four columns.
      await expect(columns).toHaveCount(vp.width >= 1920 ? 4 : 3);
      expect(await mapInstances(page)).toBe(1);
    });

    test('a rail click on a hidden tab shows it; a second click closes it', async ({ page }) => {
      // 900 px: a second column on the same side would leave the map under 500 px → tabs (overflow).
      await page.setViewportSize({ width: 900, height: 700 });
      await openerOf(page, 'settings').click();
      await page.getByTestId('rail-btn-debug').click();
      await expect(page.getByRole('tab')).toHaveCount(2);
      await expect(page.getByTestId('panel-settings')).toBeHidden();
      await openerOf(page, 'settings').click();
      await expect(page.getByTestId('panel-settings')).toBeVisible();
      await openerOf(page, 'settings').click();
      await expect(page.getByTestId('panel-settings')).toHaveCount(0);
      await expect(page.getByTestId('panel-debug')).toBeVisible();
    });

    test('splitter resizes within limits and the map follows (spec §5.3)', async ({ page }) => {
      await openerOf(page, 'layers').click();
      const splitter = page.getByTestId('splitter');
      const s = await boxOf(splitter);
      const towardMap = (lang === 'he') === true ? -1 : 1; // start side: map is inline-end
      await page.mouse.move(s.x + s.width / 2, s.y + 200);
      await page.mouse.down();
      await page.mouse.move(s.x + s.width / 2 + towardMap * 60, s.y + 200, { steps: 5 });
      await page.mouse.move(s.x + s.width / 2 + towardMap * 100, s.y + 200, { steps: 5 });
      await page.mouse.up();
      await expect(splitter).toHaveAttribute('aria-valuenow', '380');
      await assertLayout(page);
      // Way past the maximum: clamped to 450.
      await page.mouse.move(s.x + s.width / 2 + towardMap * 100, s.y + 200);
      await page.mouse.down();
      await page.mouse.move(s.x + s.width / 2 + towardMap * 600, s.y + 200, { steps: 8 });
      await page.mouse.up();
      await expect(splitter).toHaveAttribute('aria-valuenow', '450');
      // Keyboard: Home → minimum.
      await splitter.focus();
      await page.keyboard.press('Home');
      await expect(splitter).toHaveAttribute('aria-valuenow', '220');
      await assertLayout(page);
      expect(await mapInstances(page)).toBe(1);
    });

    test('Map Only hides every panel and restores the same layout (spec §5.5)', async ({ page }) => {
      for (const id of ['layers', 'settings']) await openerOf(page, id).click();
      const before = await page.getByTestId('dock-column').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().width));
      await page.getByTestId('map-only').click();
      await expect(page.getByTestId('dock-column').first()).toBeHidden();
      await expect(page.getByTestId('rail-left')).toHaveCount(0);
      expect((await boxOf(page.getByTestId('map-cell'))).width).toBe(page.viewportSize()!.width);
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('dock-column').first()).toBeVisible();
      const after = await page.getByTestId('dock-column').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().width));
      expect(after).toEqual(before);
      await page.keyboard.press('Control+Shift+M');
      await expect(page.getByTestId('dock-column').first()).toBeHidden();
      expect(await mapInstances(page)).toBe(1);
    });

    test('tab menu moves a panel to the other side', async ({ page }) => {
      await openerOf(page, 'layers').click();
      const before = await boxOf(page.getByTestId('dock-column'));
      await page.getByTestId('panel-menu').click();
      await page.getByTestId('menu-move').click();
      const after = await boxOf(page.getByTestId('dock-column'));
      expect(Math.sign(after.x - before.x)).not.toBe(0);
      await assertLayout(page);
    });

    test('dock layout survives a refresh (spec §12)', async ({ page }) => {
      await openerOf(page, 'layers').click();
      await openerOf(page, 'settings').click();
      const splitter = page.getByTestId('splitter').first();
      await splitter.focus();
      await page.keyboard.press('End');
      await page.waitForTimeout(400); // debounced save
      await page.reload();
      await page.locator('.maplibregl-canvas').waitFor();
      await expect(page.getByTestId('panel-layers')).toBeVisible();
      await expect(page.getByTestId('panel-settings')).toBeVisible();
      await expect(page.getByTestId('splitter').first()).toHaveAttribute('aria-valuenow', '450');
    });

    test('shrinking the window keeps the map usable by tabbing panels', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 900 });
      for (const id of ['layers', 'sample', 'settings', 'debug']) await openerOf(page, id).click();
      await expect(page.getByTestId('dock-column')).toHaveCount(4);
      await page.setViewportSize({ width: 1100, height: 800 });
      await expect.poll(() => page.getByTestId('dock-column').count()).toBeLessThan(4);
      await assertLayout(page);
      for (const id of ['layers', 'sample', 'settings', 'debug']) await expect(page.getByTestId(`panel-${id}`)).toHaveCount(1);
    });
  });
}
