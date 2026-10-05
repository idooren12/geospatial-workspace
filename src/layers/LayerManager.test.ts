import { describe, expect, it, vi } from 'vitest';
import { LayerManager, type LayerTarget } from './LayerManager';
import type { WorkspaceLayer } from './layerTypes';

/** Records map-side state like MapService does. */
function fakeTarget() {
  const sources = new Map<string, unknown>();
  let layers: Array<{ id: string; type: string; layout?: Record<string, unknown>; paint?: Record<string, unknown> }> = [];
  const t: LayerTarget & { sources: typeof sources; layers: () => typeof layers } = {
    sources,
    layers: () => layers,
    addSource: vi.fn((id, spec) => {
      if (sources.has(id)) throw new Error('dup source');
      sources.set(id, spec);
    }),
    removeSource: vi.fn((id) => sources.delete(id)),
    setGeoJSONData: vi.fn((id, data) => sources.set(id, { type: 'geojson', data })),
    addLayer: vi.fn((spec) => {
      if (spec.type === ('bogus' as never)) throw new Error('bad type');
      layers.push(structuredClone(spec) as never);
    }),
    removeLayer: vi.fn((id) => (layers = layers.filter((l) => l.id !== id))),
    setLayerVisibility: vi.fn((id, v) => {
      const l = layers.find((x) => x.id === id)!;
      l.layout = { ...l.layout, visibility: v ? 'visible' : 'none' };
    }),
    setPaintProperty: vi.fn((id, p, v) => {
      const l = layers.find((x) => x.id === id)!;
      l.paint = { ...l.paint, [p]: v };
    }),
    moveLayer: vi.fn((id) => {
      const l = layers.find((x) => x.id === id)!;
      layers = [...layers.filter((x) => x !== l), l];
    }),
    getLayerOrder: () => layers.map((l) => l.id),
  };
  return t;
}

const fc = (n: number) => ({ type: 'FeatureCollection' as const, features: Array.from({ length: n }, () => ({ type: 'Feature' as const, properties: {}, geometry: { type: 'Point' as const, coordinates: [34.8, 32.1] } })) });

const layer = (id: string, patch: Partial<WorkspaceLayer> = {}): WorkspaceLayer => ({
  id,
  name: id,
  type: 'geojson',
  visible: true,
  opacity: 1,
  removable: true,
  persist: 'local',
  source: { type: 'geojson', data: fc(1) },
  mapLayers: [],
  ...patch,
});

const rec = (...ls: WorkspaceLayer[]) => Object.fromEntries(ls.map((l) => [l.id, l]));

describe('LayerManager', () => {
  it('adds a GeoJSON layer with default fill/line/circle styles on its own source', () => {
    const t = fakeTarget();
    new LayerManager(t).sync(rec(layer('a')), ['a']);
    expect([...t.sources.keys()]).toEqual(['ws:a']);
    expect(t.layers().map((l) => [l.id, l.type])).toEqual([
      ['ws:a:0', 'fill'],
      ['ws:a:1', 'line'],
      ['ws:a:2', 'circle'],
    ]);
  });

  it('multiplies the style opacity by the workspace opacity', () => {
    const t = fakeTarget();
    const lm = new LayerManager(t);
    const a = layer('a', { opacity: 0.5 });
    lm.sync(rec(a), ['a']);
    expect(t.layers()[0]!.paint!['fill-opacity']).toBeCloseTo(0.125); // default 0.25 × 0.5
    lm.sync(rec({ ...a, opacity: 1 }), ['a']);
    expect(t.layers()[0]!.paint!['fill-opacity']).toBeCloseTo(0.25);
    expect(t.layers()[1]!.paint!['line-opacity']).toBe(1);
  });

  it('toggles visibility on every map layer of the workspace layer', () => {
    const t = fakeTarget();
    const lm = new LayerManager(t);
    const a = layer('a');
    lm.sync(rec(a), ['a']);
    lm.sync(rec({ ...a, visible: false }), ['a']);
    expect(t.layers().every((l) => l.layout?.visibility === 'none')).toBe(true);
  });

  it('orders map layers bottom → top as the store order says', () => {
    const t = fakeTarget();
    const lm = new LayerManager(t);
    const a = layer('a', { type: 'raster', source: { type: 'raster', tiles: ['x'] } });
    const b = layer('b', { type: 'raster', source: { type: 'raster', tiles: ['y'] } });
    lm.sync(rec(a, b), ['a', 'b']);
    expect(t.getLayerOrder()).toEqual(['ws:a:0', 'ws:b:0']);
    lm.sync(rec(a, b), ['b', 'a']);
    expect(t.getLayerOrder()).toEqual(['ws:b:0', 'ws:a:0']);
  });

  it('updates GeoJSON data in place instead of re-adding layers', () => {
    const t = fakeTarget();
    const lm = new LayerManager(t);
    const a = layer('a');
    lm.sync(rec(a), ['a']);
    vi.mocked(t.addLayer).mockClear();
    lm.sync(rec({ ...a, source: { type: 'geojson', data: fc(3) } }), ['a']);
    expect(t.setGeoJSONData).toHaveBeenCalledTimes(1);
    expect(t.addLayer).not.toHaveBeenCalled();
  });

  it('re-creates map layers when the styles change', () => {
    const t = fakeTarget();
    const lm = new LayerManager(t);
    const a = layer('a');
    lm.sync(rec(a), ['a']);
    lm.sync(rec({ ...a, mapLayers: [{ type: 'line', paint: { 'line-color': '#f00' } }] }), ['a']);
    expect(t.layers().map((l) => l.type)).toEqual(['line']);
  });

  it('removes map layers and source when a layer leaves the store', () => {
    const t = fakeTarget();
    const lm = new LayerManager(t);
    lm.sync(rec(layer('a'), layer('b')), ['a', 'b']);
    lm.sync(rec(layer('b')), ['b']);
    expect([...t.sources.keys()]).toEqual(['ws:b']);
    expect(t.layers().every((l) => l.id.startsWith('ws:b:'))).toBe(true);
  });

  it('survives a bad style from a tool and reports it', () => {
    const t = fakeTarget();
    const lm = new LayerManager(t);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    lm.sync(rec(layer('bad', { mapLayers: [{ type: 'bogus' } as never] }), layer('ok')), ['bad', 'ok']);
    expect(lm.errors.has('bad')).toBe(true);
    expect(t.layers().some((l) => l.id.startsWith('ws:ok:'))).toBe(true);
    warn.mockRestore();
  });

  it('leaves custom layers to their tool', () => {
    const t = fakeTarget();
    new LayerManager(t).sync(rec(layer('c', { type: 'custom', source: { anything: 1 } })), ['c']);
    expect(t.sources.size).toBe(0);
    expect(t.layers()).toHaveLength(0);
  });
});
