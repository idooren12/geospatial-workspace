import type { LayerSpecification, SourceSpecification } from '../map/types';

export const LAYER_TYPES = ['geojson', 'vector', 'raster', 'custom'] as const;
export type LayerType = (typeof LAYER_TYPES)[number];

/** A MapLibre layer style minus what the workspace assigns: its id and its source. */
export type MapLayerStyle = LayerSpecification extends infer L
  ? L extends LayerSpecification
    ? Omit<L, 'id' | 'source'>
    : never
  : never;

export type LayerPersistence = 'local' | 'session' | 'none';

/** Any JSON value: what may be stored in layer metadata. */
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/**
 * Generic, tool-defined description of where a layer came from (provenance) and anything else a
 * tool wants to keep with it. The layer system never interprets it; it must be plain JSON.
 */
export interface LayerMetadata {
  /** Free-form origin, e.g. a tool id, a file name or a service URL. */
  source?: string;
  createdAt?: number;
  updatedAt?: number;
  [key: string]: JsonValue | undefined;
}

/**
 * A workspace layer (spec §7). The layer system does not know what a layer means: it is a source
 * plus one or more MapLibre styles that are shown, hidden, faded and stacked together.
 */
export interface WorkspaceLayer {
  id: string;
  name: string;
  type: LayerType;
  visible: boolean;
  /** 0..1, multiplied into each style's own opacity. */
  opacity: number;
  group?: string;
  removable: boolean;
  /** A MapLibre source spec (geojson / vector / raster); `custom` layers may carry anything. */
  source?: unknown;
  /** Styles to draw; empty → defaults for the type (see defaultStyles.ts). */
  mapLayers: MapLayerStyle[];
  /** Tool that created the layer (display, and lets the tool remove its own). */
  ownerToolId?: string;
  /** Where it is kept between loads: workspace (local), this tab (session), or not at all. */
  persist: LayerPersistence;
  /** Provenance and tool-specific data; opaque to the layer system. */
  metadata?: LayerMetadata;
}

/** What callers pass to add a layer: a name and a type; everything else has defaults. */
export type NewWorkspaceLayer = Pick<WorkspaceLayer, 'name' | 'type'> & Partial<Omit<WorkspaceLayer, 'name' | 'type'>>;

/** True when the layer carries a MapLibre source the LayerManager should add. */
export function isMapSource(layer: WorkspaceLayer): layer is WorkspaceLayer & { source: SourceSpecification } {
  const s = layer.source as { type?: unknown } | undefined;
  return layer.type !== 'custom' && !!s && typeof s === 'object' && typeof s.type === 'string';
}

/** Number of features in a layer's inline GeoJSON, or null when the layer has none (tiles, custom). */
export function inlineFeatureCount(layer: WorkspaceLayer): number | null {
  const data = (layer.source as { data?: { type?: unknown; features?: unknown } } | undefined)?.data;
  return data?.type === 'FeatureCollection' && Array.isArray(data.features) ? data.features.length : null;
}
