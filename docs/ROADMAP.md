# Roadmap — Stage 0

Order follows the implementation spec.

## Gate — architecture review before Stage 1  ← next
- [ ] Owner + planner review docs/M5_REPORT.md; freeze Stage 0
- [ ] Decide satellite provider/key for production (docs/ATTRIBUTION.md)

## Later (not in Stage 0)
- Inspector tool (click a feature → its properties)
- Edit existing shapes (terra-draw select mode)
- Sync open tabs (storage event / BroadcastChannel)
- Visual snapshots in CI (pinned Playwright Docker image)

## Done
- [x] M5 — Hardening: DoD audit; status bar; attribution compliance; persistence v2 (adapter,
      IndexedDB, migration, GeoJSON measurements); undo/redo + confirm dialogs; selection
      highlight; readable labels; keyboard splitters; a11y (axe) pass; architecture guard
      extended; visual + responsive + lifecycle tests (docs/M5_REPORT.md)
- [x] M0 — Scaffold: Vite + React + TS strict, oxlint, architecture guard, Vitest, Playwright, CI
- [x] M1 — Map Core: MapService, MapView, BasemapManager (Light/Dark), Hebrew/English labels,
      view persistence, Israel first view, language switch
- [x] Satellite basemap, light/dark switch, full-bleed map with floating readout
- [x] M2 — Dock: planner, columns, splitters, tabs, tab menu (move side / split), Map Only
      (button, Ctrl+Shift+M, Esc), persistence + reflow on resize, E2E DCK-01..05 in he/en
- [x] Tool Registry + ToolContext, floating rails (domain tools only), Layers panel opened from the
      map's layers button, Settings panel from the top bar, dev Debug/Sample
- [x] M3 — Layers: WorkspaceLayer model, store slice (local / session / none persistence),
      LayerManager diff-sync to MapService (opacity multiplies style opacity, in-place GeoJSON
      updates, z-order), `ToolContext.layers`, layer list (show/hide, opacity, rename by double
      click / F2 / menu, reorder by drag, keyboard and menu, remove), dev test-layer buttons
- [x] M4 — Measure (distance, area; live; units; dunams) and draw (point/line/polygon → session
      Sketch layer, undo, clear) from a ruler button; terra-draw rebuilt across basemap switches
- [x] M4 follow-up (owner) — Measurements panel with a saved, named list (not layers); Draw panel
      that groups shapes into named drawing layers; names labelled on the map; clicking a feature
      opens its panel and reveals it
