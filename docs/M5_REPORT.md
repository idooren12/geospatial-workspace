# M5 completion report — Stage 0 hardening and architecture freeze

Date: 2026-10-09 · Scope: the owner's live-site findings plus the planner's 29 review points.
No Stage 1 work is in this change set.

## 1. Summary

Every Stage 0 DoD item is now PASS with an automated test, except DoD 3, which works but has no
production rails yet (see the table). The four live-site findings are fixed:

1. Attribution was cut off under the floating chip. The chip is gone; the attribution is never
   compact and never covered, and it wraps on a narrow map.
2. Unselected labels were faint on the dark map. Labels now sit on a light background.
3. Deletes were immediate with no way back. Single items delete at once with an Undo toast;
   whole layers ask first; there is full undo/redo.
4. A floating chip replaced the spec's status bar. There is now a real status bar.

The review also brought in IndexedDB persistence with schema v2 and migration, selection that
highlights on the map, keyboard splitters, an accessibility pass and extended architecture
guards. It added visual, responsive and lifecycle tests. All of it is now in place.

## 2. Definition of Done audit (spec §11)

Each row shows the status before and after M5. Tests: `e2e/*.spec.ts` run at 1366/1920/2560 in
both languages unless noted; `*.test.ts` are unit tests.

| # | Item | Before | After | Evidence |
|---|---|---|---|---|
| 1 | Map with OpenFreeMap loads | PASS | PASS | workspace.spec "MapLibre worker loads"; live check |
| 2 | Pan / zoom | PARTIAL (zoom only implied) | PASS | dod.spec "DoD 2: wheel zooms, dragging pans" |
| 3 | Compact rails (44–52 px) | PARTIAL | PARTIAL | dod.spec "DoD 3"; extensibility.test.tsx. Rails render for any registered tool and measure 48 px. Production has none yet, because the owner moved the built-ins to map controls and the top bar. Stage 1 tools fill them. |
| 4 | Panels on both sides | PASS | PASS | dock.spec DCK-02..04; responsive.spec |
| 5 | Several panels on one side | PASS | PASS | dock.spec; visual "multi-panels-1920" |
| 6 | No overlap between panels | PASS | PASS | dock.spec (rectangle intersection = 0) |
| 7 | Panel never over the map | PASS | PASS | dock.spec; responsive.spec |
| 8 | Map container resizes | PASS | PASS | dock.spec (map width = body − docks) |
| 9 | MapLibre follows (canvas = container) | PASS | PASS | workspace.spec, dock.spec |
| 10 | Splitter (drag + clamp 220–450, map ≥ 500) | PARTIAL | PASS | lifecycle.spec "splitter"; dockPlanner.test `maxColumnWidth`. Before: no larger keyboard step, and the drag preview ignored the map minimum until release. |
| 11 | Full collapse | PASS | PASS | dock.spec DCK-05 |
| 12 | Map Only + restore | PASS | PASS | dock.spec; workspace.spec (status bar hidden); visual "map-only" |
| 13 | Layer Manager | PASS | PASS | LayerManager.test; layers.spec; lifecycle.spec |
| 14 | Tool Registry | PASS | PASS | ToolRegistry.test; extensibility.test.tsx (a new tool by registration only) |
| 15 | Basemap URLs only in config | PASS | PASS | architecture guard (now also covers arcgisonline.com); BasemapManager.test licensing |
| 16 | Coordinates + zoom in the **status bar** | FAIL | PASS | workspace.spec "status bar shows cursor coordinates, zoom and basemap" |
| 17 | Distance measurement | PASS | PASS | measure.test (Tel Aviv–Jerusalem ≈ 54 km); draw.spec UTL-03 |
| 18 | Draw point / line / polygon | PASS | PASS | draw.spec UTL-05; history.spec |
| 19 | Restore after refresh | PASS | PASS | workspace.spec, dock.spec, persistence.spec (also after closing the browser) |
| 20 | Clean `npm run build` | PASS | PASS | `npm run check` (CI) |
| 21 | No domain logic in the core | PASS | PASS | architecture guard (domain-term scan, now including persistence and history) |

## 3. The 29 review points

Status: **Done**, **Done with a note** or **Not done**. Disagreements are in §9.

