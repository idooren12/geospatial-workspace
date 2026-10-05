import type { MapViewState, ScaleUnit } from '../map/types';

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
  settings: Settings;
}

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
    settings: { ...DEFAULT_SETTINGS },
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
    settings: {
      language: pick(s.language, ['he', 'en'] as const, DEFAULT_SETTINGS.language),
      units: pick(s.units, ['metric', 'nautical', 'imperial'] as const, DEFAULT_SETTINGS.units),
      coordFormat: pick(s.coordFormat, ['decimal', 'dms'] as const, DEFAULT_SETTINGS.coordFormat),
    },
  };
}

/** Upgrades older schema versions. Version 1 is the first; future versions add steps here. */
function migrate(data: Record<string, unknown>): Record<string, unknown> {
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
    safeStorage('local')?.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
