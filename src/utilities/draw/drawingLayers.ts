import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { MapLayerStyle, WorkspaceLayer } from '../../layers/layerTypes';
import { history } from '../../history/history';
import i18n from '../../i18n';
import { LABEL_PAINT, labelLayout, POINT_LABEL_OFFSET } from '../../map/labelStyle';
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

const isPoly = ['in', ['geometry-type'], ['literal', ['Polygon', 'MultiPolygon']]];
const isLine = ['in', ['geometry-type'], ['literal', ['LineString', 'MultiLineString']]];
const isPoint = ['in', ['geometry-type'], ['literal', ['Point', 'MultiPoint']]];
const NAME = ['get', 'name'];

/**
 * Shapes plus their names drawn on the map (owner: a name nobody can see is pointless). Labels sit
 * on a light pill so they stay readable on light, dark and satellite basemaps alike.
 */
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
    { type: 'symbol', filter: isPoint, layout: { ...labelLayout(NAME), ...POINT_LABEL_OFFSET }, paint: LABEL_PAINT },
    { type: 'symbol', filter: isLine, layout: { ...labelLayout(NAME), 'symbol-placement': 'line-center' }, paint: LABEL_PAINT },
    { type: 'symbol', filter: isPoly, layout: labelLayout(NAME), paint: LABEL_PAINT },
  ] as MapLayerStyle[];
}

/** The colour a drawing layer was given (kept in its metadata; older layers: read from the style). */
function colorOf(layer: WorkspaceLayer): string {
  const meta = layer.metadata?.color;
  if (typeof meta === 'string') return meta;
  const fill = layer.mapLayers.find((l) => l.type === 'fill') as { paint?: Record<string, unknown> } | undefined;
  const c = fill?.paint?.['fill-color'];
  return typeof c === 'string' ? c : PALETTE[0]!;
}

/**
 * Stored drawing layers carry the styles of the version that created them. Re-derive them from the
 * layer colour at startup, so label and style improvements reach existing drawings too.
 */
export function refreshDrawingStyles(): void {
  const s = useWorkspace.getState();
  for (const layer of Object.values(s.layers)) {
    if (!isDrawingLayer(layer)) continue;
    const color = colorOf(layer);
    s.updateLayer(layer.id, { mapLayers: drawingStyles(color), metadata: { ...layer.metadata, source: DRAW_OWNER, color } });
  }
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
    metadata: { source: DRAW_OWNER, color, createdAt: Date.now() },
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

function insertFeature(layerId: string, feature: DrawingFeature, index: number): void {
  const layer = useWorkspace.getState().layers[layerId];
  if (!layer) return;
  const list = featuresOf(layer).filter((f) => f.properties.fid !== feature.properties.fid);
  list.splice(Math.max(0, Math.min(list.length, index)), 0, feature);
  writeFeatures(layerId, list);
}

function deleteFeature(layerId: string, fid: string): void {
  const layer = useWorkspace.getState().layers[layerId];
  if (layer) writeFeatures(layerId, featuresOf(layer).filter((f) => f.properties.fid !== fid));
}

/**
 * Adds a finished shape to the target layer (created on first use). Every shape gets a name —
 * "<kind> <n>" — so it can be labelled on the map and found in lists. Undoable: undo removes the
 * shape, and the layer too if this shape created it.
 */
export function addDrawing(
  feature: Feature<Geometry>,
  kind: DrawingKind,
  names: { kind: (kind: DrawingKind, n: number) => string; newLayer: (n: number) => string },
): { layerId: string; fid: string } {
  let target = currentTarget();
  const created = !target;
  if (!target) {
    const id = createDrawingLayer(names.newLayer(drawingLayers().length + 1));
    target = useWorkspace.getState().layers[id]!;
  }
  const layerId = target.id;
  const existing = featuresOf(target);
  const n = existing.filter((f) => f.properties.kind === kind).length + 1;
  const fid = `d${Date.now().toString(36)}${(fidSeq++).toString(36)}`;
  const added: DrawingFeature = {
    type: 'Feature',
    geometry: feature.geometry,
    properties: { fid, name: names.kind(kind, n), kind },
  };
  writeFeatures(layerId, [...existing, added]);
  useWorkspace.getState().setDrawTarget(layerId);

  const s = () => useWorkspace.getState();
  const layerAfter = s().layers[layerId]!;
  const layerIndex = s().layerOrder.indexOf(layerId);
  history.push({
    label: i18n.t('history.addDrawing', { name: added.properties.name }),
    undo: () => (created ? s().removeLayer(layerId) : deleteFeature(layerId, fid)),
    redo: () => (created ? s().restoreLayer(layerAfter, layerIndex) : insertFeature(layerId, added, existing.length)),
  });
  return { layerId, fid };
}

/** Renames a shape (undoable). */
export function renameDrawing(layerId: string, fid: string, name: string): void {
  const layer = useWorkspace.getState().layers[layerId];
  const after = name.trim();
  const before = featuresOf(layer).find((f) => f.properties.fid === fid)?.properties.name;
  if (!layer || !after || before === undefined || before === after) return;
  const set = (n: string) => {
    const l = useWorkspace.getState().layers[layerId];
    if (l) writeFeatures(layerId, featuresOf(l).map((f) => (f.properties.fid === fid ? { ...f, properties: { ...f.properties, name: n } } : f)));
  };
  history.run({ label: i18n.t('history.rename', { name: after }), redo: () => set(after), undo: () => set(before) });
}

/** Deletes one shape at once; Undo is offered in a toast (single-item delete). */
export function removeDrawing(layerId: string, fid: string): void {
  const list = featuresOf(useWorkspace.getState().layers[layerId]);
  const index = list.findIndex((f) => f.properties.fid === fid);
  const feature = list[index];
  if (!feature) return;
  const sel = useWorkspace.getState().selection;
  if (sel?.kind === 'feature' && sel.featureId === fid) useWorkspace.getState().select(null);
  history.run(
    {
      label: i18n.t('history.deleteDrawing', { name: feature.properties.name }),
      redo: () => deleteFeature(layerId, fid),
      undo: () => insertFeature(layerId, feature, index),
    },
    { toast: true },
  );
}
