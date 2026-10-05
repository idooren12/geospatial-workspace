import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { DEFAULT_BASEMAP_ID } from '../map/basemaps.config';
import type { MapTheme, MapViewState } from '../map/types';
import * as dock from '../layout/dockPlanner';
import type { DockSide, DockState } from '../layout/dockPlanner';
import { toolRegistry } from '../tools/ToolRegistry';
import type { NewWorkspaceLayer, WorkspaceLayer } from '../layers/layerTypes';
import {
  DEFAULT_SETTINGS,
  loadSessionLayers,
  saveSessionLayers,
  type StoredLayers,
  loadWorkspace,
  saveWorkspace,
  SCHEMA_VERSION,
  type PersistedWorkspace,
  type Settings,
} from './persistence';

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
}

let layerSeq = 0;
const newLayerId = () => `L${Date.now().toString(36)}${(layerSeq++).toString(36)}`;

const sideOf = (panelId: string): DockSide => toolRegistry.get(panelId)?.defaultDock ?? 'left';

export function createWorkspaceStore(initial: PersistedWorkspace, session: StoredLayers = { items: {}, order: [] }) {
  return create<WorkspaceState>()(
    subscribeWithSelector((set, get) => ({
      view: initial.view,
      basemapId: initial.basemapId,
      mapTheme: initial.mapTheme,
      settings: initial.settings,
      setView: (view) => set({ view }),
      setBasemap: (basemapId) => set({ basemapId }),
      setMapTheme: (mapTheme) => set({ mapTheme }),
      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      dock: initial.dock,
      bodyWidth: typeof window !== 'undefined' ? window.innerWidth : 1366,
      setBodyWidth: (bodyWidth) => {
        if (bodyWidth === get().bodyWidth) return;
        set({ bodyWidth, dock: dock.reflow(get().dock, bodyWidth) });
      },
      togglePanel: (id) => set((s) => ({ dock: dock.togglePanel(s.dock, id, sideOf(id), s.bodyWidth) })),
      openPanel: (id, side) => set((s) => ({ dock: dock.openPanel(s.dock, id, side ?? sideOf(id), s.bodyWidth) })),
      closePanel: (id) => set((s) => ({ dock: dock.closePanel(s.dock, id) })),
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
        }),

      layers: { ...initial.layers.items, ...session.items },
      layerOrder: [...initial.layers.order, ...session.order.filter((id) => !(id in initial.layers.items))],
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
          return { layers: rest, layerOrder: s.layerOrder.filter((x) => x !== id) };
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

export const useWorkspace = createWorkspaceStore(loadWorkspace(DEFAULT_BASEMAP_ID), loadSessionLayers());

/** Splits layers by where they are kept. */
function layersBy(s: WorkspaceState, persist: WorkspaceLayer['persist']): StoredLayers {
  const order = s.layerOrder.filter((id) => s.layers[id]?.persist === persist);
  return { items: Object.fromEntries(order.map((id) => [id, s.layers[id]!])), order };
}

export function toPersisted(s: WorkspaceState): PersistedWorkspace {
  return {
    version: SCHEMA_VERSION,
    view: s.view,
    basemapId: s.basemapId,
    mapTheme: s.mapTheme,
    settings: s.settings,
    dock: s.dock,
    layers: layersBy(s, 'local'),
  };
}

/**
 * Debounced persistence: frequent changes (camera moves, splitter drags) coalesce into one write.
 * Pending writes are flushed when the page is hidden so nothing is lost on refresh.
 */
export function startPersistence(
  store: typeof useWorkspace = useWorkspace,
  write: (ws: PersistedWorkspace) => void = saveWorkspace,
  delayMs = 300,
  writeSession: (layers: StoredLayers) => void = saveSessionLayers,
): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const flush = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    write(toPersisted(store.getState()));
    writeSession(layersBy(store.getState(), 'session'));
  };
  const unsub = store.subscribe(
    (s) => [s.view, s.basemapId, s.mapTheme, s.settings, s.dock, s.layers, s.layerOrder] as const,
    () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, delayMs);
    },
    { equalityFn: (a, b) => a.every((v, i) => v === b[i]) },
  );
  const onHide = () => {
    if (timer) flush();
  };
  window.addEventListener('pagehide', onHide);
  return () => {
    unsub();
    window.removeEventListener('pagehide', onHide);
    if (timer) flush();
  };
}
