import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, freshStart, test } from './fixtures';

/** WCAG 2.1 A/AA checks over the live DOM (the map canvas itself is out of scope for axe). */
async function violations(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).exclude('.maplibregl-canvas').analyze();
  return r.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.help} — ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`);
}

for (const lang of ['he', 'en'] as const) {
  test(`no serious accessibility violations with every panel open (${lang})`, async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await freshStart(page, { settings: { language: lang } });
    await page.getByTestId('layers-button').click();
    await page.getByTestId('measure-button').click();
    await page.getByTestId('draw-button').click();
    await page.getByTestId('topbar-settings').click();
    await expect(page.getByTestId('panel-settings')).toBeVisible();
    expect(await violations(page)).toEqual([]);
  });
}

test('the confirm dialog is accessible, traps focus, closes on Escape and restores focus', async ({ page }) => {
  await freshStart(page, { settings: { language: 'en' } });
  await page.getByTestId('topbar-settings').click();
  const reset = page.getByTestId('settings-reset');
  await reset.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await expect(page.getByTestId('confirm-cancel')).toBeFocused(); // the safe choice
  expect(await violations(page)).toEqual([]);
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(reset).toBeFocused();
});
