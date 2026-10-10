# Testing

| Layer | Tool | Runs in CI | Command |
| --- | --- | --- | --- |
| Lint, architecture guard, unit + component | oxlint, `scripts/check-boundaries.mjs`, Vitest + Testing Library | yes (`check` job) | `npm run check` |
| E2E: behaviour, DOM geometry, layout, a11y (axe), persistence | Playwright, 1366×768 / 1920×1080 / 2560×1440, he + en | yes (`e2e` job) | `npm run test:e2e` |
| Visual regression (screenshots) | Playwright `toHaveScreenshot` | **no** | `npm run test:visual` |

E2E runs offline. `e2e/fixtures.ts` serves stand-in styles, real Noto glyph ranges and a fixed
imagery tile, so the map, labels and attribution render the same way everywhere. Real tiles are
checked on the live site (open it with `?debug`, which is an isolated sandbox).

Layout correctness is asserted from the DOM in normal CI: no overlaps, attribution inside the map
and clickable, map ≥ 500 px, canvas = container. That stays the CI gate.

## Visual regression: current state and plan

**Now.** Seven snapshots (`e2e/visual.spec.ts`), compared only on the machine that made them.
Pixels depend on the browser build, the system fonts and the GPU or software renderer, so
comparing across machines gives false failures. CI skips them (`VISUAL` unset).

**If they become a gate.** Do all of the following, not some of them:

1. Run them in one pinned image, for example `mcr.microsoft.com/playwright:v<same version as
   @playwright/test>-noble`, in a separate CI job. Pin it by digest.
2. Generate and update baselines **only** inside that image (`docker run … npx playwright test
   e2e/visual.spec.ts --update-snapshots`), never from a laptop.
3. Keep the determinism already in place: offline styles, glyphs and imagery, a fixed camera,
   web fonts blocked, animations and caret off. Pin a font package in the image.
4. Treat a visual diff as a review prompt, not an automatic failure, for the first few weeks.
   Tune `maxDiffPixelRatio` from data.
5. Upgrade Playwright and the image together, and regenerate baselines in the same change.
