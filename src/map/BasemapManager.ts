import { BASEMAPS, DEFAULT_BASEMAP_ID } from './basemaps.config';
import type { BasemapDefinition, LayerSpecification, MapTheme, RasterBasemap, StyleInput, StyleSpecification } from './types';

type FetchJson = (url: string) => Promise<unknown>;

/** Label styles are a nice-to-have on imagery: never let a slow fetch hold the basemap back. */
const LABELS_TIMEOUT_MS = 4000;

const defaultFetch: FetchJson = async (url) => {
  const res = await fetch(url, { signal: AbortSignal.timeout(LABELS_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
};

const labelStyleCache = new Map<string, Promise<StyleSpecification | null>>();

/** Owns the list of available basemaps and turns a choice into a MapLibre style. */
export const BasemapManager = {
  list(): readonly BasemapDefinition[] {
    return BASEMAPS;
  },

  get(id: string): BasemapDefinition | undefined {
    return BASEMAPS.find((b) => b.id === id);
  },

  /** Returns the requested basemap, falling back to the default for unknown ids (e.g. stale storage). */
  resolve(id: string | undefined): BasemapDefinition {
    const found = id ? BasemapManager.get(id) : undefined;
    if (found) return found;
    const fallback = BasemapManager.get(DEFAULT_BASEMAP_ID) ?? BASEMAPS[0];
    if (!fallback) throw new Error('No basemaps configured');
    return fallback;
  },

  /** Whether the light/dark switch applies to this basemap. */
  hasThemes(def: BasemapDefinition): boolean {
    return def.kind === 'vector';
  },

  /** The style to give MapLibre. Vector basemaps are a URL; imagery is assembled at runtime. */
  async styleFor(id: string, theme: MapTheme, fetchJson: FetchJson = defaultFetch): Promise<StyleInput> {
    const def = BasemapManager.resolve(id);
    if (def.kind === 'vector') return def.styles[theme];
    let labels: StyleSpecification | null = null;
    if (def.labelsStyleUrl) {
      const url = def.labelsStyleUrl;
      if (!labelStyleCache.has(url)) {
        labelStyleCache.set(
          url,
          fetchJson(url)
            .then((s) => s as StyleSpecification)
            .catch(() => {
              labelStyleCache.delete(url); // retry next time
              return null;
            }),
        );
      }
      labels = await labelStyleCache.get(url)!;
    }
    return buildImageryStyle(def, labels);
  },
};

/** Line layers worth keeping on imagery: borders help orientation, roads clutter the photo. */
const KEEP_LINE = /boundary|admin/;

/**
 * Imagery at the bottom, then borders and place names from a vector style, recoloured for a
 * photographic background (white text, dark halo). Without a label style: imagery only.
 */
export function buildImageryStyle(def: RasterBasemap, labels: StyleSpecification | null): StyleSpecification {
  const imagery: LayerSpecification = { id: 'basemap-imagery', type: 'raster', source: 'basemap-imagery' };
  const style: StyleSpecification = {
    version: 8,
    sources: {
      'basemap-imagery': {
        type: 'raster',
        tiles: def.imagery.tiles,
        tileSize: def.imagery.tileSize,
        maxzoom: def.imagery.maxzoom,
        attribution: def.imagery.attribution,
      },
    },
    layers: [imagery],
  };
  if (!labels) return style;

  const overlay = labels.layers.filter(
    (l) => l.type === 'symbol' || (l.type === 'line' && KEEP_LINE.test(l.id)),
  );
  const used = new Set(overlay.map((l) => ('source' in l ? l.source : undefined)).filter(Boolean) as string[]);
  for (const id of used) {
    const src = labels.sources[id];
    if (src) style.sources[id] = src;
  }
  if (labels.glyphs) style.glyphs = labels.glyphs;
  if (labels.sprite) style.sprite = labels.sprite;

  for (const l of overlay) {
    const layer = structuredClone(l) as LayerSpecification & { paint?: Record<string, unknown> };
    if (layer.type === 'symbol') {
      layer.paint = {
        ...layer.paint,
        'text-color': '#ffffff',
        'text-halo-color': 'rgba(0,0,0,0.75)',
        'text-halo-width': 1.4,
      };
    } else {
      layer.paint = { ...layer.paint, 'line-color': 'rgba(255,255,255,0.6)' };
    }
    style.layers.push(layer);
  }
  return style;
}
