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

type Gws = {
  map: { getZoom(): number; getStyle(): { layers: { id: string; type: string; layout?: Record<string, unknown> }[] } };
  layers: { list(): { id: string; name: string; group?: string; source?: { data?: { features: { properties: { name: string } }[] } } }[] };
};

/** Drawing layers and the names of their shapes. */
const drawingLayers = (page: Page) =>
  page.evaluate(() =>
    (window as unknown as { __gws: Gws }).__gws.layers
      .list()
      .filter((l) => l.group === 'drawing')
      .map((l) => ({ id: l.id, name: l.name, shapes: (l.source?.data?.features ?? []).map((f) => f.properties.name) })),
  );

const zoom = (page: Page) => page.evaluate(() => (window as unknown as { __gws: Gws }).__gws.map.getZoom());

const styleLayers = (page: Page) =>
  page.evaluate(() => (window as unknown as { __gws: Gws }).__gws.map.getStyle().layers.map((l) => ({ id: l.id, type: l.type })));

/** Turns a tool button on or off, whatever its current state. */
async function setTool(page: Page, id: string, on: boolean) {
  const b = page.getByTestId(`tool-${id}`);
  if ((await b.getAttribute('aria-pressed')) !== String(on)) await b.click();
  await expect(b).toHaveAttribute('aria-pressed', String(on));
}

async function measureDistance(page: Page) {
  await setTool(page, 'distance', true);
  await clickMap(page, 0.3, 0.5);
  await clickMap(page, 0.6, 0.5, { double: true });
}

