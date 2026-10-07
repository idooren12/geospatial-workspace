import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { MapLayerStyle, WorkspaceLayer } from '../../layers/layerTypes';
import { useWorkspace } from '../../store/workspaceStore';

/** Owner tag for layers the Draw panel creates. */
export const DRAW_OWNER = 'draw';
export const DRAWING_GROUP = 'drawing';
/** Earlier versions kept one session "sketch" layer; it is treated as a drawing layer too. */
const LEGACY_SKETCH_ID = 'sketch';

export type DrawingKind = 'point' | 'line' | 'polygon';

export interface DrawingFeature extends Feature<Geometry> {
  properties: { fid: string; name: string; kind: DrawingKind };
}

/** Each drawing layer gets its own colour so groups read apart on the map. */
const PALETTE = ['#ff6a3d', '#3d8bfd', '#22a06b', '#d6a400', '#9b5de5', '#e5487f'];

const LABEL_LAYOUT = {
  'text-field': ['get', 'name'],
  'text-font': ['Noto Sans Bold'],
  'text-size': 13,
  'text-max-width': 12,
} as const;
const LABEL_PAINT = { 'text-color': '#16181b', 'text-halo-color': '#ffffff', 'text-halo-width': 2, 'text-halo-blur': 0.5 };

const isPoly = ['in', ['geometry-type'], ['literal', ['Polygon', 'MultiPolygon']]];
const isLine = ['in', ['geometry-type'], ['literal', ['LineString', 'MultiLineString']]];
const isPoint = ['in', ['geometry-type'], ['literal', ['Point', 'MultiPoint']]];

/** Shapes plus their names drawn on the map (owner: a name nobody can see is pointless). */
export function drawingStyles(color: string): MapLayerStyle[] {
  return [
    { type: 'fill', filter: isPoly, paint: { 'fill-color': color, 'fill-opacity': 0.22 } },
    {
      type: 'line',
      filter: ['any', isPoly, isLine],
      paint: { 'line-color': color, 'line-width': 2.5 },
    },
    {
      type: 'circle',
      filter: isPoint,
      paint: { 'circle-color': color, 'circle-radius': 6, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 },
    },
    {
      type: 'symbol',
      filter: isPoint,
      layout: { ...LABEL_LAYOUT, 'text-anchor': 'top', 'text-offset': [0, 0.9] },
      paint: LABEL_PAINT,
    },
    {
      type: 'symbol',
      filter: isLine,
      layout: { ...LABEL_LAYOUT, 'symbol-placement': 'line-center' },
      paint: LABEL_PAINT,
    },
    { type: 'symbol', filter: isPoly, layout: LABEL_LAYOUT, paint: LABEL_PAINT },
  ] as MapLayerStyle[];
}

export const isDrawingLayer = (l: WorkspaceLayer | undefined): l is WorkspaceLayer =>
  !!l && (l.group === DRAWING_GROUP || l.id === LEGACY_SKETCH_ID);

/** Drawing layers, top of the map first (like the Layers panel). */
export function drawingLayers(): WorkspaceLayer[] {
  const s = useWorkspace.getState();
  return [...s.layerOrder].reverse().map((id) => s.layers[id]).filter(isDrawingLayer);
}

export function featuresOf(layer: WorkspaceLayer | undefined): DrawingFeature[] {
  const data = (layer?.source as { data?: FeatureCollection } | undefined)?.data;
  if (data?.type !== 'FeatureCollection') return [];
  return data.features.map((f, i) => {
    const p = (f.properties ?? {}) as Partial<DrawingFeature['properties']>;
    const kind: DrawingKind = p.kind ?? (f.geometry?.type === 'Point' ? 'point' : f.geometry?.type === 'Polygon' ? 'polygon' : 'line');
    return { ...f, properties: { fid: p.fid ?? `f${i}`, name: p.name ?? '', kind } } as DrawingFeature;
  });
}

function writeFeatures(layerId: string, features: DrawingFeature[]): void {
  useWorkspace.getState().updateLayer(layerId, {
    source: { type: 'geojson', data: { type: 'FeatureCollection', features } },
  });
}

/** Creates an empty drawing layer and makes it the draw target. */
export function createDrawingLayer(name: string): string {
  const s = useWorkspace.getState();
  const color = PALETTE[drawingLayers().length % PALETTE.length]!;
  const id = s.addLayer({
    name,
    type: 'geojson',
    group: DRAWING_GROUP,
    persist: 'local',
    ownerToolId: DRAW_OWNER,
    source: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
    mapLayers: drawingStyles(color),
  });
  s.setDrawTarget(id);
  return id;
}

/** The current target, falling back to the topmost drawing layer; null when there is none. */
export function currentTarget(): WorkspaceLayer | null {
  const s = useWorkspace.getState();
  const t = s.drawTargetId ? s.layers[s.drawTargetId] : undefined;
  if (isDrawingLayer(t)) return t;
  return drawingLayers()[0] ?? null;
}

let fidSeq = 0;

/**
 * Adds a finished shape to the target layer (created on first use). Every shape gets a name —
 * "<kind> <n>" — so it can be labelled on the map and found in lists.
 */
export function addDrawing(
  feature: Feature<Geometry>,
  kind: DrawingKind,
  names: { kind: (kind: DrawingKind, n: number) => string; newLayer: (n: number) => string },
): { layerId: string; fid: string } {
  let target = currentTarget();
  if (!target) {
    const id = createDrawingLayer(names.newLayer(drawingLayers().length + 1));
    target = useWorkspace.getState().layers[id]!;
  }
  const existing = featuresOf(target);
  const n = existing.filter((f) => f.properties.kind === kind).length + 1;
  const fid = `d${Date.now().toString(36)}${(fidSeq++).toString(36)}`;
  const added: DrawingFeature = {
    type: 'Feature',
    geometry: feature.geometry,
    properties: { fid, name: names.kind(kind, n), kind },
  };
  writeFeatures(target.id, [...existing, added]);
  useWorkspace.getState().setDrawTarget(target.id);
  return { layerId: target.id, fid };
}

export function renameDrawing(layerId: string, fid: string, name: string): void {
  const layer = useWorkspace.getState().layers[layerId];
  const n = name.trim();
  if (!layer || !n) return;
  writeFeatures(
    layerId,
    featuresOf(layer).map((f) => (f.properties.fid === fid ? { ...f, properties: { ...f.properties, name: n } } : f)),
  );
}

export function removeDrawing(layerId: string, fid: string): void {
  const layer = useWorkspace.getState().layers[layerId];
  if (layer) writeFeatures(layerId, featuresOf(layer).filter((f) => f.properties.fid !== fid));
}
