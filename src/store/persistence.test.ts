import { describe, expect, it, vi } from 'vitest';
import { emptyDock } from '../layout/dockPlanner';
import { DEFAULT_SETTINGS, parseWorkspace, SCHEMA_VERSION } from './persistence';
import { createWorkspaceStore, startPersistence } from './workspaceStore';

describe('parseWorkspace', () => {
  it('returns defaults for empty or corrupt storage', () => {
    for (const raw of [null, '', '{bad json', '42', 'null']) {
      const ws = parseWorkspace(raw, 'map');
      expect(ws).toEqual({
        version: SCHEMA_VERSION,
        view: null,
        basemapId: 'map',
        mapTheme: 'light',
        settings: DEFAULT_SETTINGS,
        dock: emptyDock(),
        layers: { items: {}, order: [] },
        measurements: [],
      });
    }
  });

  it('keeps valid fields and replaces only the invalid ones', () => {
    const ws = parseWorkspace(
      JSON.stringify({
        version: 1,
        view: { center: [34.78, 32.08], zoom: 11.4, bearing: 0, pitch: 0 },
        basemapId: 'satellite',
        mapTheme: 'dark',
        settings: { language: 'xx', units: 'nautical', coordFormat: 'dms' },
      }),
      'map',
    );
    expect(ws.view?.zoom).toBe(11.4);
    expect(ws.basemapId).toBe('satellite');
    expect(ws.mapTheme).toBe('dark');
    expect(ws.settings).toEqual({ language: 'he', units: 'nautical', coordFormat: 'dms' });
  });

  it('migrates the old light/dark basemap ids to map + theme', () => {
    expect(parseWorkspace(JSON.stringify({ basemapId: 'dark' }), 'map')).toMatchObject({ basemapId: 'map', mapTheme: 'dark' });
    expect(parseWorkspace(JSON.stringify({ basemapId: 'light' }), 'map')).toMatchObject({ basemapId: 'map', mapTheme: 'light' });
  });

  it('restores a stored dock layout', () => {
    const dock = { mapOnly: false, widthMemory: {}, columns: { left: [{ id: 'c', width: 300, panelIds: ['layers'], activePanelId: 'layers' }], right: [] } };
    expect(parseWorkspace(JSON.stringify({ dock }), 'map').dock).toEqual(dock);
  });

  it('keeps valid saved measurements and drops malformed ones', () => {
    const ms = parseWorkspace(
      JSON.stringify({
        measurements: [
          { id: 'a', name: 'Road', kind: 'distance', coordinates: [[34, 32], [35, 32]], visible: false, createdAt: 1 },
          { id: 'b', name: 'Too short', kind: 'area', coordinates: [[34, 32], [35, 32]] },
          { id: 'c', name: 'Bad kind', kind: 'volume', coordinates: [[34, 32], [35, 32]] },
          'nope',
        ],
      }),
      'map',
    ).measurements;
    expect(ms).toEqual([{ id: 'a', name: 'Road', kind: 'distance', coordinates: [[34, 32], [35, 32]], visible: false, createdAt: 1 }]);
  });

  it('drops an impossible view', () => {
    const ws = parseWorkspace(JSON.stringify({ view: { center: [0, 200], zoom: 1, bearing: 0, pitch: 0 } }), 'map');
    expect(ws.view).toBeNull();
  });
});

describe('startPersistence', () => {
  it('coalesces rapid changes into a single debounced write', () => {
    vi.useFakeTimers();
    const store = createWorkspaceStore(parseWorkspace(null, 'map'));
    const write = vi.fn();
    const stop = startPersistence(store, write, 300);
    for (let i = 0; i < 20; i++) store.getState().setView({ center: [34 + i / 100, 32], zoom: 8, bearing: 0, pitch: 0 });
    expect(write).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(write).toHaveBeenCalledTimes(1);
    expect(write.mock.calls[0]![0].view.center[0]).toBeCloseTo(34.19);
    stop();
    vi.useRealTimers();
  });

  it('flushes a pending write on pagehide', () => {
    vi.useFakeTimers();
    const store = createWorkspaceStore(parseWorkspace(null, 'map'));
    const write = vi.fn();
    const stop = startPersistence(store, write, 300);
    store.getState().setBasemap('satellite');
    window.dispatchEvent(new Event('pagehide'));
    expect(write).toHaveBeenCalledTimes(1);
    expect(write.mock.calls[0]![0].basemapId).toBe('satellite');
    stop();
    vi.useRealTimers();
  });
});

describe('layers in the store', () => {
  const geo = { type: 'geojson' as const, data: { type: 'FeatureCollection', features: [] } };

  it('adds on top, renames, hides, clamps opacity, reorders and removes', () => {
    const store = createWorkspaceStore(parseWorkspace(null, 'map'));
    const s = () => store.getState();
    const a = s().addLayer({ name: 'A', type: 'geojson', source: geo });
    const b = s().addLayer({ name: ' B ', type: 'geojson', source: geo });
    expect(s().layerOrder).toEqual([a, b]);
    expect(s().layers[b]!.name).toBe('B');
    s().renameLayer(a, '   '); // blank names are ignored
    expect(s().layers[a]!.name).toBe('A');
    s().setLayerVisible(a, false);
    s().setLayerOpacity(a, 7);
    expect(s().layers[a]).toMatchObject({ visible: false, opacity: 1 });
    s().moveLayer(a, 1);
    expect(s().layerOrder).toEqual([b, a]);
    s().removeLayer(b);
    expect(s().layerOrder).toEqual([a]);
  });

  it('keeps non-removable layers unless a tool forces it', () => {
    const store = createWorkspaceStore(parseWorkspace(null, 'map'));
    const id = store.getState().addLayer({ name: 'Locked', type: 'custom', removable: false });
    store.getState().removeLayer(id);
    expect(store.getState().layers[id]).toBeDefined();
    store.getState().removeLayer(id, { force: true });
    expect(store.getState().layers[id]).toBeUndefined();
  });

  it('saves local layers with the workspace and session layers separately', () => {
    vi.useFakeTimers();
    const store = createWorkspaceStore(parseWorkspace(null, 'map'));
    const write = vi.fn();
    const writeSession = vi.fn();
    const stop = startPersistence(store, write, 300, writeSession);
    const keep = store.getState().addLayer({ name: 'Keep', type: 'geojson', source: geo });
    const tab = store.getState().addLayer({ name: 'Sketch', type: 'geojson', source: geo, persist: 'session' });
    store.getState().addLayer({ name: 'Temp', type: 'geojson', source: geo, persist: 'none' });
    vi.advanceTimersByTime(300);
    expect(write.mock.calls[0]![0].layers.order).toEqual([keep]);
    expect(writeSession.mock.calls[0]![0].order).toEqual([tab]);
    stop();
    vi.useRealTimers();
  });

  it('restores stored layers, dropping malformed ones and keeping the order', () => {
    const ws = parseWorkspace(
      JSON.stringify({
        layers: {
          items: {
            x: { name: 'X', type: 'raster', opacity: 2, source: { type: 'raster', tiles: ['t'] } },
            y: { name: 'Y', type: 'nonsense' },
            z: { name: 'Z', type: 'geojson', visible: false },
          },
          order: ['z', 'x', 'y'],
        },
      }),
      'map',
    );
    expect(ws.layers.order).toEqual(['z', 'x']);
    expect(ws.layers.items.x!.opacity).toBe(1);
    expect(ws.layers.items.z!.visible).toBe(false);
  });
});
