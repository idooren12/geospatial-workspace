import { BASEMAPS, DEFAULT_BASEMAP_ID } from './basemaps.config';
import type { BasemapDefinition } from './types';

/** Owns the list of available basemaps; nothing else in the app knows provider URLs. */
export const BasemapManager = {
  list(): readonly BasemapDefinition[] {
    return BASEMAPS;
  },

  get(id: string): BasemapDefinition | undefined {
    return BASEMAPS.find((b) => b.id === id);
  },

  /** Returns the requested basemap, falling back to the default for unknown ids (e.g. stale storage). */
  resolve(id: string | undefined): BasemapDefinition {
    const found = id ? BasemapManager.get(id) : undefined;
    if (found) return found;
    const fallback = BasemapManager.get(DEFAULT_BASEMAP_ID) ?? BASEMAPS[0];
    if (!fallback) throw new Error('No basemaps configured');
    return fallback;
  },

  /** Next basemap in the list, for a quick toggle. */
  next(id: string): BasemapDefinition {
    const i = BASEMAPS.findIndex((b) => b.id === id);
    return BASEMAPS[(i + 1) % BASEMAPS.length] ?? BasemapManager.resolve(undefined);
  },
};
