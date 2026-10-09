import { describe, expect, it } from 'vitest';
import { emptyDock } from '../layout/dockPlanner';
import {
  DEFAULT_SETTINGS,
  isJsonValue,
  migrateV1,
  parseGeometry,
  parseMeasurements,
  parsePrefs,
  parseView,
  sanitizeFeatureCollection,
  SCHEMA_VERSION,
} from './schema';

describe('parsePrefs', () => {
  it('returns defaults for missing or malformed prefs', () => {
    for (const raw of [undefined, null, 42, 'x', [], { version: 2, settings: 'nope' }]) {
      expect(parsePrefs(raw, 'map')).toEqual({
        version: SCHEMA_VERSION,
        view: null,
        basemapId: 'map',
        mapTheme: 'light',
        settings: DEFAULT_SETTINGS,
        dock: emptyDock(),
      });
    }
  });

  it('keeps valid fields and replaces only the invalid ones', () => {
    const p = parsePrefs(
      {
        view: { center: [34.78, 32.08], zoom: 11.4, bearing: 0, pitch: 0 },
        basemapId: 'satellite',
        mapTheme: 'dark',
        settings: { language: 'xx', units: 'nautical', coordFormat: 'dms' },
      },
      'map',
    );
    expect(p.view?.zoom).toBe(11.4);
    expect(p).toMatchObject({ basemapId: 'satellite', mapTheme: 'dark' });
    expect(p.settings).toEqual({ language: 'he', units: 'nautical', coordFormat: 'dms' });
  });

  it('restores a stored dock layout', () => {
    const dock = { mapOnly: false, widthMemory: {}, columns: { left: [{ id: 'c', width: 300, panelIds: ['layers'], activePanelId: 'layers' }], right: [] } };
    expect(parsePrefs({ dock }, 'map').dock).toEqual(dock);
  });
});

describe('parseView (map state sanitising)', () => {
  it('drops impossible cameras', () => {
    for (const v of [
      { center: [0, 200], zoom: 1, bearing: 0, pitch: 0 },
      { center: [0, 0], zoom: Number.NaN, bearing: 0, pitch: 0 },
      { center: [0, 0], zoom: 99, bearing: 0, pitch: 0 },
      { center: [0, 0], zoom: 3, bearing: 0, pitch: 120 },
      { center: ['a', 0], zoom: 3, bearing: 0, pitch: 0 },
    ]) {
      expect(parseView(v)).toBeNull();
    }
  });

  it('wraps a longitude that went round the world', () => {
    expect(parseView({ center: [394.78, 32], zoom: 8, bearing: 0, pitch: 0 })!.center[0]).toBeCloseTo(34.78);
  });
});

