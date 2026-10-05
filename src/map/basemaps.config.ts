import type { BasemapDefinition } from './types';

/**
 * The ONLY place basemap provider URLs may appear.
 * Adding Satellite / Terrain / Marine later = one more entry here.
 */
export const BASEMAPS: readonly BasemapDefinition[] = [
  {
    id: 'light',
    nameKey: 'basemap.light',
    styleUrl: 'https://tiles.openfreemap.org/styles/positron',
    kind: 'vector',
  },
  {
    id: 'dark',
    nameKey: 'basemap.dark',
    styleUrl: 'https://tiles.openfreemap.org/styles/dark',
    kind: 'vector',
    dark: true,
  },
];

export const DEFAULT_BASEMAP_ID = 'light';
