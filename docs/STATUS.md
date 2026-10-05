# Status — 2026-10-05

Live: https://geospatial-workspace.vercel.app (Vercel project `geospatial-workspace`, deploys on push to `main`).

## Works now (M0–M3)
- One MapLibre instance; Map (light/dark) and Satellite basemaps; Hebrew RTL default, English.
- Full-bleed map under a fixed top bar (Map Only, Settings, language). Floating map controls:
  zoom/compass, layers button (opens the Layers panel), light/dark switch; floating readout.
- Dock: panels open as columns beside the map (never over it); several per side, tabs when space
  runs out, tab menu, splitters (220–450 px, map ≥ 500 px), Map Only, persisted + reflowed.
  Rails on the map edges list domain tools only (none in prod; dev shows Debug/Sample).
- Layers (M3): `WorkspaceLayer`s in the store, synced to the map by `src/layers/LayerManager.ts`;
  tools add them via `ToolContext.layers`. Layers panel: basemap choice + layer list with show/hide,
  opacity, rename, reorder (drag, keyboard, menu), remove. Saved per `persist`: local / session /
  none. Survive basemap switches and refresh. Dev Debug panel adds GeoJSON test layers.
- `?debug` exposes `window.__gws` (`mapService`, `map`, `layers.add/remove/list`) on any build.

## Next step
M4 — Utilities: terra-draw (`terra-draw` + `terra-draw-maplibre-gl-adapter`) behind a
DrawController in `src/utilities/draw`, a Measure & Draw panel on the rail, measurement with the
unit setting, and a Sketch layer with `persist: 'session'`. See docs/ROADMAP.md.

## Known issues
- Satellite provider terms are an open decision (docs/DECISIONS.md).
- The cloud sandbox cannot reach tiles.openfreemap.org / arcgisonline: the map style never loads
  there, so local screenshots show an empty map and layers are only recorded, not drawn. Verify on
  the live site (with `?debug`).
- After `npm install` of new packages, restart the dev server with `--force` (stale Vite dep cache
  gives 504 "Outdated Optimize Dep").
- Two open tabs share one LocalStorage workspace; the last one to change wins.
- maplibre-gl chunk ~1 MB (280 KB gzip), cached separately.
