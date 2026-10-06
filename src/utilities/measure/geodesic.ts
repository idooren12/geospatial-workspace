import turfArea from '@turf/area';
import turfLength from '@turf/length';
import type { Feature, LineString, Polygon, Position } from 'geojson';

/** Geodesic length of a path in metres (UTL-03). */
export function lengthMeters(coords: Position[]): number {
  if (coords.length < 2) return 0;
  const line: Feature<LineString> = { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } };
  return turfLength(line, { units: 'kilometers' }) * 1000;
}

/** Geodesic area of a polygon ring in square metres (UTL-04). Unclosed rings are closed. */
export function areaSquareMeters(ring: Position[]): number {
  if (ring.length < 3) return 0;
  const first = ring[0]!;
  const last = ring[ring.length - 1]!;
  const closed = first[0] === last[0] && first[1] === last[1] ? ring : [...ring, first];
  if (closed.length < 4) return 0;
  const poly: Feature<Polygon> = { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [closed] } };
  return turfArea(poly);
}

/** Perimeter of a ring in metres. */
export function perimeterMeters(ring: Position[]): number {
  if (ring.length < 2) return 0;
  const first = ring[0]!;
  const last = ring[ring.length - 1]!;
  const closed = first[0] === last[0] && first[1] === last[1] ? ring : [...ring, first];
  return lengthMeters(closed);
}
