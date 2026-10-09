import type { GeometryDoc, InitialState, Prefs, StoredLayers } from './schema';

/** Where the user's geometry is actually kept in this browser. Shown in Settings. */
export type GeometryBackend = 'indexeddb' | 'localStorage' | 'memory';

/**
 * The only door to storage. Components and the store never touch localStorage, sessionStorage or
 * IndexedDB; they go through this interface (enforced by scripts/check-boundaries.mjs).
 *
 * Everything is local to this browser profile. Nothing is synced anywhere.
 */
export interface PersistenceAdapter {
  readonly geometryBackend: GeometryBackend;
  /** Reads, validates and migrates everything. Never throws: bad data falls back to defaults. */
  load(defaultBasemapId: string): Promise<InitialState>;
  savePrefs(prefs: Prefs): void;
  saveGeometry(doc: GeometryDoc): Promise<void>;
  saveSession(layers: StoredLayers): void;
  /** Small key/value store namespaced per tool (ToolContext.storage). */
  toolStorage(toolId: string): {
    get<T>(key: string): T | null;
    set(key: string, value: unknown): void;
    remove(key: string): void;
  };
}
