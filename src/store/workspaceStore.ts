import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { DEFAULT_BASEMAP_ID } from '../map/basemaps.config';
import type { MapTheme, MapViewState } from '../map/types';
import * as dock from '../layout/dockPlanner';
import type { DockSide, DockState } from '../layout/dockPlanner';
import { toolRegistry } from '../tools/ToolRegistry';
import type { NewWorkspaceLayer, WorkspaceLayer } from '../layers/layerTypes';
import { measure, type MeasurementKind, type SavedMeasurement } from '../utilities/measure/types';
import { DEFAULT_SETTINGS, defaultInitialState, type InitialState, type Settings } from '../persistence/schema';

export interface WorkspaceState {
  view: MapViewState | null;
  basemapId: string;
  mapTheme: MapTheme;
  settings: Settings;
  setView: (view: MapViewState) => void;
  setBasemap: (id: string) => void;
  setMapTheme: (theme: MapTheme) => void;
  updateSettings: (patch: Partial<Settings>) => void;

  // Dock (spec §5). All layout decisions are made by the pure dockPlanner.
  dock: DockState;
  /** Width of the workspace body (map + docks); not persisted. */
  bodyWidth: number;
  setBodyWidth: (width: number) => void;
  togglePanel: (panelId: string) => void;
  openPanel: (panelId: string, side?: DockSide) => void;
  closePanel: (panelId: string) => void;
  activatePanel: (panelId: string) => void;
  resizeColumn: (columnId: string, width: number) => void;
  movePanelToOtherSide: (panelId: string) => void;
  splitPanel: (panelId: string) => void;
  setMapOnly: (on: boolean) => void;
  /** Drops panels whose tools are not registered (stale storage). */
  pruneDock: (known: ReadonlySet<string>) => void;
  resetWorkspace: () => void;
  /** Replaces persisted state with what storage loaded (once, at startup). */
  hydrate: (initial: InitialState) => void;

  // Workspace layers (spec §7). Synced to the map by the LayerManager.
  layers: Record<string, WorkspaceLayer>;
  /** Bottom → top. */
  layerOrder: string[];
  /** Adds on top; returns the id. */
  addLayer: (layer: NewWorkspaceLayer) => string;
  updateLayer: (id: string, patch: Partial<Omit<WorkspaceLayer, 'id'>>) => void;
  /** Respects `removable` unless forced (a tool removing its own layer). */
  removeLayer: (id: string, opts?: { force?: boolean }) => void;
  setLayerVisible: (id: string, visible: boolean) => void;
  setLayerOpacity: (id: string, opacity: number) => void;
  renameLayer: (id: string, name: string) => void;
  /** Moves a layer to an index of `layerOrder` (0 = bottom). */
  moveLayer: (id: string, toIndex: number) => void;
  /** Puts back a removed layer at its old stack position (undo). */
  restoreLayer: (layer: WorkspaceLayer, index: number) => void;

  // Saved measurements (their own list, not layers).
  measurements: SavedMeasurement[];
  saveMeasurement: (m: { name: string; kind: MeasurementKind; vertices: [number, number][] }) => string;
  updateMeasurement: (id: string, patch: Partial<Pick<SavedMeasurement, 'name' | 'visible'>>) => void;
  removeMeasurement: (id: string) => void;
  /** Puts back a removed measurement at its old list position (undo / redo). */
  restoreMeasurement: (m: SavedMeasurement, index: number) => void;

  /** The item selected in a panel or on the map; highlighted on the map. UI state. */
  selection: Selection | null;
  select: (sel: Selection | null) => void;

  /** Layer new drawings go into (UI state, not persisted). */
  drawTargetId: string | null;
  setDrawTarget: (id: string | null) => void;

  /**
   * "Show me this": a click on a map feature asks its panel to reveal the item. `seq` changes on
   * every request so the same item can be revealed twice. It clears itself after a moment, so a
   * panel opened by the click still sees it on mount, but a panel opened later does not.
   * UI state, not persisted.
   */
  focus: { kind: 'layer' | 'measurement'; id: string; featureId?: string; seq: number } | null;
  reveal: (kind: 'layer' | 'measurement', id: string, featureId?: string) => void;
}

