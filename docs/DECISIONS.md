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
