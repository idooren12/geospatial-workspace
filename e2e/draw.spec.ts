import type { Page } from '@playwright/test';
import { expect, freshStart, test } from './fixtures';

/** Clicks at fractions of the map cell (0..1), away from the floating controls. */
async function clickMap(page: Page, fx: number, fy: number, opts: { double?: boolean } = {}) {
  const b = (await page.getByTestId('map-cell').boundingBox())!;
  const x = b.x + b.width * fx;
  const y = b.y + b.height * fy;
  await page.mouse.move(x, y, { steps: 3 });
  if (opts.double) await page.mouse.dblclick(x, y);
  else await page.mouse.click(x, y);
  await page.waitForTimeout(120);
}

const sketchFeatures = (page: Page) =>
  page.evaluate(() => {
    const l = (window as unknown as { __gws: { layers: { list(): { id: string; source?: { data?: { features: unknown[] } } }[] } } }).__gws.layers
      .list()
      .find((x) => x.id === 'sketch');
    return l?.source?.data?.features.length ?? 0;
  });

const zoom = (page: Page) =>
  page.evaluate(() => (window as unknown as { __gws: { map: { getZoom(): number } } }).__gws.map.getZoom());

for (const lang of ['he', 'en'] as const) {
  test.describe(`measure & draw (${lang})`, () => {
    test.beforeEach(async ({ page }) => {
      await freshStart(page, lang === 'en' ? { settings: { language: 'en' } } : undefined);
      await page.getByTestId('measure-button').click();
      await expect(page.getByTestId('panel-measure')).toBeVisible();
    });

    test('measures a distance live and keeps the result when finished (UTL-03)', async ({ page }) => {
      await page.getByTestId('tool-distance').click();
      await expect(page.getByTestId('draw-hint')).toBeVisible();
      await clickMap(page, 0.3, 0.4);
      await clickMap(page, 0.5, 0.5);
      await expect(page.getByTestId('measure-result')).toBeVisible(); // live, while drawing
      const z = await zoom(page);
      await clickMap(page, 0.7, 0.45, { double: true }); // add the last point and finish
      const result = page.getByTestId('measure-result');
      await expect(result).toContainText(lang === 'he' ? /ק״מ|מ׳/ : /km|m\b/);
      await expect(result).toContainText(lang === 'he' ? '3 נקודות' : '3 points');
      expect(await zoom(page)).toBeCloseTo(z, 5); // double click finished the line, did not zoom
    });

    test('measures an area with its perimeter (UTL-04)', async ({ page }) => {
      await page.getByTestId('tool-area').click();
      await clickMap(page, 0.3, 0.3);
      await clickMap(page, 0.6, 0.3);
      await clickMap(page, 0.6, 0.6);
      await clickMap(page, 0.3, 0.3); // close on the first point
      const result = page.getByTestId('measure-result');
      await expect(result).toContainText(lang === 'he' ? /קמ״ר|הקטאר|מ״ר/ : /km²|ha|m²/);
      await expect(result).toContainText(lang === 'he' ? 'היקף' : 'Perimeter');
      await page.getByTestId('measure-clear').click();
      await expect(page.getByTestId('measure-result')).toHaveCount(0);
    });

    test('draws point, line and polygon into a session Sketch layer (UTL-05)', async ({ page }) => {
      await page.getByTestId('tool-point').click();
      await clickMap(page, 0.4, 0.4);
      await expect.poll(() => sketchFeatures(page)).toBe(1);

      await page.getByTestId('tool-line').click();
      await clickMap(page, 0.3, 0.6);
      await clickMap(page, 0.5, 0.65, { double: true });
      await expect.poll(() => sketchFeatures(page)).toBe(2);

      await page.getByTestId('tool-polygon').click();
      await clickMap(page, 0.55, 0.3);
      await clickMap(page, 0.7, 0.3);
      await clickMap(page, 0.7, 0.45);
      await clickMap(page, 0.55, 0.3);
      await expect.poll(() => sketchFeatures(page)).toBe(3);
      await expect(page.getByTestId('sketch-count')).toContainText('3');

      // Listed in the Layers panel as a normal workspace layer.
      await page.getByTestId('tool-polygon').click(); // stop drawing
      await page.getByTestId('layers-button').click();
      await expect(page.getByTestId('layer-list')).toContainText(lang === 'he' ? 'שרטוט' : 'Sketch');

      // Undo and survive a refresh (session).
      await page.getByTestId('sketch-undo').click();
      await expect.poll(() => sketchFeatures(page)).toBe(2);
      await page.waitForTimeout(400);
      await page.reload();
      await page.locator('.maplibregl-canvas').waitFor();
      await expect.poll(() => sketchFeatures(page)).toBe(2);

      await page.getByTestId('sketch-clear').click();
      await expect.poll(() => sketchFeatures(page)).toBe(0);
    });

    test('closing the panel stops the tool and clears the temporary measurement', async ({ page }) => {
      await page.getByTestId('tool-distance').click();
      await clickMap(page, 0.3, 0.5);
      await clickMap(page, 0.6, 0.5, { double: true });
      await page.getByTestId('measure-button').click(); // close
      await expect(page.getByTestId('panel-measure')).toHaveCount(0);
      const z = await zoom(page);
      await clickMap(page, 0.5, 0.5, { double: true }); // normal map again: double click zooms
      await expect.poll(() => zoom(page)).toBeGreaterThan(z + 0.5);
      await page.getByTestId('measure-button').click();
      await expect(page.getByTestId('measure-result')).toHaveCount(0);
    });

    test('Escape cancels the shape in progress', async ({ page }) => {
      await page.getByTestId('tool-line').click();
      await clickMap(page, 0.3, 0.5);
      await clickMap(page, 0.5, 0.5);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);
      expect(await sketchFeatures(page)).toBe(0);
    });

    test('a measurement survives a basemap switch', async ({ page }) => {
      await page.getByTestId('tool-distance').click();
      await clickMap(page, 0.3, 0.5);
      await clickMap(page, 0.6, 0.5, { double: true });
      const before = await page.getByTestId('measure-result').textContent();
      await page.getByTestId('layers-button').click();
      await page.getByTestId('layers-basemap-satellite').click();
      await page.waitForFunction(() =>
        (window as unknown as { __gws: { map: { getStyle(): { layers: { id: string }[] } } } }).__gws.map
          .getStyle()
          ?.layers.some((l) => l.id === 'basemap-imagery'),
      );
      // The measure panel is still open beside the Layers panel.
      await expect(page.getByTestId('measure-result')).toHaveText(before!);
      const drawn = await page.evaluate(() =>
        (window as unknown as { __gws: { map: { getStyle(): { layers: { id: string }[] } } } }).__gws.map
          .getStyle()
          .layers.filter((l) => l.id.startsWith('td')).length,
      );
      expect(drawn).toBeGreaterThan(0);
    });
  });
}

test('double click zooms the map when no drawing tool is active', async ({ page }) => {
  await freshStart(page);
  const z = await zoom(page);
  await clickMap(page, 0.5, 0.5, { double: true });
  await expect.poll(() => zoom(page)).toBeGreaterThan(z + 0.5);
});
