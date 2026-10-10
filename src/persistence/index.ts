import type { PersistenceAdapter } from './adapter';
import { BrowserPersistenceAdapter } from './browserAdapter';
import { DebugSessionAdapter, isDebugSession } from './debugAdapter';

export type { GeometryBackend, PersistenceAdapter } from './adapter';
export * from './schema';
export { startPersistence, toGeometry, toPrefs, layersBy } from './sync';
export { DEBUG_PREFIX, isDebugSession } from './debugAdapter';

/** `?debug` sessions are sandboxed: they never see or change the user's saved workspace. */
export const DEBUG_MODE = isDebugSession();

/** The page's one persistence adapter. */
export const persistence: PersistenceAdapter = DEBUG_MODE ? new DebugSessionAdapter() : new BrowserPersistenceAdapter();
