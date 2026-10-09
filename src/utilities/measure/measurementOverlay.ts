import type { Feature, FeatureCollection } from 'geojson';
import { LABEL_PAINT, labelLayout } from '../../map/labelStyle';
import { mapService } from '../../map/MapService';
import type { LayerSpecification, ScaleUnit } from '../../map/types';
import { formatArea, formatDistance, type Lang } from './format';
import type { SavedMeasurement } from './types';

export const MEASURE_SOURCE = 'ws:measurements';
const COLOR = '#ffb020';

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
    layout: { ...labelLayout(['get', 'label']), 'symbol-placement': 'line-center' },
    paint: LABEL_PAINT,
  },
  {
    id: 'ws:measurements:label-area',
    type: 'symbol',
    source: MEASURE_SOURCE,
    filter: ['==', ['geometry-type'], 'Polygon'],
    layout: labelLayout(['get', 'label']),
    paint: LABEL_PAINT,
  },
] as LayerSpecification[];

export const MEASURE_LAYER_IDS = LAYERS.map((l) => l.id);

/** The stored value (metres or square metres) in the user's display units. */
export function measurementValue(m: Pick<SavedMeasurement, 'kind' | 'value'>, units: ScaleUnit, lang: Lang): string {
  return m.kind === 'distance' ? formatDistance(m.value, units, lang) : formatArea(m.value, units, lang);
}

export function toFeatureCollection(ms: SavedMeasurement[], units: ScaleUnit, lang: Lang): FeatureCollection {
  const features: Feature[] = ms
    .filter((m) => m.visible)
    .map((m) => ({
      type: 'Feature',
      properties: { mid: m.id, label: `${m.name} · ${measurementValue(m, units, lang)}` },
      geometry: m.geometry,
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
