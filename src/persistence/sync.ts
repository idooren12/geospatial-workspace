import type { WorkspaceLayer } from '../layers/layerTypes';
import type { WorkspaceState } from '../store/workspaceStore';
import type { PersistenceAdapter } from './adapter';
import { SCHEMA_VERSION, type GeometryDoc, type Prefs, type StoredLayers } from './schema';

type Store = {
  getState(): WorkspaceState;
  subscribe: <U>(
    selector: (s: WorkspaceState) => U,
    listener: (u: U) => void,
    opts?: { equalityFn?: (a: U, b: U) => boolean },
  ) => () => void;
};

/** Splits layers by where they are kept. */
export function layersBy(s: Pick<WorkspaceState, 'layers' | 'layerOrder'>, persist: WorkspaceLayer['persist']): StoredLayers {
  const order = s.layerOrder.filter((id) => s.layers[id]?.persist === persist);
  return { items: Object.fromEntries(order.map((id) => [id, s.layers[id]!])), order };
}

export function toPrefs(s: WorkspaceState): Prefs {
  return { version: SCHEMA_VERSION, view: s.view, basemapId: s.basemapId, mapTheme: s.mapTheme, settings: s.settings, dock: s.dock };
}

export function toGeometry(s: WorkspaceState): GeometryDoc {
  return { version: SCHEMA_VERSION, layers: layersBy(s, 'local'), measurements: s.measurements };
}

const sameItems = <T extends readonly unknown[]>(a: T, b: T) => a.every((v, i) => v === b[i]);

/**
 * Auto-save: every change to prefs or to saved geometry is written after a short debounce, so
 * camera moves and bursts of edits coalesce into one write. Geometry writes are serialised (the
 * latest wins). Pending writes are flushed when the page is hidden.
 */
export function startPersistence(store: Store, adapter: PersistenceAdapter, delayMs = 250): () => void {
  let prefsTimer: ReturnType<typeof setTimeout> | null = null;
  let geoTimer: ReturnType<typeof setTimeout> | null = null;
  let writing: Promise<void> = Promise.resolve();

  const flushPrefs = () => {
    if (prefsTimer) clearTimeout(prefsTimer);
    prefsTimer = null;
    adapter.savePrefs(toPrefs(store.getState()));
  };
  const flushGeometry = () => {
    if (geoTimer) clearTimeout(geoTimer);
    geoTimer = null;
    const s = store.getState();
    const doc = toGeometry(s);
    adapter.saveSession(layersBy(s, 'session'));
    writing = writing
      .then(() => adapter.saveGeometry(doc))
      .catch((e) => console.warn('[gws] could not save geometry', e));
  };

  const offPrefs = store.subscribe(
    (s) => [s.view, s.basemapId, s.mapTheme, s.settings, s.dock] as const,
    () => {
      if (prefsTimer) clearTimeout(prefsTimer);
      prefsTimer = setTimeout(flushPrefs, delayMs);
    },
    { equalityFn: sameItems },
  );
  const offGeometry = store.subscribe(
    (s) => [s.layers, s.layerOrder, s.measurements] as const,
    () => {
      if (geoTimer) clearTimeout(geoTimer);
      geoTimer = setTimeout(flushGeometry, delayMs);
    },
    { equalityFn: sameItems },
  );

  const flushAll = () => {
    if (prefsTimer) flushPrefs();
    if (geoTimer) flushGeometry();
  };
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') flushAll();
  };
  window.addEventListener('pagehide', flushAll);
  document.addEventListener('visibilitychange', onVisibility);
  return () => {
    offPrefs();
    offGeometry();
    window.removeEventListener('pagehide', flushAll);
    document.removeEventListener('visibilitychange', onVisibility);
    flushAll();
  };
}