export type Selection =
  | { kind: 'layer'; layerId: string }
  | { kind: 'feature'; layerId: string; featureId: string }
  | { kind: 'measurement'; id: string };

let measureSeq = 0;
let focusSeq = 0;
/** How long a reveal request stays live (covers the panel mounting and the 1.6 s flash). */
const FOCUS_MS = 2000;

let layerSeq = 0;
const newLayerId = () => `L${Date.now().toString(36)}${(layerSeq++).toString(36)}`;

const sideOf = (panelId: string): DockSide => toolRegistry.get(panelId)?.defaultDock ?? 'left';

function persistedSlice(initial: InitialState) {
  const { prefs, geometry, session } = initial;
  return {
    view: prefs.view,
    basemapId: prefs.basemapId,
    mapTheme: prefs.mapTheme,
    settings: prefs.settings,
    dock: prefs.dock,
    measurements: geometry.measurements,
    layers: { ...geometry.layers.items, ...session.items },
    layerOrder: [...geometry.layers.order, ...session.order.filter((id) => !(id in geometry.layers.items))],
  };
}

/** The store holds state only; it never reads or writes storage (see src/persistence). */
export function createWorkspaceStore(initial: InitialState = defaultInitialState(DEFAULT_BASEMAP_ID)) {
  return create<WorkspaceState>()(
    subscribeWithSelector((set, get) => ({
      ...persistedSlice(initial),
      setView: (view) => set({ view }),
      setBasemap: (basemapId) => set({ basemapId }),
      setMapTheme: (mapTheme) => set({ mapTheme }),
      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      bodyWidth: typeof window !== 'undefined' ? window.innerWidth : 1366,
      setBodyWidth: (bodyWidth) => {
        if (bodyWidth === get().bodyWidth) return;
        set({ bodyWidth, dock: dock.reflow(get().dock, bodyWidth) });
      },
      togglePanel: (id) => set((s) => ({ dock: dock.togglePanel(s.dock, id, sideOf(id), s.bodyWidth) })),
      openPanel: (id, side) => set((s) => ({ dock: dock.openPanel(s.dock, id, side ?? sideOf(id), s.bodyWidth) })),
      // Closing frees width: tab groups may split back into side-by-side columns.
      closePanel: (id) => set((s) => ({ dock: dock.reflow(dock.closePanel(s.dock, id), s.bodyWidth) })),
      activatePanel: (id) => set((s) => ({ dock: dock.activatePanel(s.dock, id) })),
      resizeColumn: (colId, width) => set((s) => ({ dock: dock.resizeColumn(s.dock, colId, width, s.bodyWidth) })),
      movePanelToOtherSide: (id) => set((s) => ({ dock: dock.movePanelToOtherSide(s.dock, id, s.bodyWidth) })),
      splitPanel: (id) => set((s) => ({ dock: dock.splitPanelToColumn(s.dock, id, s.bodyWidth) })),
      setMapOnly: (on) => set((s) => ({ dock: dock.setMapOnly(s.dock, on) })),
      pruneDock: (known) =>
        set((s) => ({ dock: dock.reflow(dock.sanitizeDock(s.dock, known), s.bodyWidth) })),
      resetWorkspace: () =>
        set({
          view: null,
          basemapId: DEFAULT_BASEMAP_ID,
          mapTheme: 'light',
          settings: { ...DEFAULT_SETTINGS },
          dock: dock.emptyDock(),
          layers: {},
          layerOrder: [],
          measurements: [],
          drawTargetId: null,
          focus: null,
          selection: null,
        }),
      hydrate: (initial) => set({ ...persistedSlice(initial), selection: null, focus: null }),

      saveMeasurement: ({ name, kind, vertices }) => {
        const id = `M${Date.now().toString(36)}${(measureSeq++).toString(36)}`;
        const now = Date.now();
        const item: SavedMeasurement = { id, name: name.trim() || id, kind, ...measure(kind, vertices), visible: true, createdAt: now, updatedAt: now };
        set((s) => ({ measurements: [...s.measurements, item] }));
        return id;
      },
      updateMeasurement: (id, patch) =>
        set((s) => ({
          measurements: s.measurements.map((m) =>
            m.id !== id
              ? m
              : { ...m, ...patch, name: patch.name !== undefined ? patch.name.trim() || m.name : m.name, updatedAt: Date.now() },
          ),
        })),
      removeMeasurement: (id) =>
        set((s) => ({
          measurements: s.measurements.filter((m) => m.id !== id),
          selection: s.selection?.kind === 'measurement' && s.selection.id === id ? null : s.selection,
        })),
      restoreMeasurement: (m, index) =>
        set((s) => {
          if (s.measurements.some((x) => x.id === m.id)) return {};
          const list = [...s.measurements];
          list.splice(Math.max(0, Math.min(list.length, index)), 0, m);
          return { measurements: list };
        }),

      selection: null,
      select: (selection) => set({ selection }),

      drawTargetId: null,
      setDrawTarget: (drawTargetId) => set({ drawTargetId }),

      focus: null,
      reveal: (kind, id, featureId) => {
        const seq = ++focusSeq;
        set({ focus: { kind, id, seq, ...(featureId ? { featureId } : {}) } });
        setTimeout(() => {
          if (get().focus?.seq === seq) set({ focus: null });
        }, FOCUS_MS);
      },

      addLayer: (input) => {
        const id = input.id && !get().layers[input.id] ? input.id : newLayerId();
        const layer: WorkspaceLayer = {
          visible: true,
          opacity: 1,
          removable: true,
          mapLayers: [],
          persist: 'local',
          ...input,
          id,
          name: input.name.trim() || id,
        };
        set((s) => ({ layers: { ...s.layers, [id]: layer }, layerOrder: [...s.layerOrder, id] }));
        return id;
      },
      updateLayer: (id, patch) =>
        set((s) => {
          const cur = s.layers[id];
          return cur ? { layers: { ...s.layers, [id]: { ...cur, ...patch, id } } } : {};
        }),
      removeLayer: (id, opts) =>
        set((s) => {
          const cur = s.layers[id];
          if (!cur || (!cur.removable && !opts?.force)) return {};
          const { [id]: _gone, ...rest } = s.layers;
          const selected = s.selection && s.selection.kind !== 'measurement' && s.selection.layerId === id;
          return {
            layers: rest,
            layerOrder: s.layerOrder.filter((x) => x !== id),
            drawTargetId: s.drawTargetId === id ? null : s.drawTargetId,
            selection: selected ? null : s.selection,
          };
        }),
      restoreLayer: (layer, index) =>
        set((s) => {
          if (s.layers[layer.id]) return {};
          const order = [...s.layerOrder];
          order.splice(Math.max(0, Math.min(order.length, index)), 0, layer.id);
          return { layers: { ...s.layers, [layer.id]: layer }, layerOrder: order };
        }),
      setLayerVisible: (id, visible) => get().updateLayer(id, { visible }),
      setLayerOpacity: (id, opacity) => get().updateLayer(id, { opacity: Math.min(1, Math.max(0, opacity)) }),
      renameLayer: (id, name) => {
        const n = name.trim();
        if (n) get().updateLayer(id, { name: n });
      },
      moveLayer: (id, toIndex) =>
        set((s) => {
          const from = s.layerOrder.indexOf(id);
          if (from < 0) return {};
          const order = s.layerOrder.filter((x) => x !== id);
          order.splice(Math.max(0, Math.min(order.length, toIndex)), 0, id);
          return { layerOrder: order };
        }),
    })),
  );
}

/** The page's store. Starts from defaults; main.tsx hydrates it from storage before rendering. */
export const useWorkspace = createWorkspaceStore();
