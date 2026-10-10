import type { Map as MlMap, MapOptions } from 'maplibre-gl';
import { describe, expect, it, vi } from 'vitest';
import { MapService, type MountOptions } from './MapService';

/** Minimal in-memory stand-in for maplibregl.Map: enough to test MapService's bookkeeping. */
class FakeMap {
  handlers = new Map<string, Set<(e?: unknown) => void>>();
  sources = new Map<string, unknown>();
  layers: Array<{ id: string; type: string; layout?: Record<string, unknown>; paint?: Record<string, unknown> }> = [];
  basemapLayers = [
    { id: 'place-city', type: 'symbol', layout: { 'text-field': ['get', 'name_en'] } },
    { id: 'housenumber', type: 'symbol', layout: { 'text-field': '{housenumber}' } },
  ];
  styleUrl: string;
  options: MapOptions;
  constructor(options: MapOptions) {
    this.options = options;
    this.styleUrl = String(options.style);
  }
  on(t: string, fn: (e?: unknown) => void) {
    if (!this.handlers.has(t)) this.handlers.set(t, new Set());
    this.handlers.get(t)!.add(fn);
  }
  off(t: string, fn: (e?: unknown) => void) {
    this.handlers.get(t)?.delete(fn);
  }
  fire(t: string, e?: unknown) {
    this.handlers.get(t)?.forEach((fn) => fn(e));
  }
  addControl() {}
  hasControl() {
    return false;
  }
  removeControl() {}
  remove() {}
  resize = vi.fn();
  addSource(id: string, s: unknown) {
    this.sources.set(id, s);
  }
  getSource(id: string) {
    return this.sources.get(id);
  }
  removeSource(id: string) {
    this.sources.delete(id);
  }
  addLayer(spec: { id: string; type: string }, beforeId?: string) {
    const copy = structuredClone(spec);
    const at = beforeId ? this.layers.findIndex((l) => l.id === beforeId) : -1;
    if (at >= 0) this.layers.splice(at, 0, copy);
    else this.layers.push(copy);
  }
  getLayer(id: string) {
    return this.layers.find((l) => l.id === id) ?? this.basemapLayers.find((l) => l.id === id);
  }
  removeLayer(id: string) {
    this.layers = this.layers.filter((l) => l.id !== id);
  }
  moveLayer(id: string, beforeId?: string) {
    const l = this.layers.find((x) => x.id === id)!;
    this.layers = this.layers.filter((x) => x !== l);
    const at = beforeId ? this.layers.findIndex((x) => x.id === beforeId) : -1;
    if (at >= 0) this.layers.splice(at, 0, l);
    else this.layers.push(l);
  }
  setLayoutProperty(id: string, k: string, v: unknown) {
    const l = this.getLayer(id)!;
    l.layout = { ...l.layout, [k]: v };
  }
  setPaintProperty(id: string, k: string, v: unknown) {
    const l = (this.layers.find((x) => x.id === id) ?? this.basemapLayers.find((x) => x.id === id)) as {
      paint?: Record<string, unknown>;
    };
    l.paint = { ...l.paint, [k]: v };
  }
  getStyle() {
    return { layers: [...this.basemapLayers, ...this.layers] };
  }
  /** Like MapLibre: a new style wipes every non-style source and layer. */
  setStyle(url: string) {
    this.styleUrl = url;
    this.sources.clear();
    this.layers = [];
  }
}

const opts: MountOptions = {
  style: 'https://example.test/light',
  view: null,
  fallbackBounds: [
    [34, 29],
    [36, 33],
  ],
  labelLanguage: 'he',
  scaleUnit: 'metric',
  controlCorner: 'top-left',
};

function setup() {
  let fake!: FakeMap;
  const svc = new MapService((o) => {
    fake = new FakeMap(o);
    return fake as unknown as MlMap;
  });
  const el = document.createElement('div');
  svc.mount(el, opts);
  return { svc, el, fake: () => fake };
}

const fillLayer = { id: 'ws:a:0', type: 'fill' as const, source: 'ws:a', paint: { 'fill-color': '#f00' } };

