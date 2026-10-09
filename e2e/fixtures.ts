import { existsSync, readFileSync } from 'node:fs';
import { expect, test as base, type Page } from '@playwright/test';

const ASSETS = new URL('./assets/', import.meta.url).pathname;

/** The real OpenFreeMap credit, so attribution behaves as it does in production. */
export const OFM_ATTRIBUTION =
  '<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> <a href="https://www.openmaptiles.org/" target="_blank">&copy; OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>';

/** A small, deterministic stand-in for the OpenFreeMap styles: land, sea, a road, attribution. */
function offlineStyle(theme: 'light' | 'dark') {
  const c = theme === 'light' ? { land: '#eceeea', sea: '#aecbe0', road: '#ffffff' } : { land: '#22272d', sea: '#17222e', road: '#3a4048' };
  return {
    version: 8,
    // Real Noto Sans glyph ranges (Latin, Hebrew, punctuation) are served from e2e/assets/glyphs.
    glyphs: 'https://glyphs.e2e.test/{fontstack}/{range}.pbf',
    sources: {
      base: {
        type: 'geojson',
        attribution: OFM_ATTRIBUTION,
        data: {
          type: 'FeatureCollection',
          features: [
            { type: 'Feature', properties: { k: 'sea' }, geometry: { type: 'Polygon', coordinates: [[[25, 28], [34.6, 28], [34.25, 31.3], [34.95, 32.9], [35.1, 34], [25, 34], [25, 28]]] } },
            { type: 'Feature', properties: { k: 'road' }, geometry: { type: 'LineString', coordinates: [[34.78, 32.08], [35.0, 31.9], [35.21, 31.77]] } },
          ],
        },
      },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': c.land } },
      { id: 'sea', type: 'fill', source: 'base', filter: ['==', ['get', 'k'], 'sea'], paint: { 'fill-color': c.sea } },
      { id: 'road', type: 'line', source: 'base', filter: ['==', ['get', 'k'], 'road'], paint: { 'line-color': c.road, 'line-width': 3 } },
    ],
  };
}

function glyph(url: string): Buffer | null {
  const m = /glyphs\.e2e\.test\/([^/]+)\/(\d+-\d+)\.pbf/.exec(url);
  if (!m) return null;
  const font = decodeURIComponent(m[1]!).split(',')[0]!.trim();
  const file = `${ASSETS}glyphs/${font}/${m[2]}.pbf`;
  return existsSync(file) ? readFileSync(file) : null;
}

/** Serves local styles, glyphs and imagery so the map fully loads, identically, without network. */
export async function routeOffline(target: Pick<Page, 'route'>) {
  const imagery = readFileSync(`${ASSETS}imagery.png`);
  await target.route(/tiles\.openfreemap\.org\/styles\//, (r) =>
    r.fulfill({ json: offlineStyle(/styles\/dark/.test(r.request().url()) ? 'dark' : 'light') }),
  );
  await target.route(/glyphs\.e2e\.test/, (r) => {
    const body = glyph(r.request().url());
    return body ? r.fulfill({ body, contentType: 'application/x-protobuf' }) : r.fulfill({ status: 204, body: '' });
  });
  await target.route(/arcgisonline\.com/, (r) => r.fulfill({ body: imagery, contentType: 'image/png' }));
}

export const test = base.extend<{ offlineStyles: void }>({
  offlineStyles: [
    async ({ page }, use) => {
      await routeOffline(page);
      await use();
    },
    { auto: true },
  ],
});

export { expect };

/**
 * Clean storage once per test, before the app runs. `seed` is the v2 prefs document (partial is
 * fine: missing fields fall back to defaults). Each Playwright test has a fresh browser context,
 * so IndexedDB starts empty too.
 */
export async function freshStart(page: Page, seed?: Record<string, unknown>, path = '/') {
  await page.addInitScript((s) => {
    if (sessionStorage.getItem('e2e-seeded')) return;
    sessionStorage.setItem('e2e-seeded', '1');
    localStorage.clear();
    if (s) localStorage.setItem('gws:workspace:v2', JSON.stringify({ version: 2, ...s }));
  }, seed ?? null);
  await page.goto(path);
  await waitForMap(page);
}

/** Waits until the map exists and its style has loaded. */
export async function waitForMap(page: Page) {
  await page.locator('.maplibregl-canvas').waitFor();
  await page.waitForFunction(() =>
    (window as unknown as { __gws?: { map?: { isStyleLoaded(): boolean } } }).__gws?.map?.isStyleLoaded(),
  );
}
