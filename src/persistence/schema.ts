/**
 * The persisted workspace schema (version 2), its validation and its migrations. Pure functions:
 * no storage access here (that is the adapter's job), so everything is unit-testable.
 *
 * Two documents:
 *  - Prefs     — UI preferences and layout, small, kept in localStorage.
 *  - Geometry  — the user's own data (workspace layers incl. drawing layers, saved measurements),
 *                kept in IndexedDB. GeoJSON, WGS84 lon/lat.
 */
import type { Feature, FeatureCollection, Geometry, Position } from 'geojson';
import { emptyDock, sanitizeDock, type DockState } from '../layout/dockPlanner';
import { LAYER_TYPES, type JsonValue, type LayerMetadata, type WorkspaceLayer } from '../layers/layerTypes';
import type { MapTheme, MapViewState, ScaleUnit } from '../map/types';
import { measure, minVertices, verticesOf, type SavedMeasurement } from '../utilities/measure/types';

export const SCHEMA_VERSION = 2;

export type Language = 'he' | 'en';
export type CoordFormat = 'decimal' | 'dms';

export interface Settings {
  language: Language;
  units: ScaleUnit;
  coordFormat: CoordFormat;
}

export const DEFAULT_SETTINGS: Settings = { language: 'he', units: 'metric', coordFormat: 'decimal' };

export interface StoredLayers {
  items: Record<string, WorkspaceLayer>;
  /** Bottom → top. */
  order: string[];
}

export interface Prefs {
  version: typeof SCHEMA_VERSION;
  view: MapViewState | null;
  basemapId: string;
  mapTheme: MapTheme;
  settings: Settings;
  dock: DockState;
}

export interface GeometryDoc {
  version: typeof SCHEMA_VERSION;
  /** Only layers with persist: 'local'. */
  layers: StoredLayers;
  measurements: SavedMeasurement[];
}

/** Everything the store starts from. */
export interface InitialState {
  prefs: Prefs;
  geometry: GeometryDoc;
  /** Layers with persist: 'session' (this tab only). */
  session: StoredLayers;
}

export const emptyLayers = (): StoredLayers => ({ items: {}, order: [] });

export function defaultPrefs(defaultBasemapId: string): Prefs {
  return {
    version: SCHEMA_VERSION,
    view: null,
    basemapId: defaultBasemapId,
    mapTheme: 'light',
    settings: { ...DEFAULT_SETTINGS },
    dock: emptyDock(),
  };
}

export const emptyGeometry = (): GeometryDoc => ({ version: SCHEMA_VERSION, layers: emptyLayers(), measurements: [] });

export function defaultInitialState(defaultBasemapId: string): InitialState {
  return { prefs: defaultPrefs(defaultBasemapId), geometry: emptyGeometry(), session: emptyLayers() };
}

// ------------------------------------------------------------------ helpers

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

function pick<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(v as T) ? (v as T) : fallback;
}

/** A WGS84 position: finite lon/lat, latitude within ±90. Longitude is not clamped (antimeridian). */
const isPosition = (p: unknown): p is Position =>
  Array.isArray(p) && p.length >= 2 && isNum(p[0]) && isNum(p[1]) && Math.abs(p[1]) <= 90;

/** Plain JSON (no functions, class instances, NaN, cycles via depth limit). */
export function isJsonValue(v: unknown, depth = 0): v is JsonValue {
  if (depth > 32) return false;
  if (v === null || typeof v === 'string' || typeof v === 'boolean') return true;
  if (typeof v === 'number') return Number.isFinite(v);
  if (Array.isArray(v)) return v.every((x) => isJsonValue(x, depth + 1));
  if (isObj(v) && Object.getPrototypeOf(v) === Object.prototype) {
    return Object.values(v).every((x) => x === undefined || isJsonValue(x, depth + 1));
  }
  return false;
}

// ------------------------------------------------------------------- prefs

export function parseView(v: unknown): MapViewState | null {
  if (!isObj(v)) return null;
  const c = v.center;
  if (!Array.isArray(c) || c.length !== 2 || !isNum(c[0]) || !isNum(c[1])) return null;
  if (!isNum(v.zoom) || !isNum(v.bearing) || !isNum(v.pitch)) return null;
  if (Math.abs(c[1]) > 90 || v.zoom < 0 || v.zoom > 24 || v.pitch < 0 || v.pitch > 85) return null;
  // Longitude may have wrapped many times after panning; bring it back to [-180, 180].
  const lng = ((((c[0] + 180) % 360) + 360) % 360) - 180;
  return { center: [lng, c[1]], zoom: v.zoom, bearing: v.bearing, pitch: v.pitch };
}

