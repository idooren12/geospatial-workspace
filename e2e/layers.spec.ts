import { expect, test, type Page } from '@playwright/test';

type Gws = { mapService: { getLayerOrder(): string[]; instanceCount: number } };
const mapLayerOrder = (page: Page) =>
  page.evaluate(() => (window as unknown as { __gws: Gws }).__gws.mapService.getLayerOrder());

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('e2e-seeded')) return;
    sessionStorage.setItem('e2e-seeded', '1');
    localStorage.clear();
  });
  await page.goto('/');
  await page.locator('.maplibregl-canvas').waitFor();
  // The dev-only Debug tool adds test layers through ToolContext.layers, like a real tool would.
  await page.getByTestId('rail-btn-debug').click();
  await page.getByTestId('debug-add-layer').click();
  await page.getByTestId('debug-add-layer').click();
  await page.getByTestId('layers-button').click();
});

const rows = (page: Page) => page.getByTestId('layer-list').locator('li');

test('tool-created layers appear in the Layers panel, top layer first', async ({ page }) => {
  await expect(rows(page)).toHaveCount(2);
  await expect(rows(page).nth(0).getByTestId('layer-name')).toHaveText('Test 2');
  await expect(page.getByTestId('layers-empty')).toHaveCount(0);
  const order = await mapLayerOrder(page);
  expect(order.filter((id) => id.endsWith(':0')).length).toBe(2);
  // Map order matches: Test 2's layers are above Test 1's.
  const [first, second] = await rows(page).evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')!.slice(10)));
  expect(order.indexOf(`ws:${first}:0`)).toBeGreaterThan(order.indexOf(`ws:${second}:2`));
});

test('hide, opacity, rename, reorder and remove', async ({ page }) => {
  const top = rows(page).nth(0);
  // Show / hide
  await top.getByTestId('layer-visibility').click();
  await expect(top).toHaveAttribute('data-hidden', 'true');
  await top.getByTestId('layer-visibility').click();
  await expect(top).toHaveAttribute('data-hidden', 'false');
  // Opacity
  await top.getByTestId('layer-expand').click();
  await top.getByTestId('layer-opacity').fill('40');
  await expect(top.getByText('40%')).toBeVisible();
  // Rename with F2-free double click, Enter commits
  await top.getByTestId('layer-name').dblclick();
  await top.getByTestId('layer-name-input').fill('Roads');
  await page.keyboard.press('Enter');
  await expect(top.getByTestId('layer-name')).toHaveText('Roads');
  // Escape cancels a rename
  await top.getByTestId('layer-name').dblclick();
  await top.getByTestId('layer-name-input').fill('Nope');
  await page.keyboard.press('Escape');
  await expect(rows(page).nth(0).getByTestId('layer-name')).toHaveText('Roads');
  // Move down via the menu
  await rows(page).nth(0).getByTestId('layer-menu').click();
  await page.getByTestId('layer-down').click();
  await expect(rows(page).nth(1).getByTestId('layer-name')).toHaveText('Roads');
  const order = await mapLayerOrder(page);
  const roadsId = await rows(page).nth(1).evaluate((e) => e.getAttribute('data-testid')!.slice(10));
  expect(order.indexOf(`ws:${roadsId}:0`)).toBe(0); // now drawn at the bottom
  // Remove
  await rows(page).nth(1).getByTestId('layer-menu').click();
  await page.getByTestId('layer-remove').click();
  await expect(rows(page)).toHaveCount(1);
  expect((await mapLayerOrder(page)).some((id) => id.startsWith(`ws:${roadsId}:`))).toBe(false);
});

test('reorders with the keyboard on the drag handle', async ({ page }) => {
  const bottomName = await rows(page).nth(1).getByTestId('layer-name').textContent();
  const handle = rows(page).nth(1).getByTestId('layer-handle');
  await handle.focus();
  await page.keyboard.press('Space');
  // dnd-kit marks the handle while a keyboard drag is active; it measures rows before moving.
  await expect(handle).toHaveAttribute('aria-pressed', 'true');
  await page.waitForTimeout(150);
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(150);
  await page.keyboard.press('Space');
  await expect(rows(page).nth(0).getByTestId('layer-name')).toHaveText(bottomName!);
});

test('layers and their settings survive a basemap switch and a refresh', async ({ page }) => {
  const top = rows(page).nth(0);
  await top.getByTestId('layer-visibility').click();
  const before = await mapLayerOrder(page);
  await page.getByTestId('layers-basemap-satellite').click();
  await expect.poll(() => mapLayerOrder(page)).toEqual(before);
  await page.waitForTimeout(400); // debounced save
  await page.reload();
  await page.locator('.maplibregl-canvas').waitFor();
  await expect(rows(page)).toHaveCount(2);
  await expect(rows(page).nth(0)).toHaveAttribute('data-hidden', 'true');
  expect(await mapLayerOrder(page)).toEqual(before);
});

test('closing the tool keeps the layers it created (spec §8)', async ({ page }) => {
  await page.getByTestId('rail-btn-debug').click(); // close Debug
  await expect(page.getByTestId('panel-debug')).toHaveCount(0);
  await expect(rows(page)).toHaveCount(2);
});
