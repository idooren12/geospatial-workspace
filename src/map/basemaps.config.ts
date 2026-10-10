import type { BasemapDefinition } from './types';

/**
 * Esri World Imagery tiles. With an ArcGIS Location Platform API key (Vercel env
 * `VITE_ARCGIS_API_KEY`, see docs/ENV.md) tiles come from the keyed endpoint, counted against that
 * account; without one, from the anonymous public endpoint (development/evaluation only).
 * The key is a *public* client key: it is inlined into the bundle by design and must be limited to
 * the Basemaps privilege and to the site's referrers in the ArcGIS dashboard.
 */
export function esriImageryTiles(apiKey: string | undefined): string[] {
  const key = apiKey?.trim();
  return key
    ? [`https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?token=${encodeURIComponent(key)}`]
    : ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'];
}

/** True when the build carries an ArcGIS key (shown nowhere; used by tests and docs). */
export const ESRI_KEYED = !!import.meta.env.VITE_ARCGIS_API_KEY?.trim();

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
    placeholder: { light: '#f2f3f0', dark: '#1b1d20' },
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
    // Esri World Imagery under the Esri Master License Agreement (docs/ATTRIBUTION.md). Keyed through
    // ArcGIS Location Platform when VITE_ARCGIS_API_KEY is set, else the public endpoint. Esri requires
    // "Powered by Esri" plus the layer's own credits — shown in both cases.
    imagery: {
      tiles: esriImageryTiles(import.meta.env.VITE_ARCGIS_API_KEY),
      tileSize: 256,
      maxzoom: 19,
      attribution:
        'Powered by <a href="https://www.esri.com/" target="_blank" rel="noopener">Esri</a> | ' +
        'Imagery: Esri, Vantor, Earthstar Geographics, and the GIS User Community',
    },
    placeholder: { light: '#2b3226', dark: '#2b3226' },
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
