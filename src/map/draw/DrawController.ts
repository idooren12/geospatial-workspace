import {
  TerraDraw,
  TerraDrawLineStringMode,
  TerraDrawPointMode,
  TerraDrawPolygonMode,
  TerraDrawRenderMode,
  type GeoJSONStoreFeatures,
} from 'terra-draw';
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter';
import type { Feature, Geometry, Position } from 'geojson';
import { mapService } from '../MapService';

/**
 * What the pointer does on the map. `none` = normal map navigation.
 * Measure tools keep their result on the map until cleared; draw tools hand each finished shape
 * to whoever listens (the Sketch layer) and leave nothing behind in the drawing engine.
 */
export type DrawTool = 'none' | 'distance' | 'area' | 'point' | 'line' | 'polygon';

export interface Measurement {
  kind: 'distance' | 'area';
  /** Vertices of the shape being / last measured (ring not closed for area). */
  coordinates: Position[];
  /** True once the user finished the shape (otherwise it is live, following the pointer). */
  done: boolean;
}

export interface DrawState {
  tool: DrawTool;
  measurement: Measurement | null;
}

const MODE: Record<Exclude<DrawTool, 'none'>, string> = {
  distance: 'measure-distance',
  area: 'measure-area',
  point: 'draw-point',
  line: 'draw-line',
  polygon: 'draw-polygon',
};
const IDLE = 'idle';
const MEASURE_GEOMETRY = { distance: 'LineString', area: 'Polygon' } as const;
const MEASURE_COLOR = '#ffb020';
const DRAW_COLOR = '#ff6a3d';
const WHITE = '#ffffff';

const KEYS = { cancel: 'Escape', finish: 'Enter' } as const;

function buildModes() {
  return [
    new TerraDrawRenderMode({ modeName: IDLE, styles: {} }),
    new TerraDrawLineStringMode({
      modeName: MODE.distance,
      keyEvents: KEYS,
      styles: { lineStringColor: MEASURE_COLOR, lineStringWidth: 3, closingPointColor: MEASURE_COLOR, closingPointWidth: 5, closingPointOutlineColor: WHITE, closingPointOutlineWidth: 2 },
    }),
    new TerraDrawPolygonMode({
      modeName: MODE.area,
      keyEvents: KEYS,
      styles: { fillColor: MEASURE_COLOR, fillOpacity: 0.2, outlineColor: MEASURE_COLOR, outlineWidth: 3, closingPointColor: MEASURE_COLOR, closingPointWidth: 5, closingPointOutlineColor: WHITE, closingPointOutlineWidth: 2 },
    }),
    new TerraDrawPointMode({ modeName: MODE.point, styles: { pointColor: DRAW_COLOR, pointWidth: 6, pointOutlineColor: WHITE, pointOutlineWidth: 2 } }),
    new TerraDrawLineStringMode({
      modeName: MODE.line,
      keyEvents: KEYS,
      styles: { lineStringColor: DRAW_COLOR, lineStringWidth: 3, closingPointColor: DRAW_COLOR, closingPointWidth: 5, closingPointOutlineColor: WHITE, closingPointOutlineWidth: 2 },
    }),
    new TerraDrawPolygonMode({
      modeName: MODE.polygon,
      keyEvents: KEYS,
      styles: { fillColor: DRAW_COLOR, fillOpacity: 0.25, outlineColor: DRAW_COLOR, outlineWidth: 3, closingPointColor: DRAW_COLOR, closingPointWidth: 5, closingPointOutlineColor: WHITE, closingPointOutlineWidth: 2 },
    }),
  ];
}

function coordsOf(f: GeoJSONStoreFeatures | undefined): Position[] {
  const g = f?.geometry;
  if (!g) return [];
  if (g.type === 'LineString') return g.coordinates;
  if (g.type === 'Polygon') {
    const ring = g.coordinates[0] ?? [];
    return ring.length > 1 ? ring.slice(0, -1) : ring; // drop the closing vertex
  }
  return [];
}

/**
 * Owns the terra-draw instance (UTL-03..05). Lives in src/map because it talks to MapLibre through
 * the adapter. `setStyle` wipes terra-draw's layers, so after every basemap switch the engine is
 * rebuilt and the current measurement restored.
 */
class DrawController {
  private draw: TerraDraw | null = null;
  private state: DrawState = { tool: 'none', measurement: null };
  private readonly listeners = new Set<() => void>();
  private readonly sketchListeners = new Set<(f: Feature<Geometry>) => void>();
  private measureId: string | number | null = null;
  private wired = false;
  private restoring = false;

