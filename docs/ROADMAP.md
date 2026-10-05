# Roadmap — Stage 0

Order follows the implementation spec. M2 and M3 can run in parallel after M1.

## M2 — Dock System  ← next
- [ ] `dockPlanner.ts`: pure open/close/reflow planner + unit tests for every branch (spec §4.3–4.4)
- [ ] Grid columns from dock state; splitters (pointer + keyboard, clamp 220–450, map ≥ 500)
- [ ] Tab groups when space runs out; tab strip; close per tab
- [ ] Map Only mode with layout restore (button, Ctrl+Shift+M, Escape)
- [ ] Persist dock state (debounced); reflow on restore and on window resize
- [ ] E2E for DCK-01..05 in Hebrew and English

## M3 — Layers + Tools
- [ ] ToolRegistry + ToolContext; floating rails over the map edge, built from the registry
- [ ] LayerManager (store → MapService diff) and Layers panel
- [ ] Decide satellite provider/key (open decision)
- [ ] Settings tool (language, units, coordinate format, reset workspace)
- [ ] Inspector tool; Debug tool (dev only: test layer, open N panels)

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
