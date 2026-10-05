import type { LngLatBoundsLike } from './types';

/** First-open view: all of Israel, Eilat to Mount Hermon, at any screen size. */
export const INITIAL_BOUNDS: LngLatBoundsLike = [
  [34.2, 29.45],
  [35.95, 33.35],
];

export const INITIAL_BOUNDS_PADDING = 32;

/** Prefix for every source/layer the workspace adds, to tell them apart from basemap layers. */
export const WS_PREFIX = 'ws:';
