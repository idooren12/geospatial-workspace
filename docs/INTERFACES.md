# Stage 0 public interfaces (frozen at `v0.1-stage0`)

These are the contracts Stage 1 tools build on. During Stage 1 they change only through a
decision entry in `docs/DECISIONS.md`, never as a side effect of tool work: no opportunistic Core
refactors. Additions that keep existing calls working (a new optional field, a new method) are
allowed with a decision entry. Breaking changes need owner sign-off.

Source of truth is the code; this page is the map of it. Each item links its file.

## 1. Tools — `src/tools/types.ts`, `src/tools/ToolRegistry.ts`

A tool is registered once and the workspace discovers it. Nothing else in the app names a tool.

```ts
toolRegistry.register(def: ToolDefinition)   // throws on duplicate id; devOnly tools skipped in prod
toolRegistry.get(id) / list() / ids() / subscribe(fn)

interface ToolDefinition {
  id: string;                    // stable; also used as ownerToolId on the tool's layers
  name: string; nameKey?: string;
  icon: ReactNode;
  defaultDock: 'left' | 'right'; // = inline-start / inline-end (mirrors in RTL)
  component: ComponentType<{ ctx: ToolContext }>;
  order?: number;                // rail order
  rail?: boolean;                // default true: a button on the map-edge rail
  devOnly?: boolean;
  layerDetails?: ComponentType<{ layer: WorkspaceLayer }>; // extra rows under its layers in the Layers panel
}
```

`ToolContext` is everything a tool may touch. There is no raw map and no store:

| Member | Contract |
| --- | --- |
| `toolId` | The tool's id |
| `map.flyTo / fitBounds / getView` | Camera only |
| `layers.add(layer) → id` | Adds on top; tags `ownerToolId`; defaults `visible: true`, `opacity: 1`, `removable: true`, `persist: 'local'` |
| `layers.update(id, patch)` | Any field but `id` |
| `layers.remove(id)` | Also removes non-removable layers the tool owns |
| `layers.own()` | The tool's layers, bottom → top |
| `dock.close / focus` | Its own panel |
| `storage.get / set / remove` | Small JSON values, namespaced per tool, local to this browser |

Rules:

- Closing a tool keeps its layers (spec §8).
- Each tool panel runs inside its own error boundary.
- Tools must not import `src/map` or `src/layout` (architecture guard).

## 2. Layers — `src/layers/layerTypes.ts`, `src/layers/LayerManager.ts`

```ts
interface WorkspaceLayer {
  id: string;                 // stable, independent of name ('L…'); MapLibre ids derive from it
  name: string;
  type: 'geojson' | 'vector' | 'raster' | 'custom';
  visible: boolean;
  opacity: number;            // 0..1, multiplied into each style's own opacity
  group?: string;
  removable: boolean;
  source?: unknown;           // a MapLibre source spec; 'custom' may carry anything (plain JSON)
  mapLayers: MapLayerStyle[]; // MapLibre layer specs without id/source; [] → type defaults
  ownerToolId?: string;
  persist: 'local' | 'session' | 'none';
  metadata?: LayerMetadata;   // plain JSON, provenance etc.; never interpreted by the layer system
}
```

- The store is the truth. `LayerManager.sync(layers, order)` diffs it into MapService. Ids:
  source `ws:<layerId>`, map layers `ws:<layerId>:<n>`, bottom → top as in `layerOrder`.
- User edits (rename, show/hide, reorder, delete) go through `layerCommands` so they land in
  undo/redo. Tools changing their own layers use `ToolContext.layers`, which is not a user edit.
- GeoJSON is WGS84 lon/lat (RFC 7946). Features that should be selectable and labelled carry
  `properties.fid` (stable id) and `properties.name`.

## 3. Map Core — `src/map/MapService.ts` (one instance: `mapService`)

Only `src/map` imports `maplibre-gl`, and Map Core imports nothing from the app. Workspace ids
(sources, layers, images) must start with `ws:`. Everything added through MapService is recorded
and restored after a basemap switch.

