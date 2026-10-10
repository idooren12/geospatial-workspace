import type { GeometryBackend, PersistenceAdapter } from './adapter';
import {
  emptyLayers,
  parseLayers,
  SCHEMA_VERSION,
  upgradeGeometry,
  upgradePrefs,
  type GeometryDoc,
  type InitialState,
  type Prefs,
  type StoredLayers,
} from './schema';

/** Every key of a debug session starts with this; nothing else is ever read or written. */
export const DEBUG_PREFIX = 'gws-debug:';

/** True when the page was opened with `?debug`. */
export function isDebugSession(search: string = typeof window === 'undefined' ? '' : window.location.search): boolean {
  return new URLSearchParams(search).has('debug');
}

function session(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function read(key: string): unknown {
  try {
    const raw = session()?.getItem(DEBUG_PREFIX + key);
    return raw == null ? undefined : JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function write(key: string, value: unknown): void {
  try {
    session()?.setItem(DEBUG_PREFIX + key, JSON.stringify(value));
  } catch {
    /* quota */
  }
}

/**
 * Persistence for `?debug` sessions (M5.1): isolated and ephemeral. Starts from defaults, keeps
 * everything in this tab's sessionStorage under `gws-debug:` (survives a reload of the tab, gone
 * when the tab closes), and never reads or writes the user's real workspace (localStorage keys or
 * the IndexedDB database).
 */
export class DebugSessionAdapter implements PersistenceAdapter {
  readonly geometryBackend: GeometryBackend = 'debug';

  async load(defaultBasemapId: string): Promise<InitialState> {
    const session = read('session');
    return {
      prefs: upgradePrefs(read('prefs'), defaultBasemapId),
      geometry: upgradeGeometry(read('geometry')),
      session: session === undefined ? emptyLayers() : parseLayers(session),
    };
  }

  savePrefs(prefs: Prefs): void {
    write('prefs', prefs);
  }

  async saveGeometry(doc: GeometryDoc): Promise<void> {
    write('geometry', { ...doc, version: SCHEMA_VERSION });
  }

  saveSession(layers: StoredLayers): void {
    write('session', layers);
  }

  toolStorage(toolId: string) {
    const prefix = `tool:${toolId}:`;
    return {
      get: <T>(key: string) => (read(prefix + key) ?? null) as T | null,
      set: (key: string, value: unknown) => write(prefix + key, value),
      remove: (key: string) => session()?.removeItem(DEBUG_PREFIX + prefix + key),
    };
  }
}
