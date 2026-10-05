import type { LayerSpecification } from './types';

/** Paint properties that carry opacity, per MapLibre layer type. */
export const OPACITY_PROPS: Partial<Record<LayerSpecification['type'], string[]>> = {
  fill: ['fill-opacity'],
  line: ['line-opacity'],
  circle: ['circle-opacity', 'circle-stroke-opacity'],
  symbol: ['icon-opacity', 'text-opacity'],
  raster: ['raster-opacity'],
  'fill-extrusion': ['fill-extrusion-opacity'],
  heatmap: ['heatmap-opacity'],
  background: ['background-opacity'],
};
