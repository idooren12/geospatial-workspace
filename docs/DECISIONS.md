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
