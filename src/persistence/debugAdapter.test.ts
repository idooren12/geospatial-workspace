import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { PREFS_KEY } from './browserAdapter';
import { DEBUG_PREFIX, DebugSessionAdapter, isDebugSession } from './debugAdapter';
import { emptyGeometry } from './schema';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  globalThis.indexedDB = new IDBFactory();
});

describe('?debug sessions are isolated (M5.1)', () => {
  it('is detected from the URL only', () => {
    expect(isDebugSession('?debug')).toBe(true);
    expect(isDebugSession('?x=1&debug=1')).toBe(true);
    expect(isDebugSession('?debugger')).toBe(false);
    expect(isDebugSession('')).toBe(false);
  });

  it('starts from defaults, never reads the real workspace, and writes only gws-debug: keys in sessionStorage', async () => {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ version: 2, basemapId: 'satellite', mapTheme: 'dark' }));
    const real = localStorage.getItem(PREFS_KEY);
    const a = new DebugSessionAdapter();
    const loaded = await a.load('map');
    expect(loaded.prefs).toMatchObject({ basemapId: 'map', mapTheme: 'light' }); // not the user's
    a.savePrefs({ ...loaded.prefs, basemapId: 'satellite' });
    await a.saveGeometry({ ...emptyGeometry(), measurements: [] });
    a.toolStorage('t').set('k', 1);

    expect(localStorage.getItem(PREFS_KEY)).toBe(real); // untouched
    expect(Object.keys(localStorage)).toEqual([PREFS_KEY]);
    expect(Object.keys(sessionStorage).every((k) => k.startsWith(DEBUG_PREFIX))).toBe(true);
    expect(await indexedDB.databases()).toEqual([]); // IndexedDB never opened

    // Survives a reload of the same tab…
    expect((await new DebugSessionAdapter().load('map')).prefs.basemapId).toBe('satellite');
    // …and is gone with the tab.
    sessionStorage.clear();
    expect((await new DebugSessionAdapter().load('map')).prefs.basemapId).toBe('map');
  });
});
