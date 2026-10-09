import type { GeometryBackend, PersistenceAdapter } from './adapter';
import { openDocStore, type DocStore } from './idb';
import {
  emptyGeometry,
  emptyLayers,
  migrateV1,
  parseLayers,
  SCHEMA_VERSION,
  upgradeGeometry,
  upgradePrefs,
  type GeometryDoc,
  type InitialState,
  type Prefs,
  type StoredLayers,
} from './schema';

/** UI preferences and layout (small, synchronous to read at startup). */
export const PREFS_KEY = 'gws:workspace:v2';
/** Version 1: one document with everything; migrated on first load and then removed. */
export const LEGACY_V1_KEY = 'gws:workspace:v1';
/** Geometry fallback when IndexedDB is unavailable (private modes, blocked storage). */
export const GEOMETRY_FALLBACK_KEY = 'gws:geometry:v2';
/** Unreadable data is moved here instead of being silently overwritten. */
export const CORRUPT_KEY = 'gws:corrupt';
export const SESSION_LAYERS_KEY = 'gws:session-layers:v1';
const GEOMETRY_DOC = 'geometry';

/** Storage can throw (private mode, quota, blocked site data); never let it break the app. */
function webStorage(kind: 'local' | 'session'): Storage | null {
  try {
    const s = kind === 'local' ? window.localStorage : window.sessionStorage;
    const probe = '__gws_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

function readJson(s: Storage | null, key: string): { value: unknown; corrupt: boolean } {
  const raw = s?.getItem(key);
  if (raw == null) return { value: undefined, corrupt: false };
  try {
    return { value: JSON.parse(raw), corrupt: false };
  } catch {
    try {
      s?.setItem(`${CORRUPT_KEY}:${key}`, raw);
    } catch {
      /* quota */
    }
    console.warn(`[gws] ${key} was unreadable; kept a copy under ${CORRUPT_KEY}:${key} and started from defaults`);
    return { value: undefined, corrupt: true };
  }
}

function writeJson(s: Storage | null, key: string, value: unknown): void {
  try {
    s?.setItem(key, JSON.stringify(value));
  } catch {
    /* quota or privacy mode: the workspace keeps working, it just won't survive a reload */
  }
}

/**
 * Production adapter: prefs in localStorage, geometry in IndexedDB (falling back to localStorage
 * when IndexedDB cannot be opened), session layers in sessionStorage.
 */
export class BrowserPersistenceAdapter implements PersistenceAdapter {
  geometryBackend: GeometryBackend = 'indexeddb';
  private docs: DocStore | null = null;
  private readonly openDocs: () => Promise<DocStore>;

  constructor(openDocs: () => Promise<DocStore> = () => openDocStore()) {
    this.openDocs = openDocs;
  }

  async load(defaultBasemapId: string): Promise<InitialState> {
    const local = webStorage('local');
    try {
      this.docs = await this.openDocs();
      this.geometryBackend = 'indexeddb';
    } catch (e) {
      console.warn('[gws] IndexedDB unavailable, keeping geometry in localStorage', e);
      this.docs = null;
      this.geometryBackend = local ? 'localStorage' : 'memory';
    }

    const session = this.loadSession();
    const v2 = readJson(local, PREFS_KEY);
    if (v2.value !== undefined || v2.corrupt) {
      const prefs = upgradePrefs(v2.value, defaultBasemapId);
      const geometry = upgradeGeometry(await this.readGeometry());
      // A v1 document left behind by an interrupted migration is obsolete now.
      if (local?.getItem(LEGACY_V1_KEY) != null && (await this.hasGeometry())) local.removeItem(LEGACY_V1_KEY);
      return { prefs, geometry, session };
    }

    const v1 = readJson(local, LEGACY_V1_KEY);
    if (v1.value !== undefined) {
      const { prefs, geometry } = migrateV1(v1.value, defaultBasemapId);
      try {
        await this.saveGeometry(geometry);
        writeJson(local, PREFS_KEY, prefs);
        local?.removeItem(LEGACY_V1_KEY); // only once both halves are safely written
      } catch (e) {
        console.warn('[gws] migration to v2 could not be written yet; will retry next load', e);
      }
      return { prefs, geometry, session };
    }

    return { prefs: upgradePrefs(undefined, defaultBasemapId), geometry: upgradeGeometry(await this.readGeometry()), session };
  }

  private async readGeometry(): Promise<unknown> {
    try {
      if (this.docs) return await this.docs.get(GEOMETRY_DOC);
    } catch (e) {
      console.warn('[gws] could not read geometry', e);
      return undefined;
    }
    return readJson(webStorage('local'), GEOMETRY_FALLBACK_KEY).value;
  }

  private async hasGeometry(): Promise<boolean> {
    return (await this.readGeometry()) !== undefined;
  }

  savePrefs(prefs: Prefs): void {
    writeJson(webStorage('local'), PREFS_KEY, prefs);
  }

  async saveGeometry(doc: GeometryDoc): Promise<void> {
    const plain = { ...doc, version: SCHEMA_VERSION };
    if (this.docs) {
      await this.docs.put(GEOMETRY_DOC, plain);
      return;
    }
    if (this.geometryBackend === 'localStorage') writeJson(webStorage('local'), GEOMETRY_FALLBACK_KEY, plain);
  }

  private loadSession(): StoredLayers {
    const { value } = readJson(webStorage('session'), SESSION_LAYERS_KEY);
    return value === undefined ? emptyLayers() : parseLayers(value);
  }

  saveSession(layers: StoredLayers): void {
    const s = webStorage('session');
    if (!s) return;
    if (layers.order.length === 0) s.removeItem(SESSION_LAYERS_KEY);
    else writeJson(s, SESSION_LAYERS_KEY, layers);
  }

  toolStorage(toolId: string) {
    const prefix = `gws:tool:${toolId}:`;
    return {
      get: <T>(key: string) => (readJson(webStorage('local'), prefix + key).value ?? null) as T | null,
      set: (key: string, value: unknown) => writeJson(webStorage('local'), prefix + key, value),
      remove: (key: string) => webStorage('local')?.removeItem(prefix + key),
    };
  }
}

/** In-memory adapter for tests and for environments with no storage at all. */
export class MemoryPersistenceAdapter implements PersistenceAdapter {
  readonly geometryBackend: GeometryBackend = 'memory';
  prefs: Prefs | null = null;
  geometry: GeometryDoc = emptyGeometry();
  session: StoredLayers = emptyLayers();
  readonly writes = { prefs: 0, geometry: 0, session: 0 };
  private readonly tool = new Map<string, unknown>();

  async load(defaultBasemapId: string): Promise<InitialState> {
    return {
      prefs: upgradePrefs(this.prefs ? structuredClone(this.prefs) : undefined, defaultBasemapId),
      geometry: upgradeGeometry(structuredClone(this.geometry)),
      session: parseLayers(structuredClone(this.session)),
    };
  }
  savePrefs(prefs: Prefs) {
    this.writes.prefs++;
    this.prefs = structuredClone(prefs);
  }
  async saveGeometry(doc: GeometryDoc) {
    this.writes.geometry++;
    this.geometry = structuredClone(doc); // also proves the doc is serializable
  }
  saveSession(layers: StoredLayers) {
    this.writes.session++;
    this.session = structuredClone(layers);
  }
  toolStorage(toolId: string) {
    return {
      get: <T>(key: string) => (this.tool.get(`${toolId}:${key}`) ?? null) as T | null,
      set: (key: string, value: unknown) => void this.tool.set(`${toolId}:${key}`, structuredClone(value)),
      remove: (key: string) => void this.tool.delete(`${toolId}:${key}`),
    };
  }
}
