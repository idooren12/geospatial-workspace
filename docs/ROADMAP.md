# Roadmap — Stage 0

Order follows the implementation spec. M2 and M3 can run in parallel after M1.

## M3 — Layers + Tools  ← next
- [ ] LayerManager (store → MapService diff) + layer list in the Layers panel (show/hide, opacity,
      rename, reorder by drag and keyboard, remove) — spec §7.1
- [ ] `ToolContext.layers` API for tools (creates `ws:` layers, tags ownerToolId)
- [ ] Debug panel: add/remove a test layer (dev only) to exercise the LayerManager
- [ ] Inspector tool (click a feature → its properties)
- [ ] Decide satellite provider/key (open decision)

## M4 — Utilities
- [ ] terra-draw DrawController; Sketch layer in sessionStorage
- [ ] Distance and area measurement with unit setting
- [ ] Re-init drawing after basemap switch

## M5 — Hardening
- [ ] Accessibility pass (keyboard, aria, focus), performance checks
- [ ] Full DoD checklist (21 items) at 1366/1920/2560, both languages
- [ ] Architecture review gate before Stage 1

## Done
- [x] M0 — Scaffold: Vite + React + TS strict, oxlint, architecture guard, Vitest, Playwright, CI
- [x] M1 — Map Core: MapService, MapView, BasemapManager (Light/Dark), Hebrew/English labels,
      view persistence, Israel first view, language switch
- [x] Satellite basemap, basemap picker, light/dark switch, full-bleed map with floating readout
- [x] M2 — Dock: planner, columns, splitters, tabs, tab menu (move side / split), Map Only
      (button, Ctrl+Shift+M, Esc), persistence + reflow on resize, E2E DCK-01..05 in he/en
- [x] From M3: Tool Registry + ToolContext, floating rails, Layers panel (basemap section,
      empty layers), Settings panel (language, units, coordinates, reset), dev Debug/Sample