/** Validates prefs field by field: one bad value never throws the rest away. */
export function parsePrefs(raw: unknown, defaultBasemapId: string): Prefs {
  const d = defaultPrefs(defaultBasemapId);
  if (!isObj(raw)) return d;
  const s = isObj(raw.settings) ? raw.settings : {};
  return {
    version: SCHEMA_VERSION,
    view: parseView(raw.view),
    basemapId: typeof raw.basemapId === 'string' && raw.basemapId ? raw.basemapId : d.basemapId,
    mapTheme: pick(raw.mapTheme, ['light', 'dark'] as const, 'light'),
    settings: {
      language: pick(s.language, ['he', 'en'] as const, DEFAULT_SETTINGS.language),
      units: pick(s.units, ['metric', 'nautical', 'imperial'] as const, DEFAULT_SETTINGS.units),
      coordFormat: pick(s.coordFormat, ['decimal', 'dms'] as const, DEFAULT_SETTINGS.coordFormat),
    },
    // Structure only here; unknown tool ids are pruned once tools are registered.
    dock: sanitizeDock(raw.dock, null),
  };
}

// ---------------------------------------------------------------- geometry

/** Drops GeoJSON features whose geometry is not valid WGS84 coordinates; keeps the rest. */
export function sanitizeFeatureCollection(raw: unknown): FeatureCollection | null {
  if (!isObj(raw) || raw.type !== 'FeatureCollection' || !Array.isArray(raw.features)) return null;
  const features: Feature[] = [];
  for (const f of raw.features) {
    if (!isObj(f) || f.type !== 'Feature' || !validGeometry(f.geometry)) continue;
    const props = isObj(f.properties) && isJsonValue(f.properties) ? f.properties : {};
    features.push({ type: 'Feature', geometry: f.geometry, properties: props, ...(f.id !== undefined ? { id: f.id as string } : {}) });
  }
  return { type: 'FeatureCollection', features };
}

function validGeometry(g: unknown): g is Geometry {
  if (!isObj(g)) return false;
  const c = g.coordinates;
  const ring = (r: unknown) => Array.isArray(r) && r.every(isPosition);
  switch (g.type) {
    case 'Point':
      return isPosition(c);
    case 'MultiPoint':
    case 'LineString':
      return ring(c) && (g.type === 'MultiPoint' || (c as unknown[]).length >= 2);
    case 'MultiLineString':
    case 'Polygon':
      return Array.isArray(c) && c.length > 0 && c.every(ring);
    case 'MultiPolygon':
      return Array.isArray(c) && c.every((p) => Array.isArray(p) && p.every(ring));
    case 'GeometryCollection':
      return Array.isArray(g.geometries) && g.geometries.every(validGeometry);
    default:
      return false;
  }
}

function parseMetadata(v: unknown): LayerMetadata | undefined {
  if (!isObj(v) || !isJsonValue(v)) return undefined;
  return v as LayerMetadata;
}

/** A layer's source: must be plain JSON; inline GeoJSON is cleaned feature by feature. */
function parseSource(v: unknown): unknown {
  if (v === undefined) return undefined;
  if (!isJsonValue(v)) return undefined;
  if (isObj(v) && v.type === 'geojson' && isObj(v.data)) {
    const data = sanitizeFeatureCollection(v.data);
    return data ? { ...v, data } : undefined;
  }
  return v;
}

function parseLayer(id: string, v: unknown): WorkspaceLayer | null {
  if (!isObj(v)) return null;
  if (typeof v.name !== 'string' || !LAYER_TYPES.includes(v.type as never)) return null;
  const layer: WorkspaceLayer = {
    id,
    name: v.name,
    type: v.type as WorkspaceLayer['type'],
    visible: v.visible !== false,
    opacity: isNum(v.opacity) ? Math.min(1, Math.max(0, v.opacity)) : 1,
    removable: v.removable !== false,
    mapLayers: Array.isArray(v.mapLayers) && isJsonValue(v.mapLayers) ? (v.mapLayers as WorkspaceLayer['mapLayers']) : [],
    persist: pick(v.persist, ['local', 'session', 'none'] as const, 'local'),
  };
  if (typeof v.group === 'string') layer.group = v.group;
  if (typeof v.ownerToolId === 'string') layer.ownerToolId = v.ownerToolId;
  const source = parseSource(v.source);
  if (source !== undefined) layer.source = source;
  const metadata = parseMetadata(v.metadata);
  if (metadata) layer.metadata = metadata;
  return layer;
}

