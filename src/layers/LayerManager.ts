import type { GeoJSON } from 'geojson';
import { OPACITY_PROPS } from '../map/opacity';
import type { LayerSpecification, SourceSpecification } from '../map/types';
import { stylesFor } from './defaultStyles';
import { isMapSource, type MapLayerStyle, type WorkspaceLayer } from './layerTypes';

/** The map operations the LayerManager needs — MapService satisfies it; tests use a fake. */
export interface LayerTarget {
  addSource(id: string, spec: SourceSpecification): void;
  removeSource(id: string): void;
  setGeoJSONData(id: string, data: GeoJSON): void;
  addLayer(spec: LayerSpecification, beforeId?: string): void;
  removeLayer(id: string): void;
  setLayerVisibility(id: string, visible: boolean): void;
  setPaintProperty(id: string, prop: string, value: unknown): void;
  moveLayer(id: string, beforeId?: string): void;
  getLayerOrder(): string[];
}

export const sourceIdOf = (layerId: string) => `ws:${layerId}`;
export const mapLayerIdOf = (layerId: string, n: number) => `ws:${layerId}:${n}`;

/** Paint with every opacity property scaled by the workspace opacity (style opacity × layer opacity). */
function scaledPaint(style: MapLayerStyle, opacity: number): Record<string, unknown> {
  const paint: Record<string, unknown> = { ...(style as { paint?: Record<string, unknown> }).paint };
  for (const p of OPACITY_PROPS[style.type] ?? []) {
    const base = typeof paint[p] === 'number' ? (paint[p] as number) : 1;
    paint[p] = base * opacity;
  }
  return paint;
}

function geojsonData(layer: WorkspaceLayer): GeoJSON | undefined {
  const src = layer.source as { type?: string; data?: unknown } | undefined;
  return src?.type === 'geojson' && typeof src.data === 'object' ? (src.data as GeoJSON) : undefined;
}

/**
 * Keeps MapLibre in step with the store's workspace layers by diffing (spec §7). The store is the
 * source of truth; UI, tools and restored state all change the store, never the map directly.
 * Basemap switches are handled below this, by MapService restoring every `ws:` layer.
 */
export class LayerManager {
  private applied = new Map<string, WorkspaceLayer>();
  /** Layers whose map styles failed to add (bad spec from a tool). */
  readonly errors = new Map<string, string>();

  private readonly target: LayerTarget;

  constructor(target: LayerTarget) {
    this.target = target;
  }

  sync(layers: Readonly<Record<string, WorkspaceLayer>>, order: readonly string[]): void {
    // 1. Removed layers.
    for (const [id, prev] of this.applied) {
      if (!layers[id]) {
        this.remove(prev);
        this.applied.delete(id);
      }
    }
    // 2. Added and changed layers.
    for (const id of order) {
      const cur = layers[id];
      if (!cur) continue;
      const prev = this.applied.get(id);
      if (!prev) {
        this.add(cur);
      } else if (prev !== cur) {
        this.update(prev, cur);
      }
      this.applied.set(id, cur);
    }
    // 3. Z-order: bottom → top as in `order`.
    const present = new Set(this.target.getLayerOrder());
    const desired = order.flatMap((id) => (layers[id] ? this.mapLayerIds(layers[id]!) : [])).filter((id) => present.has(id));
    const wanted = new Set(desired);
    const current = [...present].filter((id) => wanted.has(id));
    if (current.join('\n') !== desired.join('\n')) {
      for (const id of desired) this.target.moveLayer(id); // each to the top, in order
    }
  }

  private mapLayerIds(layer: WorkspaceLayer): string[] {
    return stylesFor(layer).map((_, n) => mapLayerIdOf(layer.id, n));
  }

  private add(layer: WorkspaceLayer): void {
    this.errors.delete(layer.id);
    try {
      if (isMapSource(layer)) this.target.addSource(sourceIdOf(layer.id), layer.source);
      stylesFor(layer).forEach((style, n) => {
        const spec = {
          ...style,
          id: mapLayerIdOf(layer.id, n),
          ...(style.type === 'background' ? {} : { source: sourceIdOf(layer.id) }),
          layout: { ...(style as { layout?: object }).layout, visibility: layer.visible ? 'visible' : 'none' },
          paint: scaledPaint(style, layer.opacity),
        } as LayerSpecification;
        this.target.addLayer(spec);
      });
    } catch (e) {
      // A tool handed us a bad spec: keep the workspace running and remember why.
      this.errors.set(layer.id, e instanceof Error ? e.message : String(e));
      console.warn(`[gws] layer "${layer.id}" could not be drawn:`, e);
    }
  }

  private remove(layer: WorkspaceLayer): void {
    const order = new Set(this.target.getLayerOrder());
    for (const id of this.mapLayerIds(layer)) if (order.has(id)) this.target.removeLayer(id);
    if (isMapSource(layer)) {
      try {
        this.target.removeSource(sourceIdOf(layer.id));
      } catch {
        /* never added (failed spec) */
      }
    }
    this.errors.delete(layer.id);
  }

  private update(prev: WorkspaceLayer, cur: WorkspaceLayer): void {
    const prevData = geojsonData(prev);
    const curData = geojsonData(cur);
    const onlyDataChanged =
      prev.source !== cur.source &&
      prevData !== undefined &&
      curData !== undefined &&
      JSON.stringify({ ...(prev.source as object), data: 0 }) === JSON.stringify({ ...(cur.source as object), data: 0 });

    const structural =
      prev.type !== cur.type || prev.mapLayers !== cur.mapLayers || (prev.source !== cur.source && !onlyDataChanged);
    if (structural || this.errors.has(cur.id)) {
      this.remove(prev);
      this.add(cur);
      return;
    }
    if (onlyDataChanged) this.target.setGeoJSONData(sourceIdOf(cur.id), curData);
    if (prev.visible !== cur.visible) {
      for (const id of this.mapLayerIds(cur)) this.target.setLayerVisibility(id, cur.visible);
    }
    if (prev.opacity !== cur.opacity) {
      stylesFor(cur).forEach((style, n) => {
        const paint = scaledPaint(style, cur.opacity);
        for (const p of OPACITY_PROPS[style.type] ?? []) this.target.setPaintProperty(mapLayerIdOf(cur.id, n), p, paint[p]);
      });
    }
  }
}
