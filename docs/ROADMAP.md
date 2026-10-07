# Roadmap — Stage 0

Order follows the implementation spec.

## M5 — Hardening  ← next
- [ ] Inspector tool (click a feature → its properties)
- [ ] Optional: edit existing sketch shapes (terra-draw select mode); measurement label on the map
- [ ] Optional: sync open tabs via the `storage` event
- [ ] Accessibility pass (keyboard, aria, focus), performance checks
- [ ] Full DoD checklist (21 items) at 1366/1920/2560, both languages
- [ ] Decide satellite provider/key (open decision)
- [ ] Architecture review gate before Stage 1

## Done
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
