# Status — 2026-10-05

Live: https://geospatial-workspace.vercel.app (Vercel project `geospatial-workspace`, deploys on push to `main`).

## Works now (M0 + M1)
- Vite + React 19 + TS strict app; `npm run check` (oxlint, architecture guard, 18 unit tests, build) passes.
- One MapLibre instance (OpenFreeMap Light/Dark), first open frames all of Israel, camera persists.
- Hebrew RTL by default, English via top-bar button; layout, map controls and map labels follow the language.
- Status bar: cursor coordinates (5 decimals), zoom, basemap toggle; basemap-load error indicator.
- MapService restores `ws:` layers after a basemap switch (unit tested; no UI uses it until M3).
- E2E: 7 scenarios × 1366/1920/2560 pass locally.
- Verified on the live site in Chrome: OpenFreeMap tiles render, Hebrew place names render correctly.
- `?debug` exposes `window.__gws` on any build for diagnosis.

## Next step
M2 — Dock System. Start with `src/layout/dockPlanner.ts` as a pure function and its unit tests
(spec §4.3: open → new column / narrower column / tab / reflow other side), then render columns in
`WorkspaceLayout` grid, then splitters, tabs, Map Only. See docs/ROADMAP.md.

## Known issues
- Rails are empty until the Tool Registry (M3) fills them.
- The cloud sandbox cannot reach tiles.openfreemap.org, so local screenshots show an empty map;
  verify tiles on the live site.
- Two open tabs share one LocalStorage workspace; the last one to move wins (acceptable for Stage 0).
- maplibre-gl chunk is ~1 MB (280 KB gzip); accepted, cached separately.
