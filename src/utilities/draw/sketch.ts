import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { MapLayerStyle } from '../../layers/layerTypes';
import { useWorkspace } from '../../store/workspaceStore';

/** Fixed id: there is one Sketch layer per workspace (UTL-05). */
export const SKETCH_LAYER_ID = 'sketch';
export const SKETCH_OWNER = 'measure';

const COLOR = '#ff6a3d';
const SKETCH_STYLES: MapLayerStyle[] = [
  {
    type: 'fill',
    filter: ['in', ['geometry-type'], ['literal', ['Polygon', 'MultiPolygon']]],
    paint: { 'fill-color': COLOR, 'fill-opacity': 0.22 },
  },
  {
    type: 'line',
    filter: ['in', ['geometry-type'], ['literal', ['Polygon', 'MultiPolygon', 'LineString', 'MultiLineString']]],
    paint: { 'line-color': COLOR, 'line-width': 2.5 },
  },
  {
    type: 'circle',
    filter: ['in', ['geometry-type'], ['literal', ['Point', 'MultiPoint']]],
    paint: { 'circle-color': COLOR, 'circle-radius': 6, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 },
  },
];

function sketchData(): FeatureCollection {
  const layer = useWorkspace.getState().layers[SKETCH_LAYER_ID];
  const data = (layer?.source as { data?: FeatureCollection } | undefined)?.data;
  return data?.type === 'FeatureCollection' ? data : { type: 'FeatureCollection', features: [] };
}

function write(features: Feature[], name: string): void {
  const s = useWorkspace.getState();
  const source = { type: 'geojson' as const, data: { type: 'FeatureCollection' as const, features } };
  if (s.layers[SKETCH_LAYER_ID]) {
    s.updateLayer(SKETCH_LAYER_ID, { source });
    return;
  }
  // Temporary geometry: survives a refresh, not closing the tab (owner decision, spec §9 UTL-05).
  s.addLayer({
    id: SKETCH_LAYER_ID,
    name,
    type: 'geojson',
    group: 'sketch',
    persist: 'session',
    ownerToolId: SKETCH_OWNER,
    source,
    mapLayers: SKETCH_STYLES,
  });
}

/** Appends a finished shape; creates the Sketch layer on first use (or after it was removed). */
export function addToSketch(feature: Feature<Geometry>, layerName: string): void {
  const n = sketchData().features.length;
  write([...sketchData().features, { ...feature, id: Date.now() + n, properties: { ...feature.properties } }], layerName);
}

export function sketchCount(): number {
  return sketchData().features.length;
}

export function removeLastSketch(layerName: string): void {
  const features = sketchData().features;
  if (features.length > 0) write(features.slice(0, -1), layerName);
}

export function clearSketch(layerName: string): void {
  if (useWorkspace.getState().layers[SKETCH_LAYER_ID]) write([], layerName);
}