| # | Point | Status | What was done |
|---|---|---|---|
| 1 | DoD audit, fix FAIL / PARTIAL | Done | §2. DoD 16 fixed; DoD 2 and 10 got their missing tests and behaviour; DoD 3 explained. |
| 2 | Real status bar, 24–28 px, outside the map | Done with a note | `src/layout/StatusBar.tsx`: coordinates (click to copy), zoom, basemap, and a basemap-error message. Its least important field is dropped on narrow widths. Hidden in Map Only (spec §4.6). Note: this reverses the owner's own earlier request (the map down to the bottom with a floating chip). |
| 3 | Attribution compliance at narrow map widths | Done | Never compact; scale stacked above it; wraps over the map width. responsive.spec checks map widths ~800 / ~640 / 500 and a 980 px window, for each basemap and both languages, and checks that every credit link is clickable. |
| 4 | Licensing audit; satellite terms; no secrets | Done | `docs/ATTRIBUTION.md`; a `licence` record per basemap in the config, unit-tested against what the style actually credits. Esri credit updated (Vantor, "Powered by Esri"). Production Esri licensing remains an open owner decision. |
| 5 | Readable labels on every basemap | Done | A light background behind the text, fitted to it (`src/map/labelStyle.ts`). Checked on light, dark and satellite with Hebrew, English and mixed names (visual snapshots). Selected labels are accent-coloured. |
| 6 | Destructive-action model | Done | One item: deleted at once, with an Undo toast. A layer that holds features: a confirm dialog that names the layer and the number of features. Workspace reset: confirm dialog, cannot be undone. |
| 7 | Central undo/redo, shortcuts | Done with a note | `src/history/history.ts` (100 steps, session-only). Covers add/delete/rename of drawings; delete/rename/show-hide/reorder of layers; save/delete/rename/show-hide of measurements. Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z and Ctrl+Y work outside text fields; there are also top-bar buttons. Opacity slider moves are deliberately not recorded (they would flood the stack). |
| 8 | Saved and named items persist; in-progress items stay temporary; no implied cloud | Done | persistence.spec reopens a fresh browser context from the saved profile. Settings says "this browser only, nothing is synced". |
| 9 | PersistenceAdapter; IndexedDB for geometry; no storage in UI | Done | `src/persistence/`. The guard fails the build on storage APIs anywhere else. |
| 10 | Versioned schema, validation, migrations, corrupted data | Done | Schema v2. Validated field by field and item by item. v1 is migrated once. Unreadable data is copied to `gws:corrupt:*` and the app starts from defaults. Only plain JSON is stored. |
| 11 | GeoJSON WGS84; ids separate from names | Done | Measurements are stored as LineString/Polygon; drawings as GeoJSON Features. Layer `L…`, feature `d…` and measurement `M…` ids are independent of names. |
| 12 | Accessibility pass | Done | axe (WCAG 2.1 A/AA) finds no serious or critical issues with every panel open, in both languages, and with the dialog open. Dialog: focus trap, Escape, focus restored, initial focus on Cancel. Names and lists can be selected with Enter or Space; the selected state is exposed via `aria-pressed` / `aria-current`; the panel error has `role="alert"`; the status bar is no longer a live region. |
| 13 | Keyboard splitters | Done | WAI-ARIA window splitter: arrows ±16, Shift ±64, PageUp/PageDown, Home/End, `aria-valuemax` reflects the map minimum, `aria-controls`. Keyboard and drag use the same limit. |
| 14 | Hebrew / English audit | Done | Docks mirror by reading side, controls flip corner, numbers and coordinates are isolated LTR, names use `<bdi>`, undo/redo icons mirror in RTL. Wording fixes: לוויין, ביטול פעולה / ביצוע חוזר, singular "נקודה אחת", maqaf before Latin names. |
| 15 | Visual regression set | Done with a note | 7 deterministic snapshots (`e2e/visual.spec.ts`). They run locally with `npm run test:visual`, not in CI (see §9). |
| 16 | Responsive tests by map width | Done | responsive.spec, plus every spec running at 1366×768, 1920×1080 and 2560×1440. |
| 17 | Resize performance | Done | One MapLibre instance; `map.resize` at most once per animation frame. A splitter drag writes the grid template to the DOM and commits once on release, so it is saved once. Storage writes are debounced (250 ms) with a flush on pagehide. |
| 18 | Event lifecycle | Done | Every map, window and store subscription has a cleanup. Picking is now unwirable. lifecycle.spec reopens all tools, toggles Map Only, switches language three times and basemaps four times: the handler count stays the same, and there are no duplicate or orphaned `ws:` layers or sources. |
| 19 | One long-lived map; deterministic restore | Done | `instanceCount` stays 1 in lifecycle.spec. Restored layer order is identical after style switches. Overlays (measurements, selection) stay above workspace layers. |
| 20 | Architecture boundaries | Done | Fixed: MapView read the store; the Layers panel imported Draw; picking lived in `src/layers`; Settings touched storage. The guard now enforces each of these. |
| 21 | Layer, feature and tool ids separate | Done | `ownerToolId` vs layer id vs feature `fid`. Drawing layers are owned by the `draw` tool id. |
| 22 | Extensible registry; error boundaries | Done | extensibility.test.tsx registers a probe tool and a crashing tool: the probe gets a rail and a panel, and the crash stays in its column. App-level boundary added. Dev tools are compiled out of production. |
| 23 | Generic Layer Manager; metadata/provenance | Done | `WorkspaceLayer.metadata` (plain JSON, never interpreted by the layer system); raster, vector and custom types unchanged; no domain fields. |
| 24 | Panel selection highlights on the map, no recenter | Done | `src/app/selectionOverlay.ts`. history.spec checks that the camera is unchanged. Map click selects; a click on empty map clears. |
| 25 | Saved measurement model | Done | `{id, name, kind, geometry, value, unit, visible, createdAt, updatedAt}`; `value` is recomputed from geometry on load. |
| 26 | Map state persisted on moveend, sanitised | Done | Saved on moveend, debounced. On load, zoom, pitch and latitude are range-checked and longitude is wrapped (schema.test). |
| 27 | Release gate | Done | `npm run check` clean; full E2E green (§7); a new test for each regression fixed. |
| 28 | Dependencies and security | Done with a note | `npm audit`: 0 vulnerabilities (prod and dev). No secrets in the bundle (pattern scan of `dist/`). Debug/Sample panels are not in the production bundle. The `?debug` console hook is kept (§9). |
| 29 | This report | Done | — |

