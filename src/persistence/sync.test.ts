import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createWorkspaceStore } from '../store/workspaceStore';
import { MemoryPersistenceAdapter } from './browserAdapter';
import { startPersistence } from './sync';

const geo = { type: 'geojson' as const, data: { type: 'FeatureCollection', features: [] } };

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('startPersistence (auto-save)', () => {
  it('coalesces rapid camera changes into one prefs write and no geometry write', () => {
    const store = createWorkspaceStore();
    const a = new MemoryPersistenceAdapter();
    const stop = startPersistence(store, a, 300);
    for (let i = 0; i < 20; i++) store.getState().setView({ center: [34 + i / 100, 32], zoom: 8, bearing: 0, pitch: 0 });
    expect(a.writes.prefs).toBe(0);
    vi.advanceTimersByTime(300);
    expect(a.writes).toMatchObject({ prefs: 1, geometry: 0 });
    expect(a.prefs!.view!.center[0]).toBeCloseTo(34.19);
    stop();
  });

  it('flushes pending writes when the page is hidden', async () => {
    const store = createWorkspaceStore();
    const a = new MemoryPersistenceAdapter();
    const stop = startPersistence(store, a, 300);
    store.getState().setBasemap('satellite');
    store.getState().addLayer({ name: 'Keep', type: 'geojson', source: geo });
    window.dispatchEvent(new Event('pagehide'));
    await vi.runAllTimersAsync();
    expect(a.prefs!.basemapId).toBe('satellite');
    expect(a.geometry.layers.order).toHaveLength(1);
    stop();
  });

  it('saves local layers as geometry, session layers per tab, and never "none" layers', async () => {
    const store = createWorkspaceStore();
    const a = new MemoryPersistenceAdapter();
    const stop = startPersistence(store, a, 300);
    const keep = store.getState().addLayer({ name: 'Keep', type: 'geojson', source: geo });
    const tab = store.getState().addLayer({ name: 'Tab', type: 'geojson', source: geo, persist: 'session' });
    store.getState().addLayer({ name: 'Temp', type: 'geojson', source: geo, persist: 'none' });
    await vi.advanceTimersByTimeAsync(300);
    expect(a.geometry.layers.order).toEqual([keep]);
    expect(a.session.order).toEqual([tab]);
    stop();
  });

  it('auto-saves edits to saved measurements, and a reload gets them back', async () => {
    const store = createWorkspaceStore();
    const a = new MemoryPersistenceAdapter();
    const stop = startPersistence(store, a, 300);
    const id = store.getState().saveMeasurement({ name: 'Fence', kind: 'distance', vertices: [[34, 32], [34.01, 32]] });
    store.getState().updateMeasurement(id, { name: 'North fence', visible: false });
    await vi.advanceTimersByTimeAsync(300);
    stop();

    const reloaded = createWorkspaceStore(await a.load('map'));
    const [m] = reloaded.getState().measurements;
    expect(m).toMatchObject({ id, name: 'North fence', visible: false, kind: 'distance', unit: 'm' });
    expect(m!.value).toBeGreaterThan(900);
  });
});
