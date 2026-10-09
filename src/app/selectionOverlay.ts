import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { LABEL_PAINT_SELECTED, labelLayout, POINT_LABEL_OFFSET } from '../map/labelStyle';
import { mapService } from '../map/MapService';
import type { LayerSpecification } from '../map/types';
import type { Selection, WorkspaceState } from '../store/workspaceStore';
import type { Lang } from '../utilities/measure/format';
import { measurementValue } from '../utilities/measure/measurementOverlay';

export const SELECTION_SOURCE = 'ws:selection';
const ACCENT = '#3d8bfd';
/** A layer selected as a whole highlights at most this many features (keeps big layers cheap). */
const MAX_FEATURES = 500;

const isPoint = ['in', ['geometry-type'], ['literal', ['Point', 'MultiPoint']]];
const isPoly = ['in', ['geometry-type'], ['literal', ['Polygon', 'MultiPolygon']]];
const isLine = ['in', ['geometry-type'], ['literal', ['LineString', 'MultiLineString']]];
const labelled = ['!=', ['get', 'label'], ''];

/**
 * The selected item drawn over everything: a white casing plus an accent outline, and its name on
 * an accent label. It never moves the camera (owner: selecting in a list must not recenter).
 */
const LAYERS = [
  { id: 'ws:selection:fill', type: 'fill', filter: isPoly, paint: { 'fill-color': ACCENT, 'fill-opacity': 0.12 } },
  { id: 'ws:selection:casing', type: 'line', filter: ['!', isPoint], paint: { 'line-color': '#ffffff', 'line-width': 7, 'line-opacity': 0.9 } },
  { id: 'ws:selection:line', type: 'line', filter: ['!', isPoint], paint: { 'line-color': ACCENT, 'line-width': 3.5 } },
  {
    id: 'ws:selection:point',
    type: 'circle',
    filter: isPoint,
    paint: { 'circle-radius': 11, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': ACCENT, 'circle-stroke-width': 3 },
  },
  {
    id: 'ws:selection:label-point',
    type: 'symbol',
    filter: ['all', isPoint, labelled],
    layout: { ...labelLayout(['get', 'label'], true), ...POINT_LABEL_OFFSET, 'text-allow-overlap': true, 'icon-allow-overlap': true },
    paint: LABEL_PAINT_SELECTED,
  },
  {
    id: 'ws:selection:label-line',
    type: 'symbol',
    filter: ['all', isLine, labelled],
    layout: { ...labelLayout(['get', 'label'], true), 'symbol-placement': 'line-center', 'text-allow-overlap': true, 'icon-allow-overlap': true },
    paint: LABEL_PAINT_SELECTED,
  },
  {
    id: 'ws:selection:label-area',
    type: 'symbol',
    filter: ['all', isPoly, labelled],
    layout: { ...labelLayout(['get', 'label'], true), 'text-allow-overlap': true, 'icon-allow-overlap': true },
    paint: LABEL_PAINT_SELECTED,
  },
].map((l) => ({ ...l, source: SELECTION_SOURCE })) as LayerSpecification[];

export const SELECTION_LAYER_IDS = LAYERS.map((l) => l.id);

const feature = (geometry: Geometry, label: string): Feature => ({ type: 'Feature', geometry, properties: { label } });

/** What to highlight for a selection; nothing for hidden or missing items. */
export function selectionFeatures(sel: Selection | null, s: Pick<WorkspaceState, 'layers' | 'measurements' | 'settings'>): Feature[] {
  if (!sel) return [];
  if (sel.kind === 'measurement') {
    const m = s.measurements.find((x) => x.id === sel.id);
    if (!m || !m.visible) return [];
    return [feature(m.geometry, `${m.name} · ${measurementValue(m, s.settings.units, s.settings.language as Lang)}`)];
  }
  const layer = s.layers[sel.layerId];
  if (!layer || !layer.visible) return [];
  const data = (layer.source as { data?: FeatureCollection } | undefined)?.data;
  if (data?.type !== 'FeatureCollection') return [];
  const name = (f: Feature) => {
    const n = f.properties?.name;
    return typeof n === 'string' ? n : '';
  };
  if (sel.kind === 'feature') {
    const f = data.features.find((x) => x.properties?.fid === sel.featureId);
    return f?.geometry ? [feature(f.geometry, name(f))] : [];
  }
  return data.features
    .filter((f) => f.geometry)
    .slice(0, MAX_FEATURES)
    .map((f) => feature(f.geometry!, ''));
}

let added = false;

/** Keeps the highlight in step with the selection (and with edits to the selected item). */
export function syncSelection(s: WorkspaceState): void {
  mapService.addSource(SELECTION_SOURCE, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: selectionFeatures(s.selection, s) },
  });
  if (added) return;
  added = true;
  for (const l of LAYERS) mapService.addOverlayLayer(l);
}
