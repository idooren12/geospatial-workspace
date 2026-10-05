import { AttributionControl, Map as MaplibreMap, NavigationControl, ScaleControl, setWorkerUrl } from 'maplibre-gl';
// MapLibre 6 resolves its worker relative to its own module, which bundlers relocate.
// Let Vite bundle the worker (with its shared chunk) and hand MapLibre the final URL.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import type { ControlPosition, IControl, Map as MlMap, MapEventType, MapOptions } from 'maplibre-gl';
import { isNameLabel, labelExpression } from './labelLanguage';
import { WS_PREFIX } from './mapConfig';
import type {
  ControlCorner,
  FitBoundsOptions,
  FlyToOptions,
  LabelLanguage,
  LabelPaint,
  LayerSpecification,
  LngLatBoundsLike,
  MapViewState,
  ScaleUnit,
  SourceSpecification,
  StyleInput,
} from './types';

setWorkerUrl(workerUrl);

export type MapFactory = (options: MapOptions) => MlMap;

/**
 * Named places on the map where the app can render its own floating UI (via React portals).
 * `tools` sits under the navigation control; `status` sits in the opposite bottom corner.
 */
export type ControlSlot = 'tools' | 'status';

export interface MountOptions {
  style: StyleInput;
  labelPaint?: LabelPaint | null;
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
  private labelPaint: LabelPaint | null = null;
  private controlCorner: ControlCorner = 'top-right';
  private nav: NavigationControl | null = null;
  private scale: ScaleControl | null = null;
  private attribution: AttributionControl | null = null;
  private readonly slots = new Map<ControlSlot, { el: HTMLElement; control: IControl }>();
  private resizeObserver: ResizeObserver | null = null;
  private resolveMounted!: () => void;
  private readonly mounted = new Promise<void>((r) => (this.resolveMounted = r));
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
    this.labelPaint = opts.labelPaint ?? null;
    this.controlCorner = opts.controlCorner;

    const v = opts.view;
    const map = this.factory({
      container: el,
      style: opts.style,
      attributionControl: false,
      ...(v
        ? { center: v.center, zoom: v.zoom, bearing: v.bearing, pitch: v.pitch }
        : { bounds: opts.fallbackBounds, fitBoundsOptions: { padding: opts.fallbackPadding ?? 0 } }),
    });
    this.map = map;
    this.instanceCount += 1;

    this.nav = new NavigationControl({ visualizePitch: true });
    this.scale = new ScaleControl({ unit: opts.scaleUnit, maxWidth: 120 });
    this.attribution = new AttributionControl({ compact: true });
    this.placeControls();

    map.on('style.load', this.handleStyleLoad);
    for (const s of this.subscriptions) map.on(s.type, s.fn as never);

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.scheduleResize());
      this.resizeObserver.observe(el);
    }
    this.resolveMounted();
  }

  /** Resolves once the map exists (mount can wait for an asynchronously built style). */
  whenMounted(): Promise<void> {
    return this.mounted;
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

  /** Raw map for the `?debug` console hook only. Never call from app code. */
  debugMap(): MlMap | null {
    return this.map;
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

  /** Switches basemap style. `labelPaint` recolours its place names once loaded. */
  setStyle(style: StyleInput, labelPaint: LabelPaint | null = null): void {
    if (!this.map) return;
    this.labelPaint = labelPaint;
    this.styleReady = false;
    this.map.setStyle(style, { diff: false });
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
      if (!isNameLabel(layer.layout?.['text-field'])) continue;
      map.setLayoutProperty(layer.id, 'text-field', expr);
      if (this.labelPaint) {
        for (const [k, v] of Object.entries(this.labelPaint)) {
          (map.setPaintProperty as (l: string, k: string, v: unknown) => void).call(map, layer.id, k, v);
        }
      }
    }
  }

  setScaleUnit(unit: ScaleUnit): void {
    this.scale?.setUnit(unit);
  }

  /** Mirrors control placement for RTL, keeping controls clear of the primary dock side. */
  setControlCorner(corner: ControlCorner): void {
    if (corner === this.controlCorner) return;
    this.controlCorner = corner;
    this.placeControls();
  }

  /**
   * A DOM element living inside a MapLibre control corner, for app UI rendered with a portal.
   * Exists before mount, so components can portal into it at any time.
   */
  getControlSlot(name: ControlSlot): HTMLElement {
    let slot = this.slots.get(name);
    if (!slot) {
      const el = document.createElement('div');
      el.className = `maplibregl-ctrl gws-slot gws-slot-${name}`;
      slot = { el, control: { onAdd: () => el, onRemove: () => el.remove() } };
      this.slots.set(name, slot);
    }
    return slot.el;
  }

  /**
   * (Re)places every control. Top corner: navigation, then app tools below it.
   * Bottom corners stack upwards in add order: the status slot sits lowest, the scale above it;
   * attribution goes to the bottom corner on the navigation side.
   */
  private placeControls(): void {
    const map = this.map;
    if (!map) return;
    const top: ControlPosition = this.controlCorner;
    const sameBottom: ControlPosition = top === 'top-right' ? 'bottom-right' : 'bottom-left';
    const otherBottom: ControlPosition = top === 'top-right' ? 'bottom-left' : 'bottom-right';
    const tools = this.slotControl('tools');
    const status = this.slotControl('status');
    const all = [this.nav, tools, status, this.scale, this.attribution];
    for (const c of all) if (c && map.hasControl(c)) map.removeControl(c);
    if (this.nav) map.addControl(this.nav, top);
    map.addControl(tools, top);
    map.addControl(status, otherBottom);
    if (this.scale) map.addControl(this.scale, otherBottom);
    if (this.attribution) map.addControl(this.attribution, sameBottom);
  }

  private slotControl(name: ControlSlot): IControl {
    this.getControlSlot(name);
    return this.slots.get(name)!.control;
  }
}

function assertWsId(id: string): void {
  if (!id.startsWith(WS_PREFIX)) throw new Error(`Workspace ids must start with "${WS_PREFIX}": ${id}`);
}

/** The workspace's one map service. */
export const mapService = new MapService();

/** Debug hook: always on in dev, and on any build when the URL has `?debug`. Read-only by convention. */
if (typeof window !== 'undefined' && (import.meta.env.DEV || new URLSearchParams(window.location.search).has('debug'))) {
  (window as unknown as { __gws: unknown }).__gws = {
    mapService,
    get map() {
      return mapService.debugMap();
    },
  };
}
