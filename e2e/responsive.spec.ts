import type { Page } from '@playwright/test';
import { expect, freshStart, test } from './fixtures';

type Box = { x: number; y: number; width: number; height: number };
const overlap = (a: Box, b: Box) =>
  Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
  Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
const inside = (a: Box, b: Box) => a.x >= b.x - 0.5 && a.y >= b.y - 0.5 && a.x + a.width <= b.x + b.width + 0.5 && a.y + a.height <= b.y + b.height + 0.5;

/**
 * The bottom of the map belongs to the attribution: fully inside the map, not cut off, not covered
 * by anything, every link clickable. Map controls, rails, the scale and the status bar never
 * overlap it or each other.
 */
async function checkMapChrome(page: Page, expectCredit: RegExp) {
  const map = (await page.getByTestId('map-cell').boundingBox())!;
  const attrib = page.locator('.maplibregl-ctrl-attrib');
  await expect(attrib).toBeVisible();
  await expect(attrib).toContainText(expectCredit);
  const a = (await attrib.boundingBox())!;
  expect(inside(a, map), `attribution inside the map (${JSON.stringify(a)} in ${JSON.stringify(map)})`).toBe(true);
  // Not cut off: no hidden overflow, not collapsed to an (i) button.
  expect(await attrib.evaluate((el) => el.scrollWidth <= el.clientWidth + 1 && !el.classList.contains('maplibregl-compact'))).toBe(true);

  const others: Record<string, Box | null> = {
    scale: await page.locator('.maplibregl-ctrl-scale').boundingBox(),
    zoom: await page.locator('.maplibregl-ctrl-group').first().boundingBox(),
    tools: await page.locator('.gws-slot-tools').boundingBox(),
    railLeft: await page.getByTestId('rail-left').boundingBox().catch(() => null),
    railRight: await page.getByTestId('rail-right').boundingBox().catch(() => null),
    status: await page.getByTestId('status-bar').boundingBox(),
  };
  for (const [name, b] of Object.entries(others)) {
    if (b) expect(overlap(a, b), `attribution overlaps ${name}`).toBe(0);
  }
  for (const [n1, b1] of Object.entries(others))
    for (const [n2, b2] of Object.entries(others)) if (n1 < n2 && b1 && b2) expect(overlap(b1, b2), `${n1} overlaps ${n2}`).toBe(0);

  // Every credit link is the top element at its own centre, i.e. visible and clickable.
  const covered = await attrib.locator('a').evaluateAll((links) =>
    links
      .filter((l) => {
        const r = l.getBoundingClientRect();
        return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) !== l;
      })
      .map((l) => l.textContent),
  );
  expect(covered, 'attribution links covered').toEqual([]);

  // Status bar: below the map, fields inside it and not on top of each other.
  const bar = others.status!;
  expect(bar.y).toBeGreaterThanOrEqual(map.y + map.height - 0.5);
  const fields = await page
    .getByTestId('status-bar')
    .locator(':scope > button, :scope > span:not([aria-hidden])')
    .evaluateAll((els) => els.filter((e) => (e as HTMLElement).offsetParent).map((e) => e.getBoundingClientRect().toJSON() as Box));
  for (const f of fields) expect(inside(f, bar)).toBe(true);
  for (let i = 0; i < fields.length; i++) for (let j = i + 1; j < fields.length; j++) expect(overlap(fields[i]!, fields[j]!)).toBe(0);
}

const OFM = /OpenFreeMap.*OpenMapTiles.*OpenStreetMap/;
const ESRI = /Powered by Esri.*Esri, Vantor, Earthstar Geographics/;

async function eachBasemap(page: Page, check: (credit: RegExp, label: string) => Promise<void>) {
  for (const [basemap, theme, credit] of [
    ['map', 'light', OFM],
    ['map', 'dark', OFM],
    ['satellite', null, ESRI],
  ] as const) {
    await page.getByTestId(`layers-basemap-${basemap}`).click();
    if (theme) {
      const toggle = page.getByTestId('theme-toggle');
      const toDark = (await toggle.getAttribute('aria-label'))?.match(/dark|כהה/);
      if ((theme === 'dark') === !!toDark) await toggle.click();
    }
    await expect(page.getByTestId('status-basemap')).toContainText(basemap === 'map' ? (theme === 'dark' ? /Dark|כהה/ : /Light|בהיר/) : /Satellite|לוויין/);
    await page.waitForFunction(() => (window as unknown as { __gws: { map: { isStyleLoaded(): boolean } } }).__gws.map.isStyleLoaded());
    await expect(page.locator('.maplibregl-ctrl-attrib')).toContainText(credit);
    await check(credit, `${basemap}/${theme ?? '-'}`);
  }
}

/** Map widths ~800, ~640, the 980px window from the owner's report, and the 500px minimum. */
const WIDTHS = [
  { viewport: 1368, label: 'map ≈ 800' },
  { viewport: 1208, label: 'map ≈ 640' },
  { viewport: 1068, label: 'map at minimum (500)' },
  { viewport: 980, label: 'window 980 (owner report)' },
];

for (const lang of ['he', 'en'] as const) {
  test(`attribution, controls and status bar never collide at narrow map widths (${lang})`, async ({ page }, info) => {
    test.skip(info.project.name !== '1366', 'sets its own window sizes; one project is enough');
    test.slow();
    await page.setViewportSize({ width: 1368, height: 768 });
    await freshStart(page, { settings: { language: lang } });
    await page.getByTestId('layers-button').click(); // one side
    await page.getByTestId('measure-button').click(); // the other side
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w.viewport, height: 768 });
      await page.waitForTimeout(200);
      if (w.viewport === 1068) {
        // Widen both docks as far as allowed (keyboard End): the map stops at its 500px minimum.
        for (const sp of await page.getByTestId('splitter').all()) {
          await sp.focus();
          await page.keyboard.press('End');
        }
        await page.waitForTimeout(200);
      }
      const map = (await page.getByTestId('map-cell').boundingBox())!;
      expect(map.width, w.label).toBeGreaterThanOrEqual(500);
      if (w.viewport !== 980) expect(map.width, w.label).toBeLessThanOrEqual(w.viewport === 1068 ? 501 : 820);
      await eachBasemap(page, (credit) => checkMapChrome(page, credit));
    }
  });
}

test('at each target window size, with docks on both sides, nothing overlaps', async ({ page }) => {
  await freshStart(page);
  await page.getByTestId('layers-button').click();
  await page.getByTestId('measure-button').click();
  await page.getByTestId('draw-button').click();
  await page.getByTestId('topbar-settings').click();
  await eachBasemap(page, (credit) => checkMapChrome(page, credit));
});
