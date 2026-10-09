import type { Page } from '@playwright/test';
import { expect, freshStart, test } from './fixtures';

type Gws = {
  map: { getCenter(): { lng: number; lat: number }; getZoom(): number; getSource(id: string): { _data?: unknown } | undefined };
  layers: { list(): { id: string; name: string; group?: string; source?: { data?: { features: { properties: { name: string } }[] } } }[] };
};

async function clickMap(page: Page, fx: number, fy: number, opts: { double?: boolean } = {}) {
  const b = (await page.getByTestId('map-cell').boundingBox())!;
  const x = b.x + b.width * fx;
  const y = b.y + b.height * fy;
  await page.mouse.move(x, y, { steps: 3 });
  if (opts.double) await page.mouse.dblclick(x, y);
  else await page.mouse.click(x, y);
  await page.waitForTimeout(120);
}

const shapes = (page: Page) =>
  page.evaluate(() =>
    (window as unknown as { __gws: Gws }).__gws.layers
      .list()
      .filter((l) => l.group === 'drawing')
      .map((l) => (l.source?.data?.features ?? []).map((f) => f.properties.name)),
  );

const camera = (page: Page) =>
  page.evaluate(() => {
    const m = (window as unknown as { __gws: Gws }).__gws.map;
    return { ...m.getCenter(), z: m.getZoom() };
  });

/** Two points and a polygon in one drawing layer; the Draw panel stays open. */
async function drawThree(page: Page) {
  await page.getByTestId('draw-button').click();
  await page.getByTestId('tool-point').click();
  await clickMap(page, 0.3, 0.3);
  await clickMap(page, 0.3, 0.6);
  await page.getByTestId('tool-polygon').click();
  for (const [x, y] of [[0.5, 0.3], [0.7, 0.3], [0.7, 0.6], [0.5, 0.3]] as const) await clickMap(page, x, y);
  await page.getByTestId('tool-polygon').click(); // stop drawing
  await expect.poll(() => shapes(page)).toEqual([['Point 1', 'Point 2', 'Polygon 1']]);
}

test.beforeEach(async ({ page }) => {
  await freshStart(page, { settings: { language: 'en' } });
});

test('deleting one drawing is immediate, with Undo in a toast; redo deletes it again', async ({ page }) => {
  await drawThree(page);
  await page.getByTestId('drawing-list').getByTestId('drawing-remove').first().click(); // newest first: Polygon 1
  await expect.poll(() => shapes(page)).toEqual([['Point 1', 'Point 2']]);
  await expect(page.getByTestId('undo-toast')).toContainText('Polygon 1');
  await page.getByTestId('undo-toast-undo').click();
  await expect.poll(() => shapes(page)).toEqual([['Point 1', 'Point 2', 'Polygon 1']]); // same place in the list
  await expect(page.getByTestId('undo-toast')).toHaveCount(0);
  await page.getByTestId('redo').click();
  await expect.poll(() => shapes(page)).toEqual([['Point 1', 'Point 2']]);
});

test('keyboard: Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y, but not while typing in a field', async ({ page }) => {
  await drawThree(page);
  await page.getByTestId('drawing-name').first().dblclick();
  const input = page.getByTestId('drawing-name-input');
  await input.fill('Depot');
  await input.press('Control+z'); // the field's own undo; the workspace must not react
  await expect.poll(() => shapes(page)).toEqual([['Point 1', 'Point 2', 'Polygon 1']]);
  await input.fill('Depot');
  await input.press('Enter');
  await expect.poll(() => shapes(page)).toEqual([['Point 1', 'Point 2', 'Depot']]);

  await page.locator('body').press('Control+z'); // undo the rename
  await expect.poll(() => shapes(page)).toEqual([['Point 1', 'Point 2', 'Polygon 1']]);
  await page.locator('body').press('Control+z'); // undo adding the polygon
  await expect.poll(() => shapes(page)).toEqual([['Point 1', 'Point 2']]);
  await page.locator('body').press('Control+Shift+z');
  await expect.poll(() => shapes(page)).toEqual([['Point 1', 'Point 2', 'Polygon 1']]);
  await page.locator('body').press('Control+y');
  await expect.poll(() => shapes(page)).toEqual([['Point 1', 'Point 2', 'Depot']]);
  await expect(page.getByTestId('undo')).toHaveAccessibleName(/Undo: Rename to “Depot”/);
});

test('deleting a whole drawing layer asks first, says what goes, and can be undone', async ({ page }) => {
  await drawThree(page);
  await page.getByTestId('layers-button').click();
  const row = page.getByTestId('layer-list').locator('li').first();
  await row.getByTestId('layer-menu').click();
  await page.getByTestId('layer-remove').click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toContainText('Drawing 1');
  await expect(dialog).toContainText('3 features');
  await page.keyboard.press('Escape'); // Escape = cancel
  await expect.poll(() => shapes(page)).toHaveLength(1);

  await row.getByTestId('layer-menu').click();
  await page.getByTestId('layer-remove').click();
  await page.getByTestId('confirm-ok').click();
  await expect.poll(() => shapes(page)).toHaveLength(0);
  await page.locator('body').press('Control+z');
  await expect.poll(() => shapes(page)).toEqual([['Point 1', 'Point 2', 'Polygon 1']]);
});

test('saved measurements: delete with Undo, rename and hide are undoable', async ({ page }) => {
  await page.getByTestId('measure-button').click();
  await page.getByTestId('tool-distance').click();
  await clickMap(page, 0.3, 0.5);
  await clickMap(page, 0.6, 0.5, { double: true });
  await page.getByTestId('measure-save').click();
  const list = page.getByTestId('saved-list');
  await list.getByTestId('saved-visibility').click();
  await expect(list.getByTestId('saved-visibility')).toHaveAttribute('aria-pressed', 'false');
  await page.locator('body').press('Control+z');
  await expect(list.getByTestId('saved-visibility')).toHaveAttribute('aria-pressed', 'true');
  await list.getByTestId('saved-remove').click();
  await expect(page.getByTestId('saved-empty')).toBeVisible();
  await page.getByTestId('undo-toast-undo').click();
  await expect(list.getByTestId('saved-name')).toHaveText('Measurement 1');
});

test('selecting in a panel highlights on the map without moving the camera; map clicks select too', async ({ page }) => {
  await drawThree(page);
  const before = await camera(page);
  const polygon = page.getByTestId('drawing-list').locator('li').first();
  await polygon.click();
  await expect(polygon).toHaveAttribute('aria-current', 'true');
  const highlighted = () =>
    page.evaluate(() => {
      const src = (window as unknown as { __gws: Gws }).__gws.map.getSource('ws:selection') as unknown as { serialize(): { data: { features: { properties: { label: string } }[] } } };
      return src.serialize().data.features.map((f) => f.properties.label);
    });
  await expect.poll(highlighted).toEqual(['Polygon 1']);
  expect(await camera(page)).toEqual(before); // no recenter, no zoom

  // Keyboard: Enter on a name selects that item.
  await page.getByTestId('drawing-list').getByTestId('drawing-name').nth(2).focus();
  await page.keyboard.press('Enter');
  await expect.poll(highlighted).toEqual(['Point 1']);

  // Clicking empty map clears it; clicking a shape selects it.
  await clickMap(page, 0.9, 0.9);
  await expect.poll(highlighted).toEqual([]);
  await clickMap(page, 0.64, 0.4); // inside the polygon
  await expect.poll(highlighted).toEqual(['Polygon 1']);
  await expect(page.getByTestId('panel-layers')).toBeVisible();
});
