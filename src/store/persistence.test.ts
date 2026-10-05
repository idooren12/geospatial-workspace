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
