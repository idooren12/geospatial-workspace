import { Map as MaplibreMap, NavigationControl, ScaleControl, setWorkerUrl } from 'maplibre-gl';
// MapLibre 6 resolves its worker relative to its own module, which bundlers relocate.
// Let Vite bundle the worker (with its shared chunk) and hand MapLibre the final URL.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import type { Map as MlMap, MapEventType, MapOptions } from 'maplibre-gl';
import { isNameLabel, labelExpression } from './labelLanguage';
import { WS_PREFIX } from './mapConfig';
import type {
  ControlCorner,
  FitBoundsOptions,
  FlyToOptions,
  LabelLanguage,
  LayerSpecification,
  LngLatBoundsLike,
  MapViewState,
  ScaleUnit,
  SourceSpecification,
} from './types';

setWorkerUrl(workerUrl);

export type MapFactory = (options: MapOptions) => MlMap;

export interface MountOptions {
  styleUrl: string;
  /** Saved camera; when absent the map fits `fallbackBounds`. */
  view?: MapViewState | null;
  fallbackBounds: LngLatBoundsLike;
  fallbackPadding?: number;
  labelLanguage: LabelLanguage;
  scaleUnit: ScaleUnit;
  controlCorner: ControlCorner;
}

type AnyListener = (ev: never) => void;
interface Subscription {
  type: keyof MapEventType;
  fn: AnyListener;
}

/** Paint properties that carry opacity, per MapLibre layer type. */
const OPACITY_PROPS: Partial<Record<LayerSpecification['type'], string[]>> = {
  fill: ['fill-opacity'],
  line: ['line-opacity'],
  circle: ['circle-opacity', 'circle-stroke-opacity'],
  symbol: ['icon-opacity', 'text-opacity'],
  raster: ['raster-opacity'],
  'fill-extrusion': ['fill-extrusion-opacity'],
  heatmap: ['heatmap-opacity'],
  background: ['background-opacity'],
};

/**
 * The single owner of the MapLibre instance (MAP-01, MAP-03).
 *
 * Nothing outside `src/map` touches `maplibregl.Map`. Sources and layers added through this
 * service are recorded, so they are restored automatically after a basemap switch
 * (`setStyle` wipes everything that is not part of the new style).
 */
export class MapService {
  private map: MlMap | null = null;
  private container: HTMLElement | null = null;
  private styleReady = false;
  private readonly sources = new Map<string, SourceSpecification>();
  /** Managed layers, bottom → top. */
  private layers: LayerSpecification[] = [];
  private readonly subscriptions = new Set<Subscription>();
  private readonly styleLoadCallbacks = new Set<() => void>();
  private labelLanguage: LabelLanguage = 'he';
  private controlCorner: ControlCorner = 'top-right';
  private nav: NavigationControl | null = null;
  private scale: ScaleControl | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private resizeFrame = 0;

  /** Number of MapLibre instances ever created. Must stay 1 for the life of the page. */
  instanceCount = 0;

  private readonly factory: MapFactory;

  constructor(factory: MapFactory = (o) => new MaplibreMap(o)) {
    this.factory = factory;
  }

  // ---------------------------------------------------------------- lifecycle

