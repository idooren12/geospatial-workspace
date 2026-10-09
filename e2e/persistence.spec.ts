import type { Browser, Page } from '@playwright/test';
import { expect, freshStart, routeOffline, test, waitForMap } from './fixtures';

type Gws = { layers: { list(): { name: string; group?: string; source?: { data?: { features: { properties: { name: string } }[] } } }[] } };

async function clickMap(page: Page, fx: number, fy: number, opts: { double?: boolean } = {}) {
  const b = (await page.getByTestId('map-cell').boundingBox())!;
  const x = b.x + b.width * fx;
  const y = b.y + b.height * fy;
  await page.mouse.move(x, y, { steps: 3 });
  if (opts.double) await page.mouse.dblclick(x, y);
  else await page.mouse.click(x, y);
  await page.waitForTimeout(120);
}

const drawingLayers = (page: Page) =>
  page.evaluate(() =>
    (window as unknown as { __gws: Gws }).__gws.layers
      .list()
      .filter((l) => l.group === 'drawing')
      .map((l) => ({ name: l.name, shapes: (l.source?.data?.features ?? []).map((f) => f.properties.name) })),
  );

/** What is stored right now: prefs in localStorage, geometry in IndexedDB. */
const stored = (page: Page) =>
  page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((res, rej) => {
      const r = indexedDB.open('gws');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const geometry = await new Promise<unknown>((res) => {
      const r = db.transaction('docs').objectStore('docs').get('geometry');
      r.onsuccess = () => res(r.result);
    });
    db.close();
    return { prefs: localStorage.getItem('gws:workspace:v2'), v1: localStorage.getItem('gws:workspace:v1'), geometry } as {
      prefs: string | null;
      v1: string | null;
      geometry: { version: number; layers: { order: string[] }; measurements: { id: string; name: string; value: number; unit: string; geometry: { type: string } }[] } | undefined;
    };
  });

/** Draws a named layer with a point, and saves a named measurement; leaves a measurement unsaved. */
async function makeWork(page: Page) {
  await page.getByTestId('draw-button').click();
  await page.getByTestId('draw-new-name').fill('Obstacles');
  await page.getByTestId('draw-new-create').click();
  await page.getByTestId('tool-point').click();
  await clickMap(page, 0.4, 0.4);
  await page.getByTestId('tool-point').click();
  await page.getByTestId('measure-button').click();
  await page.getByTestId('tool-distance').click();
  await clickMap(page, 0.3, 0.6);
  await clickMap(page, 0.6, 0.6, { double: true });
  await page.getByTestId('measure-name').fill('Fence');
  await page.getByTestId('measure-save').click();
  // In progress and never saved: must not survive.
  await clickMap(page, 0.3, 0.7);
  await clickMap(page, 0.5, 0.7);
  await expect(page.getByTestId('measure-result')).toBeVisible();
  await expect.poll(async () => (await stored(page)).geometry?.measurements.length).toBe(1); // auto-saved
}

test('named work survives closing the tab and the browser; unsaved work does not (M5 #8)', async ({ page, browser }) => {
  await freshStart(page, { settings: { language: 'en' } });
  await makeWork(page);
  const s = await stored(page);
  expect(s.geometry!.version).toBe(2);
  expect(s.geometry!.measurements[0]).toMatchObject({ name: 'Fence', unit: 'm', geometry: { type: 'LineString' } });
  expect(s.geometry!.measurements[0]!.value).toBeGreaterThan(0);
  expect(s.prefs).not.toContain('Obstacles'); // geometry is not in localStorage

  // "Close the browser": a brand-new context from the saved profile (cookies, localStorage, IndexedDB).
  const profile = await page.context().storageState({ indexedDB: true });
  await page.context().close();
  const reopened = await (browser as Browser).newContext({ storageState: profile });
  await routeOffline(reopened);
  const p2 = await reopened.newPage();
  await p2.goto('/');
  await waitForMap(p2);
  await expect.poll(() => drawingLayers(p2)).toEqual([{ name: 'Obstacles', shapes: ['Point 1'] }]);
  // The dock layout came back too, so the Measurements panel is already open.
  await expect(p2.getByTestId('panel-measure')).toBeVisible();
  await expect(p2.getByTestId('saved-list').getByTestId('saved-name')).toHaveText('Fence');
  await expect(p2.getByTestId('measure-result')).toHaveCount(0); // the unsaved one is gone
  await reopened.close();
});

test('a version-1 workspace is migrated once into prefs + IndexedDB', async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('e2e-seeded')) return;
    sessionStorage.setItem('e2e-seeded', '1');
    localStorage.clear();
    localStorage.setItem(
      'gws:workspace:v1',
      JSON.stringify({
        version: 1,
        basemapId: 'dark',
        settings: { language: 'en' },
        layers: {
          items: {
            L1: {
              name: 'Old drawings',
              type: 'geojson',
              group: 'drawing',
              ownerToolId: 'draw',
              source: { type: 'geojson', data: { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { fid: 'a', name: 'Well', kind: 'point' }, geometry: { type: 'Point', coordinates: [34.9, 31.9] } }] } },
              mapLayers: [{ type: 'circle', paint: { 'circle-color': '#3d8bfd' } }],
            },
          },
          order: ['L1'],
        },
        measurements: [{ id: 'M1', name: 'Old path', kind: 'distance', coordinates: [[34.8, 32], [34.9, 32]], visible: true, createdAt: 1 }],
      }),
    );
  });
  await page.goto('/');
  await waitForMap(page);
  await expect.poll(() => drawingLayers(page)).toEqual([{ name: 'Old drawings', shapes: ['Well'] }]);
  await expect(page.getByTestId('status-basemap')).toHaveText('Map · Dark');
  const s = await stored(page);
  expect(s.v1).toBeNull();
  expect(JSON.parse(s.prefs!)).toMatchObject({ version: 2, mapTheme: 'dark' });
  expect(s.geometry!.measurements[0]).toMatchObject({ id: 'M1', unit: 'm', geometry: { type: 'LineString' } });
  // Old drawing styles are refreshed to the current label style.
  const labelled = await page.evaluate(() =>
    (window as unknown as { __gws: { map: { getStyle(): { layers: { id: string; layout?: Record<string, unknown> }[] } } } }).__gws.map
      .getStyle()
      .layers.some((l) => l.id.startsWith('ws:L1:') && l.layout?.['icon-image'] === 'ws:label-bg'),
  );
  expect(labelled).toBe(true);
});

test('corrupted stored prefs fall back to defaults and keep a copy instead of crashing', async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('e2e-seeded')) return;
    sessionStorage.setItem('e2e-seeded', '1');
    localStorage.clear();
    localStorage.setItem('gws:workspace:v2', '{"version":2, broken');
  });
  await page.goto('/');
  await waitForMap(page);
  await expect(page.locator('html')).toHaveAttribute('lang', 'he');
  expect(await page.evaluate(() => localStorage.getItem('gws:corrupt:gws:workspace:v2'))).toBe('{"version":2, broken');
});

test('Settings says where data is kept (this browser only, no cloud)', async ({ page }) => {
  await freshStart(page, { settings: { language: 'en' } });
  await page.getByTestId('topbar-settings').click();
  await expect(page.getByTestId('settings-storage')).toContainText('this browser only (IndexedDB)');
  await expect(page.getByTestId('settings-storage')).toContainText('Nothing is synced');
});
