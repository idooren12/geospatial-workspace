import type { Page } from '@playwright/test';
import { expect, freshStart, test } from './fixtures';

/**
 * Visual regression (M5 #15): a small, deterministic set of full-window snapshots — offline styles,
 * local glyphs and imagery, a fixed camera, web fonts blocked (system fallback), animations off.
 *
 * Baselines depend on the browser build and system fonts, so they are only compared where they were
 * made: run with VISUAL=1 (`npm run test:visual`, update with `-- --update-snapshots`). CI skips them.
 */
test.skip(!process.env.VISUAL, 'visual snapshots run with VISUAL=1');

const VIEW = { center: [34.95, 31.9], zoom: 9, bearing: 0, pitch: 0 };

async function start(page: Page, prefs: Record<string, unknown>, size = { width: 1366, height: 768 }) {
  await page.setViewportSize(size);
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await freshStart(page, { view: VIEW, ...prefs });
}

async function clickMap(page: Page, fx: number, fy: number, opts: { double?: boolean } = {}) {
  const b = (await page.getByTestId('map-cell').boundingBox())!;
  const x = b.x + b.width * fx;
  const y = b.y + b.height * fy;
  if (opts.double) await page.mouse.dblclick(x, y);
  else await page.mouse.click(x, y);
  await page.waitForTimeout(150);
}

/** A point, a named line (mixed Hebrew/English) and a polygon in one drawing layer. */
async function drawings(page: Page) {
  await page.getByTestId('draw-button').click();
  await page.getByTestId('tool-point').click();
  await clickMap(page, 0.25, 0.45);
  await page.getByTestId('tool-polygon').click();
  for (const [x, y] of [[0.45, 0.25], [0.65, 0.25], [0.65, 0.55], [0.45, 0.25]] as const) await clickMap(page, x, y);
  await page.getByTestId('tool-line').click();
  await clickMap(page, 0.3, 0.75);
  await clickMap(page, 0.7, 0.8, { double: true });
  await page.getByTestId('tool-line').click();
  await page.getByTestId('drawing-name').first().dblclick();
  await page.keyboard.type('כביש Route 6');
  await page.keyboard.press('Enter');
}

async function snap(page: Page, name: string) {
  await page.mouse.move(1, 1); // off the map: tooltips closed, hover states cleared
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.waitForFunction(() => (window as unknown as { __gws: { map: { loaded(): boolean } } }).__gws.map.loaded());
  await page.waitForTimeout(300);
  await expect(page.locator('.maplibregl-ctrl-attrib')).toBeVisible(); // every snapshot shows the credits
  await expect(page).toHaveScreenshot(`${name}.png`, { animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.005 });
}

test.describe('visual', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== '1366', 'each case sets its own window size'));

  test('light map, Hebrew, docks on both sides', async ({ page }) => {
    await start(page, { settings: { language: 'he' } });
    await page.getByTestId('layers-button').click();
    await page.getByTestId('measure-button').click();
    await snap(page, 'light-he-both-docks');
  });

  test('dark map, English, drawing labels unselected', async ({ page }) => {
    await start(page, { mapTheme: 'dark', settings: { language: 'en' } });
    await drawings(page);
    await snap(page, 'dark-en-labels-unselected');
  });

  test('dark map, English, a polygon selected', async ({ page }) => {
    await start(page, { mapTheme: 'dark', settings: { language: 'en' } });
    await drawings(page);
    await page.getByTestId('drawing-list').locator('li').nth(1).click(); // Polygon 1
    await snap(page, 'dark-en-label-selected');
  });

  test('satellite, Hebrew, labels and a selected point', async ({ page }) => {
    await start(page, { basemapId: 'satellite', settings: { language: 'he' } });
    await drawings(page);
    await page.getByTestId('drawing-list').locator('li').nth(2).click(); // the point
    await snap(page, 'satellite-he-labels');
  });

  test('several panels on one side (1920)', async ({ page }) => {
    await start(page, { settings: { language: 'en' } }, { width: 1920, height: 1080 });
    await page.getByTestId('measure-button').click();
    await page.getByTestId('draw-button').click();
    await page.getByTestId('topbar-settings').click();
    await page.getByTestId('layers-button').click();
    await snap(page, 'multi-panels-1920');
  });

  test('map at its minimum width, attribution wrapping', async ({ page }) => {
    await start(page, { basemapId: 'satellite', settings: { language: 'he' } }, { width: 1068, height: 768 });
    await page.getByTestId('layers-button').click();
    await page.getByTestId('measure-button').click();
    for (const sp of await page.getByTestId('splitter').all()) {
      await sp.focus();
      await page.keyboard.press('End');
    }
    await snap(page, 'min-map-width');
  });

  test('Map Only', async ({ page }) => {
    await start(page, { settings: { language: 'he' } });
    await page.getByTestId('layers-button').click();
    await page.getByTestId('map-only').click();
    await snap(page, 'map-only');
  });
});
