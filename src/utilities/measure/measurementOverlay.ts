import type { Feature, FeatureCollection } from 'geojson';
import { mapService } from '../../map/MapService';
import type { LayerSpecification, ScaleUnit } from '../../map/types';
import { formatArea, formatDistance, type Lang } from './format';
import { areaSquareMeters, lengthMeters } from './geodesic';
import type { SavedMeasurement } from './types';

export const MEASURE_SOURCE = 'ws:measurements';
const COLOR = '#ffb020';

const LABEL_LAYOUT = {
  'text-field': ['get', 'label'],
  'text-font': ['Noto Sans Bold'],
  'text-size': 13,
  'text-max-width': 14,
};
const LABEL_PAINT = { 'text-color': '#16181b', 'text-halo-color': '#ffffff', 'text-halo-width': 2, 'text-halo-blur': 0.5 };

/** Saved measurements on the map: dashed amber shapes with "name · value" labels. */
const LAYERS: LayerSpecification[] = [
  {
    id: 'ws:measurements:fill',
    type: 'fill',
    source: MEASURE_SOURCE,
    filter: ['==', ['geometry-type'], 'Polygon'],
    paint: { 'fill-color': COLOR, 'fill-opacity': 0.15 },
  },
  {
    id: 'ws:measurements:line',
    type: 'line',
    source: MEASURE_SOURCE,
    paint: { 'line-color': COLOR, 'line-width': 2.5, 'line-dasharray': [2, 1.5] },
  },
  {
    id: 'ws:measurements:label-line',
    type: 'symbol',
    source: MEASURE_SOURCE,
    filter: ['==', ['geometry-type'], 'LineString'],
    layout: { ...LABEL_LAYOUT, 'symbol-placement': 'line-center' },
    paint: LABEL_PAINT,
  },
  {
    id: 'ws:measurements:label-area',
    type: 'symbol',
    source: MEASURE_SOURCE,
    filter: ['==', ['geometry-type'], 'Polygon'],
    layout: LABEL_LAYOUT,
    paint: LABEL_PAINT,
  },
] as LayerSpecification[];

export const MEASURE_LAYER_IDS = LAYERS.map((l) => l.id);

export function measurementValue(m: Pick<SavedMeasurement, 'kind' | 'coordinates'>, units: ScaleUnit, lang: Lang): string {
  return m.kind === 'distance'
    ? formatDistance(lengthMeters(m.coordinates), units, lang)
    : formatArea(areaSquareMeters(m.coordinates), units, lang);
}

export function toFeatureCollection(ms: SavedMeasurement[], units: ScaleUnit, lang: Lang): FeatureCollection {
  const features: Feature[] = ms
    .filter((m) => m.visible)
    .map((m) => ({
      type: 'Feature',
      properties: { mid: m.id, label: `${m.name} · ${measurementValue(m, units, lang)}` },
      geometry:
        m.kind === 'distance'
          ? { type: 'LineString', coordinates: m.coordinates }
          : { type: 'Polygon', coordinates: [[...m.coordinates, m.coordinates[0]!]] },
    }));
  return { type: 'FeatureCollection', features };
}

let added = false;

/** Keeps the map in step with the saved list. MapService restores it after basemap switches. */
export function syncMeasurements(ms: SavedMeasurement[], units: ScaleUnit, lang: Lang): void {
  mapService.addSource(MEASURE_SOURCE, { type: 'geojson', data: toFeatureCollection(ms, units, lang) });
  if (added) return;
  added = true;
  for (const l of LAYERS) mapService.addOverlayLayer(l); // always above drawings and tool layers
}
