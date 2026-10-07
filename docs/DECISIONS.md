# Decisions

Append-only. Superseded entries are marked, never deleted.

## 2026-10-05 — Stack: Vite + React SPA, not Next.js
The Stage 0 spec requires React + TypeScript + Vite, a static app with no backend. Deployed as a
static site on Vercel. Rejected: Next.js (the usual default) — no server work exists in Stage 0.

## 2026-10-05 — React 19, Vite 8, MapLibre 6
Current versions from the Vite template and npm (the implementation spec said React 18 / MapLibre 5).
No API we rely on differs.

## 2026-10-05 — No RTL text plugin
MapLibre 6 renders Hebrew/Arabic labels natively; `setRTLTextPlugin` is deprecated. Supersedes the
implementation-spec line about `@mapbox/mapbox-gl-rtl-text`.

## 2026-10-05 — MapLibre worker bundled by Vite
MapLibre 6 locates its worker relative to its own module, which Vite relocates, so the worker failed
to load. We import `maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url` and call `setWorkerUrl`.
Guarded by an E2E test.

## 2026-10-05 — MapService restores workspace layers after a basemap switch
`setStyle` wipes non-style layers. MapService records every `ws:` source and layer (with order,
visibility, opacity) and re-adds them on `style.load`. Chosen over `transformStyle` because the
same record also serves late-mounted layers. Unit tested with a fake map.

## 2026-10-05 — Product decisions (owner)
- UI in Hebrew and English from Stage 0; Hebrew default. Layout mirrors under `dir="rtl"`.
- Sketch layer survives refresh but not closing the tab → sessionStorage.
- Basemaps: Light (`positron`) and Dark (`dark`) from OpenFreeMap; Light default.
- Units configurable: metric (default), nautical, imperial.
- First open frames all of Israel (`fitBounds`), not a fixed zoom.
- Deploy: Vercel preview per branch (owner had no preference).

## 2026-10-05 — Lint: oxlint + custom architecture guard
oxlint (from the Vite template) for code lint; module boundaries enforced by a ~90-line script
instead of ESLint plugin config. Rejected: ESLint + import plugins — more config for the same rules.

## 2026-10-05 — Map controls on the side away from the main dock
Navigation control top-right in LTR, top-left in RTL; scale in the opposite bottom corner.

## 2026-10-05 — Full-bleed map; only the top bar is fixed (owner)
The map runs edge to edge under the top bar. The status bar became a floating readout in the
bottom corner of the map. Rails were empty and are removed for now; in M3 they return as thin
floating toolbars over the map edge. Docked panels (M2) still take width from the map and never
float over it (DCK-01). Supersedes the spec's fixed rail columns and status bar row.

## 2026-10-05 — Basemaps: Map (light/dark) + Satellite; picker + separate theme switch (owner)
`map` has light and dark variants; `satellite` is imagery with OpenFreeMap borders and place names
recoloured on top (assembled at runtime, label style fetch times out after 4 s → imagery only).
UI: a floating basemap picker (radio list, extensible for Terrain/Marine) and an icon switch that
shows the theme it switches to. The old status-bar word toggle is gone. Stored `light`/`dark`
ids migrate to `map` + theme. Dark labels are brightened per-basemap via `labelPaint`.

## 2026-10-05 — OPEN: satellite imagery provider
Using Esri World Imagery's public endpoint (no key) with attribution. Esri's terms may require an
ArcGIS account/key for this use; not yet confirmed. Options: ArcGIS Location Platform key,
MapTiler Satellite (key, free tier). Switching is a change in `basemaps.config.ts` only.

## 2026-10-05 — M2 dock: pure planner, tool registry pulled forward
- All layout decisions live in `src/layout/dockPlanner.ts` (pure, unit tested incl. a randomized
  invariant test). The store calls it; components only render.
- Open order: new column at default/remembered width → narrower column (≥ 220) → tab in the side's
  innermost column → make room on the other side. Body < 900 px: one column per side.
- Map Only keeps the columns in state and only hides them (no snapshot needed); opening a panel
  from a rail leaves Map Only.
- Splitter drags write the grid template to the DOM directly and commit on release (no re-render
  per pixel); keyboard: arrows ±16, Home/End.
- The Tool Registry, floating rails and two real panels (Layers, Settings) came forward from M3 —
  a dock with nothing to open is not testable. Debug + Sample panels are dev-only (absent in prod).
- Rails are floating pills centred vertically on the map's side edges, clear of the MapLibre
  control corners. Built-in panels live in `src/panels`, registered in `src/app/builtinTools.tsx`.

