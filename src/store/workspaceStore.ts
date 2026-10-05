import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { DEFAULT_BASEMAP_ID } from '../map/basemaps.config';
import type { MapViewState } from '../map/types';
import {
  loadWorkspace,
  saveWorkspace,
  SCHEMA_VERSION,
  type PersistedWorkspace,
  type Settings,
} from './persistence';

export interface WorkspaceState {
  view: MapViewState | null;
  basemapId: string;
  settings: Settings;
  setView: (view: MapViewState) => void;
  setBasemap: (id: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
}

export function createWorkspaceStore(initial: PersistedWorkspace) {
  return create<WorkspaceState>()(
    subscribeWithSelector((set) => ({
      view: initial.view,
      basemapId: initial.basemapId,
      settings: initial.settings,
      setView: (view) => set({ view }),
      setBasemap: (basemapId) => set({ basemapId }),
      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
    })),
  );
}

export const useWorkspace = createWorkspaceStore(loadWorkspace(DEFAULT_BASEMAP_ID));

export function toPersisted(s: WorkspaceState): PersistedWorkspace {
  return { version: SCHEMA_VERSION, view: s.view, basemapId: s.basemapId, settings: s.settings };
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
    (s) => [s.view, s.basemapId, s.settings] as const,
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
