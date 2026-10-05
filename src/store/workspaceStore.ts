import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { DEFAULT_BASEMAP_ID } from '../map/basemaps.config';
import type { MapTheme, MapViewState } from '../map/types';
import * as dock from '../layout/dockPlanner';
import type { DockSide, DockState } from '../layout/dockPlanner';
import { toolRegistry } from '../tools/ToolRegistry';
import {
  DEFAULT_SETTINGS,
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
}

const sideOf = (panelId: string): DockSide => toolRegistry.get(panelId)?.defaultDock ?? 'left';

export function createWorkspaceStore(initial: PersistedWorkspace) {
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
        }),
    })),
  );
}

export const useWorkspace = createWorkspaceStore(loadWorkspace(DEFAULT_BASEMAP_ID));

export function toPersisted(s: WorkspaceState): PersistedWorkspace {
  return {
    version: SCHEMA_VERSION,
    view: s.view,
    basemapId: s.basemapId,
    mapTheme: s.mapTheme,
    settings: s.settings,
    dock: s.dock,
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
): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const flush = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    write(toPersisted(store.getState()));
  };
  const unsub = store.subscribe(
    (s) => [s.view, s.basemapId, s.mapTheme, s.settings, s.dock] as const,
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
