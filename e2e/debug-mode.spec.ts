import type { Page } from '@playwright/test';
import { expect, freshStart, test, waitForMap } from './fixtures';

type Gws = { layers: { list(): { name: string; group?: string }[] } };
const drawingLayerNames = (page: Page) =>
  page.evaluate(() =>
    (window as unknown as { __gws: Gws }).__gws.layers
      .list()
      .filter((l) => l.group === 'drawing')
      .map((l) => l.name),
  );

async function drawPoint(page: Page) {
  const b = (await page.getByTestId('map-cell').boundingBox())!;
  await page.getByTestId('draw-button').click();
  await page.getByTestId('tool-point').click();
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await page.getByTestId('tool-point').click();
  await page.getByTestId('draw-button').click();
}

test('?debug is a sandbox: visible badge, starts empty, never reads or writes the real workspace', async ({ page }) => {
  // The real workspace: one drawing layer and a dark theme.
  await freshStart(page, { settings: { language: 'en' }, mapTheme: 'dark' });
  await expect(page.getByTestId('debug-badge')).toHaveCount(0);
  await drawPoint(page);
  await expect.poll(() => drawingLayerNames(page)).toEqual(['Drawing 1']);
  await page.waitForTimeout(500); // auto-save
  const realPrefs = await page.evaluate(() => localStorage.getItem('gws:workspace:v2'));

  // Debug session in the same tab: sandboxed.
  await page.goto('/?debug');
  await waitForMap(page);
  await expect(page.getByTestId('debug-badge')).toBeVisible();
  await expect(page.getByTestId('debug-badge')).toHaveText(/DEBUG/);
  expect(await drawingLayerNames(page)).toEqual([]); // the user's drawings are not loaded
  await expect(page.locator('html')).toHaveAttribute('lang', 'he'); // defaults, not the user's prefs
  await drawPoint(page);
  await page.getByTestId('topbar-settings').click();
  await expect(page.getByTestId('settings-storage')).toContainText('DEBUG');
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => localStorage.getItem('gws:workspace:v2'))).toBe(realPrefs);

  // Back to the real workspace: exactly as it was.
  await page.goto('/');
  await waitForMap(page);
  await expect(page.getByTestId('debug-badge')).toHaveCount(0);
  await expect.poll(() => drawingLayerNames(page)).toEqual(['Drawing 1']);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});