describe('MapService', () => {
  it('creates exactly one map, even when mount runs twice (StrictMode)', () => {
    const { svc, el } = setup();
    svc.mount(el, opts);
    svc.mount(el, opts);
    expect(svc.instanceCount).toBe(1);
  });

  it('fits the fallback bounds when there is no saved view', () => {
    const { fake } = setup();
    expect(fake().options.bounds).toEqual(opts.fallbackBounds);
  });

  it('restores a saved view instead of the fallback bounds', () => {
    let fake!: FakeMap;
    const svc = new MapService((o) => (fake = new FakeMap(o)) as unknown as MlMap);
    svc.mount(document.createElement('div'), { ...opts, view: { center: [35, 32], zoom: 9, bearing: 10, pitch: 20 } });
    expect(fake.options.center).toEqual([35, 32]);
    expect(fake.options.bounds).toBeUndefined();
  });

  it('queues layers added before the style is ready and adds them on style.load', () => {
    const { svc, fake } = setup();
    svc.addSource('ws:a', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    svc.addLayer(fillLayer);
    expect(fake().layers).toHaveLength(0);
    fake().fire('style.load');
    expect(fake().sources.has('ws:a')).toBe(true);
    expect(fake().layers.map((l) => l.id)).toEqual(['ws:a:0']);
  });

  it('keeps workspace layers, order, visibility and opacity across a basemap switch', () => {
    const { svc, fake } = setup();
    fake().fire('style.load');
    svc.addSource('ws:a', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    svc.addLayer(fillLayer);
    svc.addLayer({ id: 'ws:a:1', type: 'line', source: 'ws:a' });
    svc.moveLayer('ws:a:1', 'ws:a:0');
    svc.setLayerVisibility('ws:a:0', false);
    svc.setLayerOpacity('ws:a:0', 0.4);

    svc.setStyle('https://example.test/dark');
    expect(fake().layers).toHaveLength(0); // wiped by the new style…
    fake().fire('style.load');

    const ids = fake().layers.map((l) => l.id);
    expect(ids).toEqual(['ws:a:1', 'ws:a:0']); // …and restored in order
    const a0 = fake().layers.find((l) => l.id === 'ws:a:0')!;
    expect(a0.layout?.visibility).toBe('none');
    expect(a0.paint?.['fill-opacity']).toBe(0.4);
    expect(a0.paint?.['fill-color']).toBe('#f00');
  });

  it('treats adding an existing layer id as a replace, never a duplicate', () => {
    const { svc, fake } = setup();
    fake().fire('style.load');
    svc.addSource('ws:a', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    svc.addLayer(fillLayer);
    svc.addLayer({ ...fillLayer, paint: { 'fill-color': '#0f0' } });
    expect(svc.getLayerOrder()).toEqual(['ws:a:0']);
    expect(fake().layers).toHaveLength(1);
    expect(fake().layers[0]!.paint?.['fill-color']).toBe('#0f0');
  });

  it('keeps overlay layers above layers added or moved later, also after a basemap switch', () => {
    const { svc, fake } = setup();
    fake().fire('style.load');
    svc.addSource('ws:a', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    svc.addOverlayLayer({ id: 'ws:o:0', type: 'line', source: 'ws:a' });
    svc.addLayer(fillLayer);
    svc.addLayer({ id: 'ws:a:1', type: 'line', source: 'ws:a' });
    svc.moveLayer('ws:a:0');
    svc.addOverlayLayer({ id: 'ws:o:0', type: 'line', source: 'ws:a' }); // re-add keeps it an overlay
    svc.addLayer({ id: 'ws:a:2', type: 'line', source: 'ws:a' });
    expect(svc.getLayerOrder()).toEqual(['ws:a:1', 'ws:a:0', 'ws:a:2', 'ws:o:0']);
    expect(fake().layers.map((l) => l.id)).toEqual(['ws:a:1', 'ws:a:0', 'ws:a:2', 'ws:o:0']);
    svc.setStyle('https://example.test/dark');
    fake().fire('style.load');
    expect(fake().layers.map((l) => l.id)).toEqual(['ws:a:1', 'ws:a:0', 'ws:a:2', 'ws:o:0']);
  });

  it('rejects ids without the workspace prefix', () => {
    const { svc } = setup();
    expect(() => svc.addLayer({ ...fillLayer, id: 'mine' })).toThrow(/ws:/);
  });

  it('removes layers from both the map and the restore list', () => {
    const { svc, fake } = setup();
    fake().fire('style.load');
    svc.addSource('ws:a', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    svc.addLayer(fillLayer);
    svc.removeLayer('ws:a:0');
    svc.setStyle('x');
    fake().fire('style.load');
    expect(fake().layers).toHaveLength(0);
  });

  it('switches basemap name labels to the chosen language and leaves other labels alone', () => {
    const { svc, fake } = setup();
    fake().fire('style.load');
    const city = () => fake().basemapLayers[0]!.layout!['text-field'];
    expect(JSON.stringify(city())).toContain('name:he');
    svc.setLabelLanguage('en');
    expect(JSON.stringify(city())).toContain('name:en');
    expect(fake().basemapLayers[1]!.layout!['text-field']).toBe('{housenumber}');
  });

  it('recolours basemap place names when a label paint is given, and not otherwise', () => {
    const { svc, fake } = setup();
    fake().fire('style.load');
    expect((fake().basemapLayers[0] as { paint?: object }).paint).toBeUndefined();
    svc.setStyle('dark', { 'text-color': '#ccc', 'text-halo-color': '#000', 'text-halo-width': 1 });
    fake().basemapLayers = [{ id: 'place-city', type: 'symbol', layout: { 'text-field': ['get', 'name'] } }];
    fake().fire('style.load');
    expect((fake().basemapLayers[0] as { paint?: Record<string, unknown> }).paint?.['text-color']).toBe('#ccc');
  });

  it('accepts event subscriptions before mount and detaches on unsubscribe', () => {
    let fake!: FakeMap;
    const svc = new MapService((o) => (fake = new FakeMap(o)) as unknown as MlMap);
    const fn = vi.fn();
    const off = svc.on('moveend', fn);
    svc.mount(document.createElement('div'), opts);
    fake.fire('moveend');
    off();
    fake.fire('moveend');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('basemap load state (M5.1)', () => {
  const tile = (sourceId: string) => ({ dataType: 'source', sourceId, tile: {} });

  it('is loading from mount until the style is in and the first basemap tile arrived', () => {
    const { svc, fake } = setup();
    const seen: string[] = [];
    svc.onLoadState((s) => seen.push(s.phase));
    expect(svc.getLoadState().phase).toBe('loading');
    fake().fire('data', tile('openmaptiles')); // before the style: does not count as usable
    fake().fire('style.load');
    fake().fire('data', tile('ws:a')); // an app layer is not the basemap
    expect(svc.getLoadState().phase).toBe('loading');
    fake().fire('data', tile('openmaptiles'));
    expect(svc.getLoadState().phase).toBe('ready');
    svc.setStyle('https://example.test/dark'); // every switch loads again
    expect(svc.getLoadState().phase).toBe('loading');
    expect(seen).toEqual(['ready', 'loading']);
  });

  it('reports a failed style, and a basemap whose every tile failed', () => {
    const a = setup();
    a.fake().fire('error', { error: new Error('503') });
    expect(a.svc.getLoadState()).toEqual({ phase: 'error', reason: 'style' });

    const b = setup();
    b.fake().fire('style.load');
    b.fake().fire('error', { sourceId: 'imagery' });
    b.fake().fire('error', { sourceId: 'ws:mine' }); // app layer errors are not basemap errors
    b.fake().fire('idle');
    expect(b.svc.getLoadState()).toEqual({ phase: 'error', reason: 'tiles' });
  });

  it('becomes ready on idle when the style has no tiles to wait for', () => {
    const { svc, fake } = setup();
    fake().fire('style.load');
    fake().fire('idle');
    expect(svc.getLoadState().phase).toBe('ready');
  });
});