## 2026-10-05 — Built-ins off the map edges (owner)
Settings opens only from the top bar; the Layers panel opens from the layers button in the map
controls (which replaced the basemap popover). The Layers panel holds the basemap choice and
"additional layers". `ToolDefinition.rail: false` keeps a tool off the rails; rails are for
domain tools (and dev-only tools). In production the rails are currently empty and not rendered.

## 2026-10-05 — M3 layers: store is the truth, LayerManager diffs
- `WorkspaceLayer` (spec §7) gains `mapLayers` (MapLibre styles without id/source; empty → type
  defaults), `ownerToolId` and `persist: 'local' | 'session' | 'none'`.
- `src/layers/LayerManager.ts` diffs store → MapService: add/remove, visibility, opacity, z-order;
  GeoJSON data changes go through `setGeoJSONData` (no layer churn). Structural changes re-create.
  A bad style from a tool is caught and recorded; the rest keeps drawing.
- Workspace opacity multiplies each style's own opacity (a 25 % fill at 50 % → 12.5 %), via a
  generic `MapService.setPaintProperty`.
- Local layers are saved inside the workspace key; session layers in `gws:session-layers:v1`.
- `ToolContext.layers` tags `ownerToolId`; a tool may remove its own non-removable layers; closing
  a tool keeps its layers (spec §8).
- Reorder: drag (dnd-kit, keyboard sensor: Space + arrows) plus Move up/down in the row menu.
- Inspector tool moved to M5 (not in the DoD).

## 2026-10-06 — Layer adds are idempotent; one LayerManager per page
React StrictMode re-ran the wiring effect and a second LayerManager re-added restored layers, so
MapService recorded duplicates. Now `MapService.addLayer` with an existing id replaces it, and the
LayerManager is a module-level singleton like the map.

## 2026-10-06 — M4 measure & draw
- terra-draw + its MapLibre adapter behind `src/map/draw/DrawController.ts` (in src/map because it
  needs the raw map; `MapService.internalMap()` exists only for that). Rebuilt after every style
  load (setStyle wipes its layers); the current measurement is restored.
- Opened from a ruler button in the map controls (no rail button, owner's preference for built-ins).
- Measure: one temporary distance or area at a time, live while drawing, cleared when the panel
  closes or another tool is picked. Geodesic via Turf. Units follow Settings; metric areas also in
  dunams in Hebrew. Hebrew abbreviations use gershayim (ק״מ, מ״ר).
- Draw: point / line / polygon go into one fixed-id `sketch` workspace layer (persist: session),
  listed under Layers; delete-last and clear. Escape cancels the shape in progress, Enter finishes.
- Pitfall: terra-draw disables MapLibre double-click zoom whenever any mode starts (even idle);
  DrawController re-enables it when no tool is active. Guarded by an E2E test.
- E2E now serves a tiny local style (`e2e/fixtures.ts`) so the map fully loads offline; used by
  the draw tests.
- Not in Stage 0: editing existing sketch shapes (select mode), measurement labels on the map.

## 2026-10-07 — Measurements and drawings reorganised (owner feedback) — supersedes the session Sketch
- Measurements are not layers. Their own panel (ruler button) with a temporary live measurement
  and **Save**; saved ones are a named list (show/hide, rename, zoom to, delete) stored in the
  workspace key (`measurements`) and drawn by `src/utilities/measure/measurementOverlay.ts` on the
  `ws:measurements` source: dashed amber, labelled "name · value" (value follows units/language).
- Drawing has its own panel (pencil button). Shapes go into a **target drawing layer**; many
  shapes = one layer. The first shape creates "ציור 1" automatically; "+ שכבה חדשה…" makes a named
  one. Drawing layers are ordinary WorkspaceLayers (`group: 'drawing'`, owner `draw`), one colour
  each, every shape a feature `{fid, name, kind}` labelled with its name on the map.
- **Persistence changed**: drawing layers and saved measurements are kept permanently (`local`),
  not per tab as the old Sketch was. Reversible; asked the owner to confirm.
- Picking (`src/layers/picking.ts`): with no draw tool active, clicking a workspace feature opens
  the panel that lists it (Layers for layers, Measurements for measurements) and reveals the item:
  the row expands, scrolls into view and flashes. `store.reveal()` sets a short-lived `focus`
  (cleared after 2 s) so a panel opened by that click sees it on mount and later ones don't.
- Label glyphs come from the basemap style. If the satellite labels overlay fails to load, the
  satellite style has no glyphs: shapes still draw, their labels don't (MapService skips the bad
  layer).
