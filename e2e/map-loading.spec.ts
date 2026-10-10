import { expect, test } from './fixtures';

/** A slow or failing basemap: theme-matched backdrop, a delayed indicator, Retry on real failures. */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('e2e-seeded')) return;
    sessionStorage.setItem('e2e-seeded', '1');
    localStorage.clear();
    localStorage.setItem('gws:workspace:v2', JSON.stringify({ version: 2, mapTheme: 'light', settings: { language: 'en' } }));
  });
});

test('slow basemap: light backdrop at once, "Loading map…" after a short delay, gone when ready', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  await page.route(/tiles\.openfreemap\.org\/styles\//, async (route) => {
    await gate;
    await route.fallback(); // then the offline fixture serves the style
  });
  await page.goto('/');
  const container = page.getByTestId('map-container');
  await expect(container).toHaveCSS('background-color', 'rgb(242, 243, 240)'); // theme-matched, not black
  await expect(page.getByTestId('map-loading')).toBeVisible();
  await expect(page.getByTestId('map-loading')).toHaveText('Loading map…');
  // The indicator is centred: it does not cover the attribution or the controls.
  release();
  await expect(page.getByTestId('map-loading')).toHaveCount(0, { timeout: 20_000 }); // first tile on software WebGL
  await expect(page.locator('.maplibregl-ctrl-attrib')).toContainText('OpenFreeMap');
});

// The no-flicker rule (nothing shown for loads under ~200 ms) is timing-sensitive in a browser;
// it is covered deterministically in src/layout/MapLoading.test.tsx.

test('failed basemap style: an error with Retry, which recovers once the server is back', async ({ page }) => {
  let fail = true;
  await page.route(/tiles\.openfreemap\.org\/styles\//, (route) => (fail ? route.fulfill({ status: 503, body: 'down' }) : route.fallback()));
  await page.goto('/');
  const error = page.getByTestId('map-error');
  await expect(error).toBeVisible();
  await expect(error).toHaveAttribute('role', 'alert');
  await expect(page.getByTestId('map-loading')).toHaveCount(0);
  fail = false;
  await page.getByTestId('map-retry').click();
  await expect(error).toHaveCount(0);
  await page.waitForFunction(() => (window as unknown as { __gws: { map: { isStyleLoaded(): boolean } } }).__gws.map.isStyleLoaded());
  await expect(page.locator('.maplibregl-ctrl-attrib')).toContainText('OpenFreeMap');
});
