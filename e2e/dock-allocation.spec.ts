import type { Page } from '@playwright/test';
import { expect, freshStart, test } from './fixtures';

/** Panels on one side sit side by side whenever the map keeps ≥ 500 px; tabs are overflow only. */

const columnsOn = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('[id^="dock-column-"]')]
      .filter((el) => (el as HTMLElement).offsetParent)
      .map((el) => ({ x: el.getBoundingClientRect().x, w: el.getBoundingClientRect().width, tabs: el.querySelectorAll('[role="tab"]').length })),
  );

test('owner case (1366 window): Measurements and Draw open side by side, not as tabs', async ({ page }, info) => {
  test.skip(info.project.name !== '1366', 'the case is defined at a 1366 px window');
  await freshStart(page, { settings: { language: 'he' } });
  await page.getByTestId('layers-button').click();
  await page.getByTestId('measure-button').click();
  const before = (await page.getByTestId('map-cell').boundingBox())!.width;
  expect(before).toBeGreaterThan(780); // ~800: room for one more column with the map ≥ 500
  await page.getByTestId('draw-button').click();
  await expect(page.getByTestId('panel-measure')).toBeVisible();
  await expect(page.getByTestId('panel-draw')).toBeVisible(); // both visible at once
  const cols = await columnsOn(page);
  expect(cols).toHaveLength(3);
  expect(cols.every((c) => c.tabs === 0)).toBe(true);
  expect((await page.getByTestId('map-cell').boundingBox())!.width).toBeGreaterThanOrEqual(500);
});

test('a layout saved as tabs splits back into columns when the window has room', async ({ page }) => {
  await freshStart(page, {
    settings: { language: 'en' },
    dock: {
      mapOnly: false,
      widthMemory: {},
      columns: {
        left: [{ id: 'L', width: 252, panelIds: ['layers'], activePanelId: 'layers' }],
        right: [{ id: 'R', width: 220, panelIds: ['measure', 'draw'], activePanelId: 'draw' }],
      },
    },
  });
  await expect(page.getByTestId('panel-measure')).toBeVisible();
  await expect(page.getByTestId('panel-draw')).toBeVisible();
  expect((await page.getByTestId('map-cell').boundingBox())!.width).toBeGreaterThanOrEqual(500);
});

test('tabs only as overflow: a narrow window groups them, widening splits them again', async ({ page }) => {
  await freshStart(page, { settings: { language: 'en' } });
  await page.getByTestId('measure-button').click();
  await page.getByTestId('draw-button').click();
  await page.setViewportSize({ width: 900, height: 768 }); // two columns + 500 px map no longer fit
  await expect(page.getByRole('tab')).toHaveCount(2);
  expect((await page.getByTestId('map-cell').boundingBox())!.width).toBeGreaterThanOrEqual(500);
  await page.setViewportSize({ width: 1366, height: 768 });
  await expect(page.getByRole('tab')).toHaveCount(0);
  await expect(page.getByTestId('panel-measure')).toBeVisible();
  await expect(page.getByTestId('panel-draw')).toBeVisible();
});

test('map at ~920 px with a panel open: the next panel on that side opens as a column', async ({ page }, info) => {
  test.skip(info.project.name !== '1366', 'sets its own window size');
  await page.setViewportSize({ width: 1488, height: 800 });
  await freshStart(page, { settings: { language: 'en' } });
  await page.getByTestId('layers-button').click();
  await page.getByTestId('measure-button').click();
  const map = (await page.getByTestId('map-cell').boundingBox())!.width;
  expect(map).toBeGreaterThan(900);
  expect(map).toBeLessThan(940);
  await page.getByTestId('draw-button').click();
  await expect(page.getByRole('tab')).toHaveCount(0);
  expect(await columnsOn(page)).toHaveLength(3);
  expect((await page.getByTestId('map-cell').boundingBox())!.width).toBeGreaterThanOrEqual(500);
});
