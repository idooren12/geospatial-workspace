import type {
  FitBoundsOptions,
  FlyToOptions,
  LayerSpecification,
  LngLatBoundsLike,
  SourceSpecification,
  StyleSpecification,
} from 'maplibre-gl';

export type {
  FitBoundsOptions,
  FlyToOptions,
  LayerSpecification,
  LngLatBoundsLike,
  SourceSpecification,
  StyleSpecification,
};

/** Camera state persisted between sessions (MAP-04). */
export interface MapViewState {
  center: [number, number]; // [lng, lat]
  zoom: number;
  bearing: number;
  pitch: number;
}

export type ScaleUnit = 'metric' | 'nautical' | 'imperial';
export type LabelLanguage = 'he' | 'en';
export type MapTheme = 'light' | 'dark';

/** Placement of the main map controls; mirrored for RTL. */
export type ControlCorner = 'top-left' | 'top-right';

/** A style URL, or a full style built at runtime (e.g. imagery + vector labels). */
export type StyleInput = string | StyleSpecification;

export interface RasterImagery {
  tiles: string[];
  tileSize: number;
  maxzoom: number;
  attribution: string;
}

interface BasemapBase {
  id: string;
  /** i18n key for the display name. */
  nameKey: string;
  /** lucide icon name used in the basemap list. */
  icon: 'map' | 'satellite' | 'mountain' | 'waves';
  /**
   * Licensing record (M5 attribution audit). The credit itself reaches the map through the
   * style's sources; this says who provides it, under which terms, and what the credit must say.
   */
  licence: BasemapLicence;
}

export interface BasemapLicence {
  providers: string[];
  /** Licences / terms that apply. */
  terms: string[];
  /** Text that must be visible on the map (checked by tests). */
  requiredCredit: string[];
  /** True while production use still needs a decision (e.g. an account or key). */
  openDecision?: string;
}

/** A vector basemap with a light and a dark rendering. */
export interface VectorBasemap extends BasemapBase {
  kind: 'vector';
  styles: Record<MapTheme, string>;
  /** Paint overrides for place-name labels, per theme (e.g. brighter text on a dim dark style). */
  labelPaint?: Partial<Record<MapTheme, LabelPaint>>;
}

export type LabelPaint = Record<'text-color' | 'text-halo-color' | 'text-halo-width', string | number>;

/** Imagery underneath, optionally with place names taken from a vector style on top. */
export interface RasterBasemap extends BasemapBase {
  kind: 'raster';
  imagery: RasterImagery;
  labelsStyleUrl?: string;
}

export type BasemapDefinition = VectorBasemap | RasterBasemap;
