import type { MapLayerStyle, WorkspaceLayer } from './layerTypes';

const COLOR = '#3d8bfd';
const HALO = '#ffffff';

/** Fill + outline for polygons, a line for lines, circles for points — each filtered by geometry. */
const GEOJSON_DEFAULT: MapLayerStyle[] = [
  {
    type: 'fill',
    filter: ['in', ['geometry-type'], ['literal', ['Polygon', 'MultiPolygon']]],
    paint: { 'fill-color': COLOR, 'fill-opacity': 0.25 },
  },
  {
    type: 'line',
    filter: ['in', ['geometry-type'], ['literal', ['Polygon', 'MultiPolygon', 'LineString', 'MultiLineString']]],
    paint: { 'line-color': COLOR, 'line-width': 2 },
  },
  {
    type: 'circle',
    filter: ['in', ['geometry-type'], ['literal', ['Point', 'MultiPoint']]],
    paint: { 'circle-color': COLOR, 'circle-radius': 5, 'circle-stroke-color': HALO, 'circle-stroke-width': 1.5 },
  },
];

/** The styles actually drawn: the layer's own, or defaults for its type. */
export function stylesFor(layer: WorkspaceLayer): MapLayerStyle[] {
  if (layer.mapLayers.length > 0) return layer.mapLayers;
  if (layer.type === 'geojson') return GEOJSON_DEFAULT;
  if (layer.type === 'raster') return [{ type: 'raster' }];
  return []; // vector needs explicit styles (source-layer); custom draws itself
}