  /** Idempotent: a second call with the same element (React StrictMode) is a no-op. */
  mount(el: HTMLElement, opts: MountOptions): void {
    if (this.map && this.container === el) return;
    if (this.map) this.destroy();

    this.container = el;
    this.labelLanguage = opts.labelLanguage;
    this.controlCorner = opts.controlCorner;

    const v = opts.view;
    const map = this.factory({
      container: el,
      style: opts.styleUrl,
      attributionControl: { compact: true },
      ...(v
        ? { center: v.center, zoom: v.zoom, bearing: v.bearing, pitch: v.pitch }
        : { bounds: opts.fallbackBounds, fitBoundsOptions: { padding: opts.fallbackPadding ?? 0 } }),
    });
    this.map = map;
    this.instanceCount += 1;

    this.nav = new NavigationControl({ visualizePitch: true });
    this.scale = new ScaleControl({ unit: opts.scaleUnit, maxWidth: 120 });
    map.addControl(this.nav, this.controlCorner);
    map.addControl(this.scale, this.controlCorner === 'top-right' ? 'bottom-left' : 'bottom-right');

    map.on('style.load', this.handleStyleLoad);
    for (const s of this.subscriptions) map.on(s.type, s.fn as never);

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.scheduleResize());
      this.resizeObserver.observe(el);
    }
  }

  /** For tests and hot reload only; the app never destroys its map. */
  destroy(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    cancelAnimationFrame(this.resizeFrame);
    this.map?.remove();
    this.map = null;
    this.container = null;
    this.styleReady = false;
  }

  get isMounted(): boolean {
    return this.map !== null;
  }

  /** MAP-02: one resize per animation frame, whatever triggered the layout change. */
  scheduleResize(): void {
    if (!this.map) return;
    cancelAnimationFrame(this.resizeFrame);
    this.resizeFrame = requestAnimationFrame(() => this.map?.resize());
  }

  // ------------------------------------------------------------------- events

  /** Subscribe to a map event. Works before mount; returns an unsubscribe function. */
  on<T extends keyof MapEventType>(type: T, fn: (ev: MapEventType[T]) => void): () => void {
    const sub: Subscription = { type, fn: fn as AnyListener };
    this.subscriptions.add(sub);
    this.map?.on(type, fn as never);
    return () => {
      this.subscriptions.delete(sub);
      this.map?.off(type, fn as never);
    };
  }

  /** Called after every style load, including basemap switches. */
  onStyleLoad(fn: () => void): () => void {
    this.styleLoadCallbacks.add(fn);
    return () => this.styleLoadCallbacks.delete(fn);
  }

  private readonly handleStyleLoad = (): void => {
    this.styleReady = true;
    this.applyLabelLanguage();
    this.restoreManaged();
    for (const fn of this.styleLoadCallbacks) fn();
  };

  // ------------------------------------------------------------------ basemap

  setStyle(styleUrl: string): void {
    if (!this.map) return;
    this.styleReady = false;
    this.map.setStyle(styleUrl, { diff: false });
  }

  // ---------------------------------------------------- sources & layers (generic)

  addSource(id: string, spec: SourceSpecification): void {
    assertWsId(id);
    this.sources.set(id, spec);
    if (this.styleReady && this.map && !this.map.getSource(id)) this.map.addSource(id, spec);
  }

  removeSource(id: string): void {
    this.sources.delete(id);
    if (this.styleReady && this.map?.getSource(id)) this.map.removeSource(id);
  }

  addLayer(spec: LayerSpecification, beforeId?: string): void {
    assertWsId(spec.id);
    const copy = structuredClone(spec);
    const at = beforeId ? this.layers.findIndex((l) => l.id === beforeId) : -1;
    if (at >= 0) this.layers.splice(at, 0, copy);
    else this.layers.push(copy);
    if (this.styleReady && this.map) this.map.addLayer(copy, at >= 0 ? beforeId : undefined);
  }

  removeLayer(id: string): void {
    this.layers = this.layers.filter((l) => l.id !== id);
    if (this.styleReady && this.map?.getLayer(id)) this.map.removeLayer(id);
  }

  setLayerVisibility(id: string, visible: boolean): void {
    const spec = this.findLayer(id);
    const value = visible ? 'visible' : 'none';
    spec.layout = { ...spec.layout, visibility: value } as typeof spec.layout;
    if (this.styleReady && this.map?.getLayer(id)) this.map.setLayoutProperty(id, 'visibility', value);
  }

  setLayerOpacity(id: string, opacity: number): void {
    const spec = this.findLayer(id);
    const o = Math.min(1, Math.max(0, opacity));
    const props = OPACITY_PROPS[spec.type] ?? [];
    const paint: Record<string, unknown> = { ...(spec as { paint?: object }).paint };
    for (const p of props) {
      paint[p] = o;
      if (this.styleReady && this.map?.getLayer(id)) (this.map.setPaintProperty as (l: string, k: string, v: unknown) => void).call(this.map, id, p, o);
    }
    (spec as { paint?: object }).paint = paint;
  }

  /** Moves a managed layer below `beforeId`, or to the top when omitted. */
  moveLayer(id: string, beforeId?: string): void {
    const spec = this.findLayer(id);
    this.layers = this.layers.filter((l) => l !== spec);
    const at = beforeId ? this.layers.findIndex((l) => l.id === beforeId) : -1;
    if (at >= 0) this.layers.splice(at, 0, spec);
    else this.layers.push(spec);
    if (this.styleReady && this.map?.getLayer(id)) this.map.moveLayer(id, at >= 0 ? beforeId : undefined);
  }

  /** Managed layer ids, bottom → top. */
  getLayerOrder(): string[] {
    return this.layers.map((l) => l.id);
  }

  private findLayer(id: string): LayerSpecification {
    const spec = this.layers.find((l) => l.id === id);
    if (!spec) throw new Error(`Unknown workspace layer: ${id}`);
    return spec;
  }

  private restoreManaged(): void {
    const map = this.map;
    if (!map) return;
    for (const [id, spec] of this.sources) if (!map.getSource(id)) map.addSource(id, spec);
    for (const spec of this.layers) if (!map.getLayer(spec.id)) map.addLayer(spec);
  }

  // -------------------------------------------------------------------- camera

  fitBounds(bounds: LngLatBoundsLike, options?: FitBoundsOptions): void {
    this.map?.fitBounds(bounds, options);
  }

  flyTo(options: FlyToOptions): void {
    this.map?.flyTo(options);
  }

  getView(): MapViewState | null {
    const map = this.map;
    if (!map) return null;
    const c = map.getCenter();
    return { center: [c.lng, c.lat], zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch() };
  }

  getZoom(): number | null {
    return this.map ? this.map.getZoom() : null;
  }

  // ------------------------------------------------------- language & controls

  setLabelLanguage(lang: LabelLanguage): void {
    this.labelLanguage = lang;
    this.applyLabelLanguage();
  }

  private applyLabelLanguage(): void {
    const map = this.map;
    if (!map || !this.styleReady) return;
    const expr = labelExpression(this.labelLanguage);
    for (const layer of map.getStyle().layers ?? []) {
      if (layer.type !== 'symbol' || layer.id.startsWith(WS_PREFIX)) continue;
      if (isNameLabel(layer.layout?.['text-field'])) map.setLayoutProperty(layer.id, 'text-field', expr);
    }
  }

  setScaleUnit(unit: ScaleUnit): void {
    this.scale?.setUnit(unit);
  }

  /** Mirrors control placement for RTL, keeping controls clear of the primary dock side. */
  setControlCorner(corner: ControlCorner): void {
    const map = this.map;
    if (!map || corner === this.controlCorner) return;
    this.controlCorner = corner;
    if (this.nav) {
      map.removeControl(this.nav);
      map.addControl(this.nav, corner);
    }
    if (this.scale) {
      map.removeControl(this.scale);
      map.addControl(this.scale, corner === 'top-right' ? 'bottom-left' : 'bottom-right');
    }
  }
}

function assertWsId(id: string): void {
  if (!id.startsWith(WS_PREFIX)) throw new Error(`Workspace ids must start with "${WS_PREFIX}": ${id}`);
}

/** The workspace's one map service. */
export const mapService = new MapService();

if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as { __gws: { mapService: MapService } }).__gws = { mapService };
}