for (const lang of ['he', 'en'] as const) {
  const he = lang === 'he';

  test.describe(`measurements (${lang})`, () => {
    test.beforeEach(async ({ page }) => {
      await freshStart(page, he ? undefined : { settings: { language: 'en' } });
      await page.getByTestId('measure-button').click();
      await expect(page.getByTestId('panel-measure')).toBeVisible();
      await expect(page.getByTestId('saved-empty')).toBeVisible();
    });

    test('measures a distance live and keeps the result when finished (UTL-03)', async ({ page }) => {
      await page.getByTestId('tool-distance').click();
      await expect(page.getByTestId('draw-hint')).toBeVisible();
      await clickMap(page, 0.3, 0.4);
      await clickMap(page, 0.5, 0.5);
      await expect(page.getByTestId('measure-result')).toBeVisible(); // live, while drawing
      await expect(page.getByTestId('measure-save')).toHaveCount(0); // not savable until finished
      const z = await zoom(page);
      await clickMap(page, 0.7, 0.45, { double: true });
      const result = page.getByTestId('measure-result');
      await expect(result).toContainText(he ? /ק״מ|מ׳/ : /km|m\b/);
      await expect(result).toContainText(he ? '3 נקודות' : '3 points');
      expect(await zoom(page)).toBeCloseTo(z, 5); // double click finished the line, did not zoom
    });

    test('measures an area with its perimeter (UTL-04)', async ({ page }) => {
      await page.getByTestId('tool-area').click();
      await clickMap(page, 0.3, 0.3);
      await clickMap(page, 0.6, 0.3);
      await clickMap(page, 0.6, 0.6);
      await clickMap(page, 0.3, 0.3); // close on the first point
      const result = page.getByTestId('measure-result');
      await expect(result).toContainText(he ? /קמ״ר|הקטאר|מ״ר/ : /km²|ha|m²/);
      await expect(result).toContainText(he ? 'היקף' : 'Perimeter');
      await page.getByTestId('measure-clear').click();
      await expect(page.getByTestId('measure-result')).toHaveCount(0);
    });

    test('saves measurements to their own list: name, hide, rename, delete, survives reload', async ({ page }) => {
      test.slow();
      await measureDistance(page);
      const value = (await page.getByTestId('measure-result').locator('div').first().textContent())!;
      await page.getByTestId('measure-name').fill(he ? 'גדר צפונית' : 'North fence');
      await page.getByTestId('measure-save').click();
      await expect(page.getByTestId('measure-result')).toHaveCount(0); // the temporary one is gone

      const list = page.getByTestId('saved-list');
      await expect(list.getByTestId('saved-name')).toHaveText(he ? 'גדר צפונית' : 'North fence');
      await expect(list.getByTestId('saved-value')).toHaveText(value);
      // Drawn and labelled on the map; not a layer.
      const ids = (await styleLayers(page)).map((l) => l.id);
      expect(ids).toEqual(expect.arrayContaining(['ws:measurements:line', 'ws:measurements:label-line']));
      expect(await drawingLayers(page)).toHaveLength(0);

      // A second one gets a default name.
      await measureDistance(page);
      await page.getByTestId('measure-save').click();
      await expect(list.getByTestId('saved-name')).toHaveCount(2);
      await expect(list.getByTestId('saved-name').first()).toHaveText(he ? 'מדידה 2' : 'Measurement 2');

      await list.getByTestId('saved-name').first().dblclick();
      await page.getByTestId('saved-name-input').fill(he ? 'כביש' : 'Road');
      await page.keyboard.press('Enter');
      await expect(list.getByTestId('saved-name').first()).toHaveText(he ? 'כביש' : 'Road');

      await list.getByTestId('saved-visibility').last().click();
      await expect(list.getByTestId('saved-visibility').last()).toHaveAttribute('aria-pressed', 'false');

      await page.waitForTimeout(400);
      await page.reload();
      await page.locator('.maplibregl-canvas').waitFor();
      await expect(page.getByTestId('panel-measure')).toBeVisible(); // the open panel is restored
      await expect(list.getByTestId('saved-name')).toHaveText(he ? ['כביש', 'גדר צפונית'] : ['Road', 'North fence']);
      await expect(list.getByTestId('saved-visibility').last()).toHaveAttribute('aria-pressed', 'false');

      await list.getByTestId('saved-remove').first().click();
      await expect(list.getByTestId('saved-name')).toHaveCount(1);
    });

    test('closing the panel stops the tool and clears the temporary measurement', async ({ page }) => {
      await measureDistance(page);
      await page.getByTestId('measure-button').click(); // close
      await expect(page.getByTestId('panel-measure')).toHaveCount(0);
      const z = await zoom(page);
      await clickMap(page, 0.5, 0.5, { double: true }); // normal map again: double click zooms
      await expect.poll(() => zoom(page)).toBeGreaterThan(z + 0.5);
      await page.getByTestId('measure-button').click();
      await expect(page.getByTestId('measure-result')).toHaveCount(0);
    });

    test('a measurement in progress survives a basemap switch', async ({ page }) => {
      await measureDistance(page);
      const before = await page.getByTestId('measure-result').textContent();
      await page.getByTestId('layers-button').click();
      await page.getByTestId('layers-basemap-satellite').click();
      await page.waitForFunction(() =>
        (window as unknown as { __gws: Gws }).__gws.map.getStyle()?.layers.some((l) => l.id === 'basemap-imagery'),
      );
      await expect(page.getByTestId('measure-result')).toHaveText(before!);
      expect((await styleLayers(page)).filter((l) => l.id.startsWith('td')).length).toBeGreaterThan(0);
    });

    test('clicking a saved measurement on the map opens Measurements and reveals it', async ({ page }) => {
      await measureDistance(page);
      await page.getByTestId('measure-save').click();
      await setTool(page, 'distance', false);
      await page.getByTestId('measure-button').click(); // close
      await expect(page.getByTestId('panel-measure')).toHaveCount(0);
      await page.waitForTimeout(300);
      await clickMap(page, 0.45, 0.5); // on the saved line
      await expect(page.getByTestId('panel-measure')).toBeVisible();
      await expect(page.getByTestId('saved-list').locator('li').first()).toHaveAttribute('data-revealed', 'true');
    });
  });

  test.describe(`drawing layers (${lang})`, () => {
    test.beforeEach(async ({ page }) => {
      await freshStart(page, he ? undefined : { settings: { language: 'en' } });
      await page.getByTestId('draw-button').click();
      await expect(page.getByTestId('panel-draw')).toBeVisible();
    });

    test('drawings group into one named layer, with names on the map (UTL-05)', async ({ page }) => {
      test.slow(); // long flow with a reload; software WebGL at 2560 px is slow
      // No layer yet: the first shape creates one.
      await page.getByTestId('tool-point').click();
      await clickMap(page, 0.4, 0.4);
      await expect.poll(() => drawingLayers(page)).toEqual([
        expect.objectContaining({ name: he ? 'ציור 1' : 'Drawing 1', shapes: [he ? 'נקודה 1' : 'Point 1'] }),
      ]);

      await page.getByTestId('tool-line').click();
      await clickMap(page, 0.3, 0.6);
      await clickMap(page, 0.5, 0.65, { double: true });
      await page.getByTestId('tool-polygon').click();
      await clickMap(page, 0.55, 0.3);
      await clickMap(page, 0.7, 0.3);
      await clickMap(page, 0.7, 0.45);
      await clickMap(page, 0.55, 0.3);
      await expect.poll(async () => (await drawingLayers(page)).map((l) => l.shapes.length)).toEqual([3]); // one layer
      await expect(page.getByTestId('drawing-list').getByTestId('drawing-name')).toHaveCount(3);

      // Each shape is labelled with its name.
      const symbols = (await styleLayers(page)).filter((l) => l.type === 'symbol' && l.id.startsWith('ws:'));
      expect(symbols.length).toBeGreaterThan(0);

      // Rename a shape.
      await setTool(page, 'polygon', false);
      await page.getByTestId('drawing-name').first().dblclick();
      await page.getByTestId('drawing-name-input').fill(he ? 'מחסן' : 'Depot');
      await page.keyboard.press('Enter');
      await expect.poll(async () => (await drawingLayers(page))[0]!.shapes).toContain(he ? 'מחסן' : 'Depot');

      // A second, named layer takes the next drawings.
      await page.getByTestId('draw-target').selectOption('__new__');
      await page.getByTestId('draw-new-name').fill(he ? 'מכשולים' : 'Obstacles');
      await page.getByTestId('draw-new-create').click();
      await expect(page.getByTestId('drawings-empty')).toBeVisible();
      await page.getByTestId('tool-point').click();
      await clickMap(page, 0.2, 0.3);
      await expect.poll(async () => (await drawingLayers(page)).map((l) => [l.name, l.shapes.length])).toEqual([
        [he ? 'ציור 1' : 'Drawing 1', 3],
        [he ? 'מכשולים' : 'Obstacles', 1],
      ]);

      // Both are layers in the Layers panel, and survive a reload.
      await setTool(page, 'point', false);
      await page.getByTestId('layers-button').click();
      await expect(page.getByTestId('layer-list')).toContainText(he ? 'מכשולים' : 'Obstacles');
      await page.waitForTimeout(400);
      await page.reload();
      await page.locator('.maplibregl-canvas').waitFor();
      await expect.poll(async () => (await drawingLayers(page)).map((l) => l.shapes.length)).toEqual([3, 1]);

      // Delete a shape from the Draw panel.
      await expect(page.getByTestId('panel-draw')).toBeVisible(); // restored with the layout
      await page.getByTestId('draw-target').selectOption({ label: he ? 'מכשולים' : 'Obstacles' });
      await page.getByTestId('drawing-remove').click();
      await expect.poll(async () => (await drawingLayers(page)).map((l) => l.shapes.length)).toEqual([3, 0]);
    });

    test('clicking a drawing with Layers closed opens Layers and reveals that layer', async ({ page }) => {
      await page.getByTestId('tool-polygon').click();
      await clickMap(page, 0.4, 0.3);
      await clickMap(page, 0.6, 0.3);
      await clickMap(page, 0.6, 0.6);
      await clickMap(page, 0.4, 0.3);
      await setTool(page, 'polygon', false);
      await page.getByTestId('draw-button').click(); // close the Draw panel
      await expect(page.getByTestId('panel-layers')).toHaveCount(0);

      await clickMap(page, 0.52, 0.45); // inside the polygon
      await expect(page.getByTestId('panel-layers')).toBeVisible();
      const [layer] = await drawingLayers(page);
      const row = page.getByTestId(`layer-row-${layer!.id}`);
      await expect(row).toHaveAttribute('data-revealed', 'true');
      await expect(row.getByTestId('layer-expand')).toHaveAttribute('aria-expanded', 'true');
      await expect(row.getByTestId('layer-drawings').locator('li')).toHaveCount(1);
      await expect(row.getByTestId('layer-drawing-name')).toHaveText(he ? 'פוליגון 1' : 'Polygon 1');
    });

    test('Escape cancels the shape in progress', async ({ page }) => {
      await page.getByTestId('tool-line').click();
      await clickMap(page, 0.3, 0.5);
      await clickMap(page, 0.5, 0.5);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);
      expect(await drawingLayers(page)).toHaveLength(0);
    });
  });
}

test('double click zooms the map when no drawing tool is active', async ({ page }) => {
  await freshStart(page);
  const z = await zoom(page);
  await clickMap(page, 0.5, 0.5, { double: true });
  await expect.poll(() => zoom(page)).toBeGreaterThan(z + 0.5);
});
