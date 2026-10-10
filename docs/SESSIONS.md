# Sessions

- 2026-10-05 — Implementation spec written and decisions taken; M0 scaffold + M1 Map Core built, tested (18 unit, 21 E2E), pushed, deployed to Vercel.
- 2026-10-05 — Deployed to Vercel; added Satellite, basemap picker, light/dark switch, full-bleed map (owner feedback).
- 2026-10-05 — M2 dock system + Tool Registry, rails, Layers/Settings panels; 51 unit + 78 E2E tests.
- 2026-10-05 — Layers button replaces basemap popover; Settings in top bar only (owner). M3 LayerManager + layer list.
- 2026-10-06 — Recovered uncommitted M3 work from a previous session (rebuilt overwritten layerTypes.ts), fixed duplicate layers after refresh (single LayerManager, idempotent MapService.addLayer), stabilised keyboard-reorder E2E; committed and deployed M3.
- 2026-10-06 — M4 measure & draw (terra-draw), session Sketch layer, offline E2E style fixture; fixed terra-draw disabling double-click zoom.
- 2026-10-07 — Owner feedback on M4: Measurements panel with saved list, drawing layers grouping named shapes, labels on the map, click-to-reveal; draw E2E rewritten.
- 2026-10-09 — M5 hardening per owner/planner review (29 points): status bar, attribution, persistence v2 (IndexedDB), undo/redo, confirm dialogs, selection, labels, a11y, architecture guard, visual/responsive/lifecycle E2E; report in docs/archive/stage-0/M5_REPORT.md.
- 2026-10-10 — M5.1: dock side-by-side by actual widths, map loading/error state, isolated ?debug sandbox, Esri key via VITE_ARCGIS_API_KEY, freeze docs (INTERFACES, TESTING), tag v0.1-stage0.
