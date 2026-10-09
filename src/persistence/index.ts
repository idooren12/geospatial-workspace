import type { PersistenceAdapter } from './adapter';
import { BrowserPersistenceAdapter } from './browserAdapter';

export type { GeometryBackend, PersistenceAdapter } from './adapter';
export * from './schema';
export { startPersistence, toGeometry, toPrefs, layersBy } from './sync';

/** The page's one persistence adapter. */
export const persistence: PersistenceAdapter = new BrowserPersistenceAdapter();
