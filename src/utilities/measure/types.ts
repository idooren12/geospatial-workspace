import type { LineString, Polygon } from 'geojson';
import { areaSquareMeters, lengthMeters } from './geodesic';

export type MeasurementKind = 'distance' | 'area';
/** GeoJSON (RFC 7946) geometry in WGS84 lon/lat: a path, or a polygon with one closed ring. */
export type MeasurementGeometry = LineString | Polygon;
/** SI base units: metres for distance, square metres for area. Display units come from Settings. */
export type MeasurementUnit = 'm' | 'm2';

/**
 * A measurement the user chose to keep (separate from layers; listed in the Measurements panel).
 * `id` is stable and independent of `name`. `value` is derived from `geometry` and recomputed on
 * load, so the geometry is always the source of truth.
 */
export interface SavedMeasurement {
  id: string;
  name: string;
  kind: MeasurementKind;
  geometry: MeasurementGeometry;
  value: number;
  unit: MeasurementUnit;
  visible: boolean;
  createdAt: number;
  updatedAt: number;
}

type Pos = [number, number];

/** Path vertices, or the polygon ring without its closing vertex (what the editor works with). */
export function verticesOf(g: MeasurementGeometry): Pos[] {
  if (g.type === 'LineString') return g.coordinates.map((p) => [p[0]!, p[1]!]);
  const ring = g.coordinates[0] ?? [];
  const open = ring.length > 1 && ring[0]![0] === ring.at(-1)![0] && ring[0]![1] === ring.at(-1)![1] ? ring.slice(0, -1) : ring;
  return open.map((p) => [p[0]!, p[1]!]);
}

/** Builds the stored geometry and its numeric value from editor vertices. */
export function measure(kind: MeasurementKind, vertices: Pos[]): Pick<SavedMeasurement, 'geometry' | 'value' | 'unit'> {
  if (kind === 'distance') {
    return { geometry: { type: 'LineString', coordinates: vertices }, value: lengthMeters(vertices), unit: 'm' };
  }
  const ring = vertices.length ? [...vertices, vertices[0]!] : [];
  return { geometry: { type: 'Polygon', coordinates: [ring] }, value: areaSquareMeters(vertices), unit: 'm2' };
}

/** Minimum vertices for a meaningful measurement of this kind. */
export const minVertices = (kind: MeasurementKind) => (kind === 'area' ? 3 : 2);
