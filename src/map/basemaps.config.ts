import type { BasemapDefinition } from './types';

/**
 * The ONLY place basemap provider URLs may appear.
 * Adding Terrain / Marine later = one more entry here (plus an i18n name).
 */
export const BASEMAPS: readonly BasemapDefinition[] = [
  {
    id: 'map',
    nameKey: 'basemap.map',
    icon: 'map',
    kind: 'vector',
    styles: {
      light: 'https://tiles.openfreemap.org/styles/positron',
      dark: 'https://tiles.openfreemap.org/styles/dark',
    },
  },
  {
    id: 'satellite',
    nameKey: 'basemap.satellite',
    icon: 'satellite',
    kind: 'raster',
    // Open decision (docs/DECISIONS.md): Esri's public endpoint, no key. Swap for MapTiler or an
    // ArcGIS Location Platform key here if the terms require it; nothing else changes.
    imagery: {
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      maxzoom: 19,
      attribution: 'Imagery © Esri, Maxar, Earthstar Geographics',
    },
    labelsStyleUrl: 'https://tiles.openfreemap.org/styles/positron',
  },
];

export const DEFAULT_BASEMAP_ID = 'map';