  // ---- external store protocol (useSyncExternalStore)
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getState = (): DrawState => this.state;

  /** Finished point / line / polygon shapes from the draw tools. */
  onSketch(fn: (f: Feature<Geometry>) => void): () => void {
    this.sketchListeners.add(fn);
    return () => this.sketchListeners.delete(fn);
  }

  private set(patch: Partial<DrawState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }

  /** Called once by the app; (re)creates the engine whenever a style finishes loading. */
  wire(): void {
    if (this.wired) return;
    this.wired = true;
    mapService.onStyleLoad(() => this.rebuild());
    if (mapService.internalMap()?.isStyleLoaded()) this.rebuild();
  }

  private rebuild(): void {
    const map = mapService.internalMap();
    if (!map) return;
    const keep = this.measureId !== null ? this.draw?.getSnapshotFeature(this.measureId) : undefined;
    if (this.draw) {
      try {
        this.draw.stop();
      } catch {
        /* its layers went with the old style */
      }
    }
    const draw = new TerraDraw({ adapter: new TerraDrawMapLibreGLAdapter({ map, prefixId: 'td' }), modes: buildModes() });
    draw.start();
    draw.on('change', (ids, type) => this.handleChange(ids, type));
    draw.on('finish', (id) => this.handleFinish(id));
    this.draw = draw;
    if (keep) {
      this.restoring = true; // re-adding fires 'change'; it is not a new, live measurement
      draw.addFeatures([keep]);
      this.restoring = false;
      this.measureId = keep.id ?? null;
    }
    this.applyMode();
  }

  /**
   * terra-draw disables MapLibre's double-click zoom whenever any mode starts, even the idle one.
   * Re-enable it after every mode change unless a tool is drawing (where double click finishes).
   */
  private applyMode(): void {
    const tool = this.state.tool;
    this.draw?.setMode(tool === 'none' ? IDLE : MODE[tool]);
    mapService.setDoubleClickZoom(tool === 'none');
  }

  setTool(tool: DrawTool): void {
    if (tool === this.state.tool) return;
    // Switching away from a measure tool drops its result; measurements are temporary.
    if (tool !== 'distance' && tool !== 'area') this.clearMeasurement();
    this.set({ tool });
    this.applyMode();
  }

  clearMeasurement(): void {
    if (this.measureId !== null && this.draw) {
      try {
        this.draw.removeFeatures([this.measureId]);
      } catch {
        /* already gone */
      }
    }
    this.measureId = null;
    if (this.state.measurement) this.set({ measurement: null });
  }

  private handleChange(ids: (string | number)[], type: string): void {
    const tool = this.state.tool;
    if (this.restoring || !this.draw || (tool !== 'distance' && tool !== 'area')) return;
    for (const id of ids) {
      const f = this.draw.getSnapshotFeature(id);
      // Modes also create helper points (closing / coordinate points); only the shape counts.
      if (!f || f.properties?.mode !== MODE[tool] || f.geometry.type !== MEASURE_GEOMETRY[tool]) continue;
      // A new shape starts: the previous measurement goes away (one at a time).
      if (type === 'create' && this.measureId !== null && this.measureId !== id) {
        try {
          this.draw.removeFeatures([this.measureId]);
        } catch {
          /* gone */
        }
      }
      this.measureId = id;
      this.set({ measurement: { kind: tool, coordinates: coordsOf(f), done: false } });
    }
  }

  private handleFinish(id: string | number): void {
    const draw = this.draw;
    if (!draw) return;
    const f = draw.getSnapshotFeature(id);
    if (!f) return;
    const mode = f.properties?.mode;
    if ((mode === MODE.distance && f.geometry.type === 'LineString') || (mode === MODE.area && f.geometry.type === 'Polygon')) {
      this.measureId = id;
      this.set({ measurement: { kind: mode === MODE.distance ? 'distance' : 'area', coordinates: coordsOf(f), done: true } });
      return;
    }
    // A sketch shape: hand it over and remove it from the engine (the Sketch layer draws it now).
    const feature: Feature<Geometry> = { type: 'Feature', properties: {}, geometry: f.geometry as Geometry };
    draw.removeFeatures([id]);
    this.sketchListeners.forEach((l) => l(feature));
  }
}

export const drawController = new DrawController();
