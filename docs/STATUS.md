# Status — 2026-10-05

Live: https://geospatial-workspace.vercel.app (Vercel project `geospatial-workspace`, deploys on push to `main`).

## Works now (M0, M1, M2 + part of M3)
- One MapLibre instance; Map (light/dark) and Satellite basemaps; Hebrew RTL default, English.
- Full-bleed map under a fixed top bar (Map Only, Settings, language). Floating map controls:
  zoom/compass, basemap picker, light/dark switch; floating coordinates + zoom readout.
- Dock: floating rails on both map edges open panels as columns beside the map (never over it).
  Several columns per side, tab groups when space runs out, tab menu (move side / split), splitters
  (mouse + keyboard, 220–450 px, map ≥ 500 px), Map Only, layout persisted and reflowed on resize.
- Tool Registry + ToolContext. Panels: Layers (basemap section; layer list empty until M3),
  Settings (language, units, coordinate format, two-step reset). Dev-only: Debug, Sample.
- Tests: 51 unit (planner incl. randomized invariants), 78 E2E (he/en × 1366/1920/2560).
- `?debug` exposes `window.__gws` on any build.

## Next step
M3 — LayerManager: a store slice of `WorkspaceLayer`s + `order`, synced to MapService by diff
(MapService already restores `ws:` layers after basemap switches). Then the layer list UI in
`src/panels/LayersPanel.tsx` and `ToolContext.layers`. See docs/ROADMAP.md.

## Known issues
- Satellite provider terms are an open decision (docs/DECISIONS.md).
- The cloud sandbox cannot reach tiles.openfreemap.org / arcgisonline, so local screenshots show an
  empty map; verify tiles on the live site.
- Two open tabs share one LocalStorage workspace; the last one to change wins (fine for Stage 0).
- maplibre-gl chunk ~1 MB (280 KB gzip), cached separately.
