/** A measurement the user chose to keep (separate from layers; shown in the Measure panel). */
export interface SavedMeasurement {
  id: string;
  name: string;
  kind: 'distance' | 'area';
  /** Path vertices, or polygon ring without the closing vertex. */
  coordinates: [number, number][];
  visible: boolean;
  createdAt: number;
}