| Area | Methods |
| --- | --- |
| Lifecycle | `mount(el, MountOptions)` (idempotent; one MapLibre for the page), `whenMounted()`, `isMounted`, `instanceCount`, `scheduleResize()` (rAF-coalesced) |
| Events | `on(type, fn) → off`, `onStyleLoad(fn) → off`, `getLoadState()` / `onLoadState(fn)` (`loading` / `ready` / `error: style or tiles`) |
| Basemap | `setStyle(style, labelPaint?)`, `setLabelLanguage(lang)`, `setScaleUnit(unit)`, `setControlCorner(corner)` |
| Sources / layers | `addSource`, `setGeoJSONData`, `removeSource`, `addLayer(spec, beforeId?)` (idempotent), `addOverlayLayer(spec)` (always above workspace layers), `removeLayer`, `moveLayer`, `setLayerVisibility`, `setLayerOpacity`, `setPaintProperty`, `getLayerOrder()`, `addImage(id, rgba, options)` |
| Query / camera | `queryWorkspaceFeatures(point, pad?)`, `setCursor`, `fitBounds`, `flyTo`, `getView`, `getZoom` |
| UI slots | `getControlSlot('tools')` (portal target under the zoom control). The map's bottom edge belongs to scale + attribution. |
| Internal only | `internalMap()` (draw adapter inside `src/map`), `debugMap()` (`?debug` console), `setDoubleClickZoom` |

`BasemapManager` (`src/map/BasemapManager.ts`) turns a basemap id and theme into a style.
Basemaps are entries in `basemaps.config.ts`, the only place provider URLs may appear. Each entry
carries a `licence` record and a `placeholder` colour. `labelStyle.ts` provides the shared label
look (`labelLayout`, `LABEL_PAINT`, images `ws:label-bg`, `ws:label-bg-selected`).

## 4. Persistence — `src/persistence/`

The only code that touches storage (guard-enforced). Everything is local to this browser; nothing
is synced.

```ts
interface PersistenceAdapter {
  geometryBackend: 'indexeddb' | 'localStorage' | 'memory' | 'debug';
  load(defaultBasemapId): Promise<InitialState>; // validates + migrates; never throws
  savePrefs(prefs: Prefs): void;
  saveGeometry(doc: GeometryDoc): Promise<void>;
  saveSession(layers: StoredLayers): void;
  toolStorage(toolId): { get; set; remove };
}
```

| Document | Where | Shape (schema v2) |
| --- | --- | --- |
| Prefs | localStorage `gws:workspace:v2` | `{version, view, basemapId, mapTheme, settings{language, units, coordFormat}, dock}` |
| Geometry | IndexedDB `gws` / `docs` / `geometry` (fallback localStorage `gws:geometry:v2`) | `{version, layers{items, order}, measurements[]}` — layers with `persist: 'local'` |
| Session layers | sessionStorage `gws:session-layers:v1` | `{items, order}` |
| Tool storage | localStorage `gws:tool:<toolId>:<key>` | JSON |
| Debug session | sessionStorage `gws-debug:*` only | Same documents, isolated from all of the above |

- **Saved measurement:** `{id, name, kind: 'distance'|'area', geometry: LineString|Polygon,
  value, unit: 'm'|'m2', visible, createdAt, updatedAt}`. `value` is recomputed from geometry
  on load.
- **Auto-save:** `startPersistence(store, adapter)` writes 250 ms after the last change and
  flushes on pagehide / hidden.
- **Schema changes:** bump `SCHEMA_VERSION`, add an `upgrade…` step in `schema.ts`, and add a
  migration test. Never change the meaning of an existing field in place.

## 5. Undo / redo — `src/history/history.ts`

```ts
interface Command { label: string; undo(): void; redo(): void }
history.run(cmd, { toast? })  // apply + record
history.push(cmd, { toast? }) // record an already-applied change
history.undo() / redo() / clear() / subscribe(fn) / getState()
```

Session-only, 100 steps. A single-item delete passes `toast: true`, which shows an Undo button.
Deleting more than one item asks first (`confirmAction` in `src/ui/confirm.ts`). Stage 1 tools
record their own user edits the same way.

## 6. Shell and state

- **Dock:** `src/layout/dockPlanner.ts`. Pure functions decide by actual widths: a new panel gets
  a column whenever the map keeps ≥ 500 px; tabs are only the overflow. The store calls them; UI
  never computes layout.
- **Selection:** `store.selection`, `{kind: 'layer' | 'feature' | 'measurement', …}`; the map
  highlights it.
- **Reveal:** `store.reveal(kind, id, featureId?)` asks a panel to scroll to an item and flash it.
- **i18n:** every user-visible string is in `src/i18n/{he,en}.json`.