## 4. Architecture findings and fixes

| Finding | Fix |
|---|---|
| `src/map/MapView` imported the store and i18n (Map Core depended on the app) | MapView receives `label` and `mountOptions()` from the app. |
| The Layers panel imported the Draw utilities (Layer Manager tied to Draw) | `ToolDefinition.layerDetails`: the Draw tool contributes its shape list; LayerList stays generic. |
| `src/layers/picking.ts` knew measurements and the draw controller | Moved to `src/app/picking.ts` (composition layer), together with the new selection overlay. |
| The store did storage I/O; Settings called `clearWorkspace()` | Storage lives only in `src/persistence`; the store holds state; reset is a store action and the sync layer writes defaults. |
| No app-level error boundary | Added around the workspace; the panel boundaries remain. |
| Dev tools shipped in the production bundle (registration was skipped at runtime) | Behind `import.meta.env.DEV`, so they are removed at build time. |
| Old drawing layers carried old label styles in stored data | Styles are re-derived from the layer colour at startup. |

New guard rules in `scripts/check-boundaries.mjs`:

- Map Core imports nothing from the app.
- Storage APIs appear only in `src/persistence`.
- `src/layers` imports no tools, utilities or panels.
- `src/ui` imports no app modules.
- `arcgisonline.com` is treated as a provider URL.

Module map (Stage 0, frozen):

```
src/map          Map Core: MapService (one MapLibre), BasemapManager + config, DrawController, labelStyle
src/layers       generic layer model, LayerManager (diff → MapService), LayerList, layerCommands
src/layout       shell: TopBar, StatusBar, DockArea/planner, Rails, UndoToast, toolContext
src/tools        ToolRegistry + ToolDefinition / ToolContext contracts
src/persistence  schema v2, migration, PersistenceAdapter (browser / memory), auto-save
src/history      undo/redo command stack
src/store        state only (zustand)
src/ui           generic primitives (IconButton, ConfirmDialog, EditableName, ErrorBoundary)
src/utilities    measure, draw, coordinates (built-in utilities, no domain)
src/panels       built-in panels (Layers, Measurements, Draw, Settings; Debug in dev only)
src/app          composition root: wiring, picking, selection overlay, built-in tool registration
```

## 5. Persistence schema (version 2)

| Where | Key | Content |
|---|---|---|
| localStorage | `gws:workspace:v2` | `{version: 2, view, basemapId, mapTheme, settings{language, units, coordFormat}, dock}` |
| IndexedDB | db `gws`, store `docs`, key `geometry` | `{version: 2, layers{items, order}, measurements[]}` — only layers with `persist: 'local'` |
| localStorage (fallback) | `gws:geometry:v2` | Same document, used only when IndexedDB cannot be opened |
| sessionStorage | `gws:session-layers:v1` | Layers with `persist: 'session'` |
| localStorage | `gws:tool:<toolId>:<key>` | `ToolContext.storage` |
| localStorage | `gws:corrupt:<key>` | A copy of unreadable data |

