# Status — 2026-10-10

Live: https://geospatial-workspace.vercel.app (Vercel project `geospatial-workspace`, deploys on push to `main`).

## Works now (Stage 0 complete and frozen — tag `v0.1-stage0`)
- One MapLibre instance; Map (light/dark) and Satellite basemaps; Hebrew RTL default, English.
- Fixed top bar (undo/redo, Map Only, Settings, language) and a 24 px status bar (coordinates —
  click to copy —, zoom, basemap); the map fills everything between them. Map controls: zoom,
  layers, measurements, draw, light/dark. Attribution is never compact or covered.
- Dock: columns beside the map; same-side panels sit side by side whenever the map keeps ≥ 500 px
  (tabs only as overflow); splitters (drag + full keyboard), Map Only, persisted, reflow.
- Map loading: theme-matched backdrop, "Loading map…" after 200 ms, error + Retry on failures.
- Layers: generic WorkspaceLayer + LayerManager; Layers panel (basemap + layers: show/hide,
  opacity, rename, reorder, delete with confirm). Tools add details via `ToolDefinition.layerDetails`.
- Measurements (own panel, saved named list) and drawing layers (named shapes grouped in layers),
  labels readable on every basemap; click a shape → its panel opens and it is highlighted;
  select in a panel → highlighted on the map (no camera move).
- Undo/redo for all user edits (Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Ctrl+Y); single deletes have an
  Undo toast, layer deletes and reset ask first.
- Persistence v2: prefs in localStorage, drawing layers + saved measurements in IndexedDB,
  auto-saved, migrated from v1, corrupt data handled. This browser only.
- Tests: see docs/archive/stage-0/M5_REPORT.md. `?debug` opens an isolated sandbox (DEBUG MODE
  badge, own session storage, never the real workspace) with `window.__gws`.

## Next step
Owner reviews the Stage 0 result. Stage 1 is not started and has no plan document yet — wait for
the owner. Owner action pending: ArcGIS key for the satellite basemap (docs/ENV.md); until then
the public Esri endpoint is used.

## Known issues
- Satellite runs on Esri's public endpoint until the owner sets `VITE_ARCGIS_API_KEY` (docs/ENV.md).
- Visual snapshots run locally only (`npm run test:visual`), not in CI.
- The cloud sandbox cannot reach tiles.openfreemap.org / arcgisonline. E2E tests serve local
  stand-ins (`e2e/fixtures.ts`: styles, Noto glyphs, imagery), so maps, labels and attribution do
  render in tests; real tiles are checked on the live site (with `?debug`).
- After `npm install` of new packages, restart the dev server with `--force` (stale Vite dep cache
  gives 504 "Outdated Optimize Dep").
- Two open tabs share one stored workspace; the last one to change wins (no cross-tab sync).
- maplibre-gl chunk ~1 MB (280 KB gzip), cached separately.
