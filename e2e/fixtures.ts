import { expect, test as base, type Page } from '@playwright/test';

/** Serves a tiny local style for every basemap so the map fully loads without network access. */
export const test = base.extend<{ offlineStyles: void }>({
  offlineStyles: [
    async ({ page }, use) => {
      const style = {
        version: 8,
        sources: {},
        layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#dfe3e6' } }],
      };
      await page.route(/tiles\.openfreemap\.org\/styles\//, (r) => r.fulfill({ json: style }));
      await page.route(/arcgisonline\.com/, (r) => r.fulfill({ status: 204, body: '' }));
      await use();
    },
    { auto: true },
  ],
});

export { expect };

/** Clean storage once per test, before the app runs. */
export async function freshStart(page: Page, seed?: Record<string, unknown>) {
  await page.addInitScript((s) => {
    if (sessionStorage.getItem('e2e-seeded')) return;
    sessionStorage.setItem('e2e-seeded', '1');
    localStorage.clear();
    if (s) localStorage.setItem('gws:workspace:v1', JSON.stringify(s));
  }, seed ?? null);
  await page.goto('/');
  await page.locator('.maplibregl-canvas').waitFor();
  await page.waitForFunction(() =>
    (window as unknown as { __gws?: { map?: { isStyleLoaded(): boolean } } }).__gws?.map?.isStyleLoaded(),
  );
}
