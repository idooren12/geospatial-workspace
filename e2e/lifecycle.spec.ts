import type { Page } from '@playwright/test';
import { expect, freshStart, test } from './fixtures';

type Gws = {
  mapService: { instanceCount: number; subscriptionCount: number; getLayerOrder(): string[] };
  map: { getStyle(): { layers: { id: string }[]; sources: Record<string, unknown> }; isStyleLoaded(): boolean };
};
const gws = <T>(page: Page, fn: (g: Gws) => T) => page.evaluate(fn as never) as Promise<T>;
const probe = (page: Page) =>
  page.evaluate(() => {
    const g = (window as unknown as { __gws: Gws }).__gws;
    const style = g.map.getStyle();
    const ws = style.layers.map((l) => l.id).filter((id) => id.startsWith('ws:'));
    return {
      instances: g.mapService.instanceCount,
      subscriptions: g.mapService.subscriptionCount,
      wsLayers: ws,
      duplicateLayers: ws.length - new Set(ws).size,
      wsSources: Object.keys(style.sources).filter((id) => id.startsWith('ws:')).sort(),
      managed: g.mapService.getLayerOrder(),
    };
  });

async function clickMap(page: Page, fx: number, fy: number) {
  const b = (await page.getByTestId('map-cell').boundingBox())!;
  await page.mouse.click(b.x + b.width * fx, b.y + b.height * fy);
  await page.waitForTimeout(120);
}

test('one map for the whole session; reopening tools adds no handlers; basemap switches leave nothing behind', async ({ page }) => {
  test.slow(); // ~45 s of clicking at 2560 px on software WebGL
  await freshStart(page, { settings: { language: 'en' } });
  // Some app content on the map: a drawing layer and the overlays.
  await page.getByTestId('draw-button').click();
  await page.getByTestId('tool-point').click();
  await clickMap(page, 0.5, 0.5);
  await page.getByTestId('tool-point').click();
  await page.getByTestId('draw-button').click();
  const start = await probe(page);
  expect(start.instances).toBe(1);

  for (let i = 0; i < 3; i++) {
    for (const b of ['layers-button', 'measure-button', 'draw-button', 'topbar-settings']) {
      await page.getByTestId(b).click(); // open
      await page.getByTestId(b).click(); // close
    }
    await page.getByTestId('map-only').click();
    await page.getByTestId('map-only').click();
    await page.getByTestId('topbar-settings').click();
    await page.getByTestId('settings-language').getByRole('radio').first().click(); // he
    await page.getByTestId('settings-language').getByRole('radio').last().click(); // en
    await page.getByTestId('topbar-settings').click();
  }
  await page.getByTestId('layers-button').click();
  for (const b of ['satellite', 'map', 'satellite', 'map']) {
    await page.getByTestId(`layers-basemap-${b}`).click();
    await page.waitForFunction(() => (window as unknown as { __gws: Gws }).__gws.map.isStyleLoaded());
  }
  await page.getByTestId('theme-toggle').click();
  await page.waitForFunction(() => (window as unknown as { __gws: Gws }).__gws.map.isStyleLoaded());
  await page.getByTestId('layers-button').click();

  const end = await probe(page);
  expect(end.instances).toBe(1); // never remounted (MAP-01)
  expect(end.subscriptions).toBe(start.subscriptions); // no leaked map handlers
  expect(end.duplicateLayers).toBe(0);
  expect(end.wsLayers).toEqual(start.wsLayers); // app layers restored exactly, in the same order
  expect(end.wsSources).toEqual(start.wsSources); // no orphaned sources
  expect(end.wsLayers).toEqual(end.managed.filter((id) => end.wsLayers.includes(id)));
});

test('splitter: keyboard steps (Shift = larger), Home/End, same limits as dragging (map ≥ 500)', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 768 });
  await freshStart(page, { settings: { language: 'en' } });
  await page.getByTestId('layers-button').click();
  await page.getByTestId('measure-button').click();
  const sp = page.getByTestId('splitter').first();
  await sp.focus();
  const now = async () => Number(await sp.getAttribute('aria-valuenow'));
  await page.keyboard.press('Home');
  await expect(sp).toHaveAttribute('aria-valuenow', '220');
  await page.keyboard.press('Shift+ArrowRight'); // Layers is on the left in English: right widens
  expect(await now()).toBe(284);
  await page.keyboard.press('ArrowRight');
  expect(await now()).toBe(300);
  await page.keyboard.press('End');
  const max = Number(await sp.getAttribute('aria-valuemax'));
  expect(await now()).toBe(max);
  const map = (await page.getByTestId('map-cell').boundingBox())!;
  expect(map.width).toBeGreaterThanOrEqual(500);
  expect(max).toBeLessThan(450); // limited by the map minimum, not just the panel maximum
  await expect(sp).toHaveAttribute('aria-controls', /dock-column-/);

  // A drag far past the limit stops at the same maximum.
  await page.keyboard.press('Home');
  const b = (await sp.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + 200);
  await page.mouse.down();
  await page.mouse.move(b.x + 900, b.y + 200, { steps: 8 });
  await page.mouse.up();
  expect(await now()).toBe(max);
});