/** Validates stored layers one by one; a malformed layer is dropped, the rest survive. */
export function parseLayers(raw: unknown): StoredLayers {
  const out = emptyLayers();
  if (!isObj(raw)) return out;
  const items = isObj(raw.items) ? raw.items : {};
  for (const [id, v] of Object.entries(items)) {
    const layer = parseLayer(id, v);
    if (layer) out.items[id] = layer;
  }
  const order = Array.isArray(raw.order) ? raw.order.filter((id): id is string => typeof id === 'string' && id in out.items) : [];
  // Layers missing from the order go on top, so nothing is silently lost.
  out.order = [...new Set(order), ...Object.keys(out.items).filter((id) => !order.includes(id))];
  return out;
}

/**
 * Saved measurements, validated one by one. The numeric value is always recomputed from the
 * geometry, so a stale or tampered value can never disagree with what is drawn.
 */
export function parseMeasurements(raw: unknown): SavedMeasurement[] {
  if (!Array.isArray(raw)) return [];
  const out: SavedMeasurement[] = [];
  const seen = new Set<string>();
  for (const m of raw) {
    if (!isObj(m) || typeof m.id !== 'string' || !m.id || seen.has(m.id) || typeof m.name !== 'string') continue;
    if (m.kind !== 'distance' && m.kind !== 'area') continue;
    const g = m.geometry;
    const typeOk = isObj(g) && g.type === (m.kind === 'distance' ? 'LineString' : 'Polygon') && validGeometry(g);
    if (!typeOk) continue;
    const vertices = verticesOf(g as SavedMeasurement['geometry']);
    if (vertices.length < minVertices(m.kind)) continue;
    seen.add(m.id);
    const createdAt = isNum(m.createdAt) ? m.createdAt : 0;
    out.push({
      id: m.id,
      name: m.name,
      kind: m.kind,
      ...measure(m.kind, vertices),
      visible: m.visible !== false,
      createdAt,
      updatedAt: isNum(m.updatedAt) ? m.updatedAt : createdAt,
    });
  }
  return out;
}

export function parseGeometry(raw: unknown): GeometryDoc {
  if (!isObj(raw)) return emptyGeometry();
  return { version: SCHEMA_VERSION, layers: parseLayers(raw.layers), measurements: parseMeasurements(raw.measurements) };
}

// -------------------------------------------------------------- migrations

/**
 * Version 1 kept everything in one localStorage document, and measurements as bare coordinate
 * arrays. Splits it into v2 prefs + geometry. Pure: the adapter does the storage moves.
 */
export function migrateV1(raw: unknown, defaultBasemapId: string): { prefs: Prefs; geometry: GeometryDoc } {
  const o = isObj(raw) ? { ...raw } : {};
  // Before the satellite basemap, light and dark were two separate basemap ids.
  if (o.basemapId === 'light' || o.basemapId === 'dark') {
    o.mapTheme = o.basemapId;
    o.basemapId = 'map';
  }
  const measurements = Array.isArray(o.measurements)
    ? o.measurements.map((m) => {
        if (!isObj(m) || (m.kind !== 'distance' && m.kind !== 'area') || !Array.isArray(m.coordinates)) return m;
        const vertices = m.coordinates.filter(isPosition).map((p) => [p[0], p[1]] as [number, number]);
        return { ...m, ...measure(m.kind, vertices) };
      })
    : [];
  return {
    prefs: parsePrefs(o, defaultBasemapId),
    geometry: parseGeometry({ layers: o.layers, measurements }),
  };
}

/** Loads any known prefs version (for a future v3, add a step that maps v2 → v3 here). */
export function upgradePrefs(raw: unknown, defaultBasemapId: string): Prefs {
  return parsePrefs(raw, defaultBasemapId);
}

export function upgradeGeometry(raw: unknown): GeometryDoc {
  return parseGeometry(raw);
}
