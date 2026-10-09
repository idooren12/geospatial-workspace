# Geospatial Workspace

A reusable map workspace (Stage 0 platform). Future domain tools — Weather, RF, LOS, Routing, UAS,
Maritime, Terrain — plug into one shared map, dock layout, layer system and tool registry.
**Stage 0 contains no domain logic.** Hebrew (RTL, default) and English UI.

- Requirements: `Geospatial_Workspace_Stage_0_Specification.docx` (owner has it)
- Implementation spec (Hebrew): https://claude.ai/code/artifact/e6e7bd82-5c0d-4cfd-91c2-15b227927ec9

## Stack

React 19 + TypeScript (strict) · Vite 8 · MapLibre GL JS 6 · OpenFreeMap vector styles ·
Zustand · i18next · Radix (tooltip, direction) · CSS Modules + tokens · Vitest · Playwright.
No backend. Storage only through `src/persistence` (schema v2): prefs in localStorage
(`gws:workspace:v2`), drawing layers + saved measurements in IndexedDB (`gws` → `docs/geometry`),
session layers in sessionStorage. v1 is migrated automatically.

## Commands

```
npm install
npm run dev          # http://localhost:5173
npm run check        # lint + architecture guard + unit tests + build (what CI runs)
npm run test:e2e     # Playwright at 1366/1920/2560; set PW_CHROMIUM=<path> in sandboxes
npm run test:visual  # screenshot baselines (local only; -- --update-snapshots to refresh)
```

## Where it runs

| Part | Service | Address |
| --- | --- | --- |
| Code | GitHub | https://github.com/idooren12/geospatial-workspace |
| App | Vercel (static, auto-deploy from `main`) | https://geospatial-workspace.vercel.app |
| Debug | any build | append `?debug` → `window.__gws.mapService` / `.map` |

## Hard rules (enforced by `scripts/check-boundaries.mjs`)

- Only `src/map/` imports `maplibre-gl`. Everything else uses `mapService`.
- Basemap URLs live only in `src/map/basemaps.config.ts`.
- No domain terms (weather, GRIB, Fresnel, LOS…) in the platform core.
- No physical `left`/`right` CSS outside the map; use logical properties (RTL).
- Workspace source/layer/image ids start with `ws:`.
- One MapLibre instance for the life of the page; never remount it.
- Map Core (`src/map`) imports nothing from the rest of the app.
- localStorage / sessionStorage / indexedDB only inside `src/persistence`.
- `src/layers` knows no tools or utilities (tools extend it via `ToolDefinition.layerDetails`).
- User edits to layers, drawings and saved measurements go through the command modules
  (`layerCommands`, `measureCommands`, drawing functions) so they land in undo/redo.

## Docs

- `docs/STATUS.md` — where things stand and the exact next step. Read first.
- `docs/DECISIONS.md` — decision log. `docs/ROADMAP.md` — milestones M0–M5.
- `docs/SESSIONS.md` — session log. `docs/ENV.md` — environment variables (none yet).
- `docs/ATTRIBUTION.md` — basemap licences and credits. `docs/M5_REPORT.md` — Stage 0 hardening report.
