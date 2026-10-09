import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserPersistenceAdapter, CORRUPT_KEY, GEOMETRY_FALLBACK_KEY, LEGACY_V1_KEY, PREFS_KEY } from './browserAdapter';
import { openDocStore } from './idb';
import { emptyGeometry, SCHEMA_VERSION } from './schema';

let factory: IDBFactory;
const adapter = () => new BrowserPersistenceAdapter(() => openDocStore(factory));

beforeEach(() => {
  factory = new IDBFactory(); // a fresh, empty database per test
  localStorage.clear();
  sessionStorage.clear();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

const drawingLayer = {
  id: 'L1',
  name: 'Drawing 1',
  type: 'geojson' as const,
  visible: true,
  opacity: 1,
  removable: true,
  mapLayers: [],
  persist: 'local' as const,
  group: 'drawing',
  source: {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { fid: 'f1', name: 'Point 1', kind: 'point' }, geometry: { type: 'Point', coordinates: [34.8, 32.1] } }] },
  },
};

describe('BrowserPersistenceAdapter', () => {
  it('keeps geometry in IndexedDB and prefs in localStorage', async () => {
    const a = adapter();
    const first = await a.load('map');
    expect(a.geometryBackend).toBe('indexeddb');
    a.savePrefs({ ...first.prefs, basemapId: 'satellite' });
    await a.saveGeometry({ ...emptyGeometry(), layers: { items: { L1: drawingLayer }, order: ['L1'] } });

    expect(JSON.parse(localStorage.getItem(PREFS_KEY)!)).toMatchObject({ version: SCHEMA_VERSION, basemapId: 'satellite' });
    expect(localStorage.getItem(PREFS_KEY)).not.toContain('Point 1'); // no geometry in localStorage

    const again = await adapter().load('map'); // a new page load
    expect(again.prefs.basemapId).toBe('satellite');
    expect(again.geometry.layers.items.L1!.name).toBe('Drawing 1');
  });

  it('migrates a v1 workspace once: geometry to IndexedDB, prefs to v2, v1 removed', async () => {
    localStorage.setItem(
      LEGACY_V1_KEY,
      JSON.stringify({
        version: 1,
        basemapId: 'dark',
        layers: { items: { L1: drawingLayer }, order: ['L1'] },
        measurements: [{ id: 'M1', name: 'Path', kind: 'distance', coordinates: [[34, 32], [34.1, 32]], visible: true, createdAt: 3 }],
      }),
    );
    const loaded = await adapter().load('map');
    expect(loaded.prefs).toMatchObject({ basemapId: 'map', mapTheme: 'dark' });
    expect(loaded.geometry.measurements[0]).toMatchObject({ id: 'M1', unit: 'm', geometry: { type: 'LineString' } });
    expect(localStorage.getItem(LEGACY_V1_KEY)).toBeNull();
    expect(localStorage.getItem(PREFS_KEY)).not.toBeNull();

    const next = await adapter().load('map'); // second load reads v2, not v1
    expect(next.geometry.layers.order).toEqual(['L1']);
    expect(next.geometry.measurements).toHaveLength(1);
  });

  it('falls back to localStorage for geometry when IndexedDB cannot open', async () => {
    const a = new BrowserPersistenceAdapter(() => Promise.reject(new Error('blocked')));
    await a.load('map');
    expect(a.geometryBackend).toBe('localStorage');
    await a.saveGeometry({ ...emptyGeometry(), layers: { items: { L1: drawingLayer }, order: ['L1'] } });
    expect(JSON.parse(localStorage.getItem(GEOMETRY_FALLBACK_KEY)!).layers.order).toEqual(['L1']);
    const b = new BrowserPersistenceAdapter(() => Promise.reject(new Error('blocked')));
    expect((await b.load('map')).geometry.layers.order).toEqual(['L1']);
  });

  it('starts from defaults on corrupt prefs and keeps a copy of the bad data', async () => {
    localStorage.setItem(PREFS_KEY, '{not json');
    const loaded = await adapter().load('map');
    expect(loaded.prefs.basemapId).toBe('map');
    expect(localStorage.getItem(`${CORRUPT_KEY}:${PREFS_KEY}`)).toBe('{not json');
  });

  it('keeps session layers per tab', async () => {
    const a = adapter();
    await a.load('map');
    a.saveSession({ items: { S: { ...drawingLayer, id: 'S', persist: 'session' } }, order: ['S'] });
    expect((await adapter().load('map')).session.order).toEqual(['S']);
    a.saveSession({ items: {}, order: [] });
    expect(sessionStorage.length).toBe(0);
  });
});