- **Migration v1 → v2** (`migrateV1`): prefs and geometry are split; measurement `coordinates`
  become GeoJSON with `value` and `unit`; the old light/dark basemap ids are mapped. The geometry
  is written first and v1 is removed only after both parts are saved. Tested in
  `schema.test`, `browserAdapter.test` (real IndexedDB via fake-indexeddb) and `persistence.spec`.
- **Validation:** WGS84 positions (|lat| ≤ 90, finite numbers); geometry type must match the
  measurement kind; minimum vertices; duplicate ids dropped; layer sources and metadata must be
  plain JSON; unknown fields are ignored.

## 6. Accessibility and performance fixes

**Accessibility**

- axe gate in CI.
- Confirm dialog: focus trap, Escape cancels, focus is restored, initial focus is on the safe
  choice.
- Undo/redo buttons stay focusable when unavailable (`aria-disabled`) and say what they would
  undo.
- Item names act as toggle buttons (`aria-pressed`) and selected rows carry `aria-current`.
- Splitter follows the WAI-ARIA window-splitter pattern.
- Panel crash message uses `role="alert"`; the toast is a polite live region.
- The status bar is no longer a live region, so moving the mouse is not announced.

**Performance**

- Splitter drag: DOM-only preview, one store commit.
- Map resize: rAF-coalesced.
- Persistence: separate debounced writes for prefs and geometry; geometry writes are
  serialised.
- The selection highlight is capped at 500 features when a whole layer is selected.

## 7. Tests

| Suite | Count | Result |
|---|---|---|
| Unit + component (Vitest) | 95 in 13 files | all pass |
| E2E (Playwright: 3 window sizes, he/en) | 231 runs: 206 passed, 25 skipped by design (visual cases without VISUAL=1; single-size responsive cases) | all pass |
| Visual snapshots (`npm run test:visual`) | 7 | pass locally |
| Architecture guard | 1 script, 9 rules | pass |

New specs: `history`, `persistence`, `responsive`, `lifecycle`, `a11y`, `dod`, `visual`, plus the
unit tests for schema, adapter, sync, history, store, licensing and extensibility. The per-test
timeout rose to 60 s, because long draw/reload flows at 2560 px on software WebGL exceeded 30 s.

## 8. Deferred and known limitations

- **Satellite licence for production:** open decision (docs/ATTRIBUTION.md).
- **Visual snapshots are not run in CI:** baselines depend on the browser build and system
  fonts. To gate them in CI, generate and compare inside the pinned Playwright Docker image.
- **Undo history is per session:** a reload starts empty, as intended. Opacity changes are not
  recorded.
- **Two open tabs:** they share storage and the last writer wins. There is no cross-tab sync
  (BroadcastChannel would be a small Stage 1+ item).
- **Unload timing:** IndexedDB writes during `pagehide` are best-effort. Saves are debounced to
  250 ms, so at most the last quarter-second of edits can be lost on a hard close.
- **No inspector tool and no editing of existing shapes:** both are outside the DoD and listed
  in the roadmap.
- **Mixed Hebrew/English map labels:** these rely on MapLibre's built-in bidi; they were checked
  visually, not through every combination.

## 9. Where I disagree or qualify

1. **Status bar (point 2).** Done as asked and as the spec says. The owner had explicitly asked
   for the floating version earlier. The real problem was covering the attribution, so the
   owner should confirm that the fixed row is what he wants now. If not, a floating readout
   placed away from the attribution corner is a small change.
2. **IndexedDB for geometry (point 9).** For Stage 0 volumes, localStorage would have been
   enough. IndexedDB is the right base for Stage 1 data (rasters, larger GeoJSON), so I
   implemented it behind the adapter, with a localStorage fallback.
3. **Visual regression in CI (point 15).** Comparing screenshots across machines produces false
   failures, so the baselines are local-only until a pinned Docker image is used.
4. **`?debug` hook (point 28).** I kept it in production. It has no UI and is opt-in by URL. It
   allows nothing that devtools do not, and it is how the live site is checked without touching
   the owner's data. Removing it is a one-line change if preferred.
5. **DoD 3 (rails).** I did not add placeholder rail buttons just to satisfy the check in
   production; the owner chose to keep built-ins off the map edges.
