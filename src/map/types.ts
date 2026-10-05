import type {
  FitBoundsOptions,
  FlyToOptions,
  LayerSpecification,
  LngLatBoundsLike,
  SourceSpecification,
} from 'maplibre-gl';

export type { FitBoundsOptions, FlyToOptions, LayerSpecification, LngLatBoundsLike, SourceSpecification };

/** Camera state persisted between sessions (MAP-04). */
export interface MapViewState {
  center: [number, number]; // [lng, lat]
  zoom: number;
  bearing: number;
  pitch: number;
}

export type ScaleUnit = 'metric' | 'nautical' | 'imperial';
export type LabelLanguage = 'he' | 'en';

/** Placement of map controls; mirrored for RTL so they stay away from the main dock. */
export type ControlCorner = 'top-left' | 'top-right';

export interface BasemapDefinition {
  id: string;
  /** i18n key for the display name. */
  nameKey: string;
  styleUrl: string;
  kind: 'vector' | 'raster';
  /** Whether the basemap itself is dark (lets UI pick contrasting overlays). */
  dark?: boolean;
}