describe('geometry document', () => {
  it('keeps GeoJSON features with valid WGS84 coordinates and drops the rest', () => {
    const fc = sanitizeFeatureCollection({
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', properties: { fid: 'a', name: 'ok' }, geometry: { type: 'Point', coordinates: [34.8, 32.1] } },
        { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [34.8, 132] } },
        { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[34, 32]] } },
        { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[34, 32], [35, 32], [35, Number.NaN], [34, 32]]] } },
        'junk',
      ],
    });
    expect(fc!.features.map((f) => f.properties!.fid)).toEqual(['a']);
  });

  it('restores layers, dropping malformed ones and keeping order, ids and metadata', () => {
    const g = parseGeometry({
      layers: {
        items: {
          x: { name: 'X', type: 'raster', opacity: 2, source: { type: 'raster', tiles: ['t'] }, metadata: { source: 'tool:x', createdAt: 5 } },
          y: { name: 'Y', type: 'nonsense' },
          z: { name: 'Z', type: 'geojson', visible: false, metadata: { bad: () => 1 } },
        },
        order: ['z', 'x', 'y'],
      },
    });
    expect(g.layers.order).toEqual(['z', 'x']);
    expect(g.layers.items.x).toMatchObject({ id: 'x', opacity: 1, metadata: { source: 'tool:x', createdAt: 5 } });
    expect(g.layers.items.z!.visible).toBe(false);
    expect(g.layers.items.z!.metadata).toBeUndefined(); // not plain JSON → dropped
  });

  it('recomputes a saved measurement value from its geometry and keeps its unit', () => {
    const [m] = parseMeasurements([
      { id: 'a', name: 'Road', kind: 'distance', geometry: { type: 'LineString', coordinates: [[34.7818, 32.0853], [35.2137, 31.7683]] }, value: 1, unit: 'm', visible: false, createdAt: 1 },
    ]);
    expect(m!.value).toBeGreaterThan(53_000); // Tel Aviv–Jerusalem ≈ 54 km, whatever was stored
    expect(m!.value).toBeLessThan(55_000);
    expect(m).toMatchObject({ unit: 'm', visible: false, createdAt: 1, updatedAt: 1 });
  });

  it('drops measurements with the wrong geometry, too few vertices or duplicate ids', () => {
    const line = { type: 'LineString', coordinates: [[34, 32], [35, 32]] };
    const ms = parseMeasurements([
      { id: 'a', name: 'ok', kind: 'distance', geometry: line },
      { id: 'a', name: 'dup', kind: 'distance', geometry: line },
      { id: 'b', name: 'type', kind: 'area', geometry: line },
      { id: 'c', name: 'short', kind: 'area', geometry: { type: 'Polygon', coordinates: [[[34, 32], [35, 32], [34, 32]]] } },
      { id: 'd', name: 'kind', kind: 'volume', geometry: line },
      'nope',
    ]);
    expect(ms.map((m) => m.id)).toEqual(['a']);
  });

  it('only accepts plain JSON', () => {
    expect(isJsonValue({ a: [1, 'b', null, { c: true }] })).toBe(true);
    for (const bad of [Number.NaN, () => 1, new Date(), { m: new Map() }, Infinity]) expect(isJsonValue(bad)).toBe(false);
  });
});

describe('migration v1 → v2', () => {
  const v1 = {
    version: 1,
    view: { center: [34.78, 32.08], zoom: 9, bearing: 0, pitch: 0 },
    basemapId: 'dark',
    settings: { language: 'en', units: 'metric', coordFormat: 'decimal' },
    layers: {
      items: { L1: { name: 'Drawing 1', type: 'geojson', group: 'drawing', source: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } } } },
      order: ['L1'],
    },
    measurements: [
      { id: 'M1', name: 'Field', kind: 'area', coordinates: [[34, 32], [34.01, 32], [34.01, 32.01]], visible: true, createdAt: 7 },
      { id: 'M2', name: 'Path', kind: 'distance', coordinates: [[34, 32], [34.01, 32]], visible: false, createdAt: 8 },
    ],
  };

  it('splits prefs from geometry and converts measurements to GeoJSON with value and unit', () => {
    const { prefs, geometry } = migrateV1(v1, 'map');
    expect(prefs).toMatchObject({ version: 2, basemapId: 'map', mapTheme: 'dark', settings: { language: 'en' } });
    expect(prefs).not.toHaveProperty('layers');
    expect(geometry.layers.order).toEqual(['L1']);
    const [area, path] = geometry.measurements;
    expect(area!.geometry.type).toBe('Polygon');
    expect((area!.geometry.coordinates as number[][][])[0]).toHaveLength(4); // ring closed
    expect(area).toMatchObject({ id: 'M1', unit: 'm2', createdAt: 7 });
    expect(area!.value).toBeGreaterThan(500_000); // half of a ~1.05 km² square
    expect(path).toMatchObject({ id: 'M2', unit: 'm', visible: false });
    expect(JSON.parse(JSON.stringify(geometry))).toEqual(geometry); // serialisable
  });

  it('migrates the old light/dark basemap ids to map + theme', () => {
    expect(migrateV1({ basemapId: 'light' }, 'map').prefs).toMatchObject({ basemapId: 'map', mapTheme: 'light' });
  });
});
