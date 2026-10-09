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
    licence: {
      providers: ['OpenFreeMap', 'OpenMapTiles', 'OpenStreetMap contributors'],
      terms: ['OpenFreeMap Terms of Service (free, no key)', 'OpenMapTiles: CC-BY 4.0', 'OpenStreetMap data: ODbL 1.0'],
      requiredCredit: ['OpenFreeMap', 'OpenMapTiles', 'OpenStreetMap'],
    },
    // The stock dark style's labels are too dim to read; lift them.
    labelPaint: {
      dark: { 'text-color': '#c9ced4', 'text-halo-color': '#0e1013', 'text-halo-width': 1.2 },
    },
  },
  {
    id: 'satellite',
    nameKey: 'basemap.satellite',
    icon: 'satellite',
    kind: 'raster',
    // Esri World Imagery, public endpoint, no key. Licensed under the Esri Master License Agreement:
    // see docs/ATTRIBUTION.md (open decision: production use needs an ArcGIS account/key or another
    // provider). Esri requires "Powered by Esri" plus the layer's own credits, both shown here.
    imagery: {
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      maxzoom: 19,
      attribution:
        'Powered by <a href="https://www.esri.com/" target="_blank" rel="noopener">Esri</a> | ' +
        'Imagery: Esri, Vantor, Earthstar Geographics, and the GIS User Community',
    },
    licence: {
      providers: ['Esri', 'Vantor', 'Earthstar Geographics', 'GIS User Community', 'OpenFreeMap (labels)'],
      terms: ['Esri Master License Agreement', 'labels: as the Map basemap'],
      requiredCredit: ['Powered by Esri', 'Esri, Vantor, Earthstar Geographics'],
      openDecision: 'Production use of Esri basemaps needs an ArcGIS account/key or another provider (docs/ATTRIBUTION.md).',
    },
    // Borders and place names on top of the imagery; their sources carry the OpenFreeMap /
    // OpenMapTiles / OpenStreetMap credits, which MapLibre adds to the attribution automatically.
    labelsStyleUrl: 'https://tiles.openfreemap.org/styles/positron',
  },
];

export const DEFAULT_BASEMAP_ID = 'map';
