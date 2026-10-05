import type { MapTheme, MapViewState, ScaleUnit } from '../map/types';
import { emptyDock, sanitizeDock, type DockState } from '../layout/dockPlanner';
import { LAYER_TYPES, type WorkspaceLayer } from '../layers/layerTypes';

export const STORAGE_KEY = 'gws:workspace:v1';
export const SCHEMA_VERSION = 1;

export type Language = 'he' | 'en';
export type CoordFormat = 'decimal' | 'dms';

export interface Settings {
  language: Language;
  units: ScaleUnit;
  coordFormat: CoordFormat;
}

export interface PersistedWorkspace {
  version: typeof SCHEMA_VERSION;
  view: MapViewState | null;
  basemapId: string;
  mapTheme: MapTheme;
  settings: Settings;
  dock: DockState;
  /** Only layers with persist: 'local'. Session layers live in sessionStorage. */
  layers: StoredLayers;
}

export interface StoredLayers {
  items: Record<string, WorkspaceLayer>;
  /** Bottom → top. */
  order: string[];
}

export const SESSION_LAYERS_KEY = 'gws:session-layers:v1';
const emptyLayers = (): StoredLayers => ({ items: {}, order: [] });

/** Storage can throw (private mode, full quota, blocked site data); never let it break the app. */
export function safeStorage(kind: 'local' | 'session' = 'local'): Storage | null {
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

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function parseView(v: unknown): MapViewState | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const c = o.center;
  if (!Array.isArray(c) || c.length !== 2 || !isNum(c[0]) || !isNum(c[1])) return null;
  if (!isNum(o.zoom) || !isNum(o.bearing) || !isNum(o.pitch)) return null;
  if (Math.abs(c[1]) > 90) return null;
  return { center: [c[0], c[1]], zoom: o.zoom, bearing: o.bearing, pitch: o.pitch };
}

function pick<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(v as T) ? (v as T) : fallback;
}

export const DEFAULT_SETTINGS: Settings = { language: 'he', units: 'metric', coordFormat: 'decimal' };

/**
 * Validates whatever is in storage. Anything malformed falls back to defaults field by field,
 * so one bad value never throws away the whole workspace.
 */
export function parseWorkspace(raw: string | null, defaultBasemapId: string): PersistedWorkspace {
  const empty: PersistedWorkspace = {
    version: SCHEMA_VERSION,
    view: null,
    basemapId: defaultBasemapId,
    mapTheme: 'light',
    settings: { ...DEFAULT_SETTINGS },
    dock: emptyDock(),
    layers: emptyLayers(),
  };
  if (!raw) return empty;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return empty;
  }
  if (!data || typeof data !== 'object') return empty;
  const o = migrate(data as Record<string, unknown>);
  const s = (o.settings ?? {}) as Record<string, unknown>;
  return {
    version: SCHEMA_VERSION,
    view: parseView(o.view),
    basemapId: typeof o.basemapId === 'string' ? o.basemapId : defaultBasemapId,
    mapTheme: pick(o.mapTheme, ['light', 'dark'] as const, 'light'),
    settings: {
      language: pick(s.language, ['he', 'en'] as const, DEFAULT_SETTINGS.language),
      units: pick(s.units, ['metric', 'nautical', 'imperial'] as const, DEFAULT_SETTINGS.units),
      coordFormat: pick(s.coordFormat, ['decimal', 'dms'] as const, DEFAULT_SETTINGS.coordFormat),
    },
    // Structure only here; unknown tool ids are pruned once tools are registered.
    dock: sanitizeDock(o.dock, null),
    layers: parseLayers(o.layers),
  };
}

/** Validates stored layers one by one; a malformed layer is dropped, the rest survive. */
export function parseLayers(raw: unknown): StoredLayers {
  const out = emptyLayers();
  if (!raw || typeof raw !== 'object') return out;
  const o = raw as { items?: unknown; order?: unknown };
  const items = (o.items && typeof o.items === 'object' ? o.items : {}) as Record<string, unknown>;
  for (const [id, v] of Object.entries(items)) {
    const layer = parseLayer(id, v);
    if (layer) out.items[id] = layer;
  }
  const order = Array.isArray(o.order) ? o.order.filter((id): id is string => typeof id === 'string' && id in out.items) : [];
  // Layers missing from the order go on top, so nothing is silently lost.
  out.order = [...new Set(order), ...Object.keys(out.items).filter((id) => !order.includes(id))];
  return out;
}

function parseLayer(id: string, v: unknown): WorkspaceLayer | null {
  if (!v || typeof v !== 'object') return null;
  const l = v as Record<string, unknown>;
  if (typeof l.name !== 'string' || !LAYER_TYPES.includes(l.type as never)) return null;
  return {
    id,
    name: l.name,
    type: l.type as WorkspaceLayer['type'],
    visible: l.visible !== false,
    opacity: isNum(l.opacity) ? Math.min(1, Math.max(0, l.opacity)) : 1,
    group: typeof l.group === 'string' ? l.group : undefined,
    removable: l.removable !== false,
    source: l.source,
    mapLayers: Array.isArray(l.mapLayers) ? (l.mapLayers as WorkspaceLayer['mapLayers']) : [],
    ownerToolId: typeof l.ownerToolId === 'string' ? l.ownerToolId : undefined,
    persist: pick(l.persist, ['local', 'session', 'none'] as const, 'local'),
  };
}

export function loadSessionLayers(): StoredLayers {
  try {
    const raw = safeStorage('session')?.getItem(SESSION_LAYERS_KEY);
    return raw ? parseLayers(JSON.parse(raw)) : emptyLayers();
  } catch {
    return emptyLayers();
  }
}

export function saveSessionLayers(layers: StoredLayers): void {
  try {
    const s = safeStorage('session');
    if (!s) return;
    if (layers.order.length === 0) s.removeItem(SESSION_LAYERS_KEY);
    else s.setItem(SESSION_LAYERS_KEY, JSON.stringify(layers));
  } catch {
    /* quota */
  }
}

/** Upgrades older stored shapes. Future schema versions add steps here. */
function migrate(data: Record<string, unknown>): Record<string, unknown> {
  // Before the satellite basemap, light and dark were two separate basemap ids.
  if (data.basemapId === 'light' || data.basemapId === 'dark') {
    return { ...data, mapTheme: data.basemapId, basemapId: 'map' };
  }
  return data;
}

export function loadWorkspace(defaultBasemapId: string): PersistedWorkspace {
  let raw: string | null = null;
  try {
    raw = safeStorage('local')?.getItem(STORAGE_KEY) ?? null;
  } catch {
    raw = null;
  }
  return parseWorkspace(raw, defaultBasemapId);
}

export function saveWorkspace(ws: PersistedWorkspace): void {
  try {
    safeStorage('local')?.setItem(STORAGE_KEY, JSON.stringify(ws));
  } catch {
    // Quota or privacy mode: the workspace keeps working, it just will not survive a refresh.
  }
}

export function clearWorkspace(): void {
  try {
    safeStorage('session')?.removeItem(SESSION_LAYERS_KEY);
    safeStorage('local')?.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
