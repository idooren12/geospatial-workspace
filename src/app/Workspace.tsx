import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { applyDocumentLanguage, dirOf } from '../i18n';
import i18n from '../i18n';
import { MapControls } from '../layout/overlay/MapControls';
import { StatusBar } from '../layout/StatusBar';
import { MapLoading } from '../layout/MapLoading';
import { UndoToast } from '../layout/UndoToast';
import { DockArea } from '../layout/DockArea';
import { TopBar } from '../layout/TopBar';
import { toolRegistry } from '../tools/ToolRegistry';
import { LayerManager } from '../layers/LayerManager';
import { WorkspaceLayout } from '../layout/WorkspaceLayout';
import { BasemapManager } from '../map/BasemapManager';
import { drawController } from '../map/draw/DrawController';
import { mapService, type MountOptions } from '../map/MapService';
import { INITIAL_BOUNDS, INITIAL_BOUNDS_PADDING } from '../map/mapConfig';
import { addDrawing, refreshDrawingStyles, type DrawingKind } from '../utilities/draw/drawingLayers';
import { LABEL_IMAGES } from '../map/labelStyle';
import { history } from '../history/history';
import { syncMeasurements } from '../utilities/measure/measurementOverlay';
import { wirePicking } from './picking';
import { syncSelection } from './selectionOverlay';
import { MapView } from '../map/MapView';
import { persistence, startPersistence } from '../persistence';
import { useWorkspace } from '../store/workspaceStore';

/** One per page, like the map: effect re-runs (React StrictMode) must not re-add layers. */
const layerManager = new LayerManager(mapService);

/** Wires store ⇄ map ⇄ document. Contains no domain logic. */
function useWorkspaceWiring() {
  useEffect(() => startPersistence(useWorkspace, persistence), []);

  // Camera → store (persisted, debounced).
  useEffect(
    () =>
      mapService.on('moveend', () => {
        const v = mapService.getView();
        if (v) useWorkspace.getState().setView(v);
      }),
    [],
  );

  // Workspace layers → map, by diff. Runs once now (restored layers) and on every change.
  useEffect(() => {
    // Label backgrounds used by drawing, measurement and selection labels.
    for (const [id, img] of Object.entries(LABEL_IMAGES)) mapService.addImage(id, img, img.options);
    refreshDrawingStyles();
    const manager = layerManager;
    const run = () => {
      const s = useWorkspace.getState();
      manager.sync(s.layers, s.layerOrder);
    };
    run();
    const off = useWorkspace.subscribe((s) => [s.layers, s.layerOrder] as const, run, {
      equalityFn: (a, b) => a[0] === b[0] && a[1] === b[1],
    });
    exposeLayersForDebug();
    return off;
  }, []);

  // Drawing engine: attach once the map exists; finished shapes go to the Sketch layer.
  useEffect(() => {
    let unwire: (() => void) | null = null;
    let alive = true;
    void mapService.whenMounted().then(() => {
      if (!alive) return;
      drawController.wire();
      unwire = wirePicking();
    });
    const offSketch = drawController.onSketch((f) => {
      const kind: DrawingKind = f.geometry.type === 'Point' ? 'point' : f.geometry.type === 'Polygon' ? 'polygon' : 'line';
      addDrawing(f, kind, {
        kind: (k, n) => i18n.t(`draw.kind_${k}`, { n }),
        newLayer: (n) => i18n.t('draw.defaultLayer', { n }),
      });
    });
    return () => {
      alive = false;
      unwire?.();
      offSketch();
    };
  }, []);

  // Selection → highlight on the map (also follows edits to the selected item).
  useEffect(() => {
    const run = () => syncSelection(useWorkspace.getState());
    run();
    return useWorkspace.subscribe(
      (s) => [s.selection, s.layers, s.measurements, s.settings.units, s.settings.language] as const,
      run,
      { equalityFn: (a, b) => a.every((v, i) => v === b[i]) },
    );
  }, []);

  // Saved measurements → map (labels follow units and language).
  useEffect(() => {
    const run = () => {
      const s = useWorkspace.getState();
      syncMeasurements(s.measurements, s.settings.units, s.settings.language);
    };
    run();
    return useWorkspace.subscribe((s) => [s.measurements, s.settings.units, s.settings.language] as const, run, {
      equalityFn: (a, b) => a.every((v, i) => v === b[i]),
    });
  }, []);

  // Store → map / document. Subscriptions fire on change only, never on mount.
  useEffect(() => {
    const offs = [
      useWorkspace.subscribe((s) => s.basemapId, applyBasemap),
      useWorkspace.subscribe((s) => s.mapTheme, applyBasemap),
      useWorkspace.subscribe(
        (s) => s.settings.language,
        (lang) => {
          void i18n.changeLanguage(lang);
          applyDocumentLanguage(lang);
          mapService.setLabelLanguage(lang);
          mapService.setControlCorner(dirOf(lang) === 'rtl' ? 'top-left' : 'top-right');
        },
      ),
      useWorkspace.subscribe(
        (s) => s.settings.units,
        (units) => mapService.setScaleUnit(units),
      ),
    ];
    return () => offs.forEach((off) => off());
  }, []);
}

let basemapRequest = 0;

/**
 * Builds the chosen basemap's style and applies it. Also the map's Retry after a failure (imagery
 * styles are rebuilt, so a failed label fetch gets another chance). Slower, stale requests lose.
 */
function applyBasemap(): void {
  const { basemapId, mapTheme } = useWorkspace.getState();
  const mine = ++basemapRequest;
  void BasemapManager.styleFor(basemapId, mapTheme).then((style) => {
    if (mine === basemapRequest) mapService.setStyle(style, BasemapManager.labelPaintFor(basemapId, mapTheme));
  });
}

/** With `?debug`, add `window.__gws.layers` so layer flows can be checked on any build. */
function exposeLayersForDebug() {
  const g = (window as unknown as { __gws?: Record<string, unknown> }).__gws;
  if (!g) return;
  const s = () => useWorkspace.getState();
  g.layers = {
    add: (l: Parameters<ReturnType<typeof s>['addLayer']>[0]) => s().addLayer(l),
    remove: (id: string) => s().removeLayer(id, { force: true }),
    list: () => s().layerOrder.map((id) => s().layers[id]),
  };
}

/** Typing in a field keeps the browser's own undo; the workspace history must not steal it. */
function isTextEntry(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || (el.tagName === 'INPUT' && !['checkbox', 'radio', 'range', 'button'].includes((el as HTMLInputElement).type));
}

/**
 * Ctrl+Shift+M toggles Map Only; Escape leaves it (unless a menu/popover took the key).
 * Ctrl/Cmd+Z undoes, Ctrl/Cmd+Shift+Z or Ctrl+Y redoes (outside text fields).
 */
function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useWorkspace.getState();
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (mod && !e.altKey && (key === 'z' || key === 'y') && !isTextEntry(e.target)) {
        e.preventDefault();
        if (key === 'y' || e.shiftKey) history.redo();
        else history.undo();
      } else if (mod && e.shiftKey && key === 'm') {
        e.preventDefault();
        s.setMapOnly(!s.dock.mapOnly);
      } else if (e.key === 'Escape' && s.dock.mapOnly && !e.defaultPrevented) {
        s.setMapOnly(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

/** Mount options from the stored workspace; imagery styles are assembled asynchronously. */
async function mapMountOptions(): Promise<MountOptions> {
  const s = useWorkspace.getState();
  return {
    style: await BasemapManager.styleFor(s.basemapId, s.mapTheme),
    labelPaint: BasemapManager.labelPaintFor(s.basemapId, s.mapTheme),
    view: s.view,
    fallbackBounds: INITIAL_BOUNDS,
    fallbackPadding: INITIAL_BOUNDS_PADDING,
    labelLanguage: s.settings.language,
    scaleUnit: s.settings.units,
    controlCorner: dirOf(s.settings.language) === 'rtl' ? 'top-left' : 'top-right',
  };
}

export function Workspace() {
  useWorkspaceWiring();
  useShortcuts();
  // Stored layouts may name tools that no longer exist.
  useEffect(() => useWorkspace.getState().pruneDock(toolRegistry.ids()), []);
  const mapOnly = useWorkspace((s) => s.dock.mapOnly);
  // Theme-matched backdrop while the basemap loads (no black flash on a light map).
  const placeholder = useWorkspace((s) => BasemapManager.placeholderFor(s.basemapId, s.mapTheme));
  const { t } = useTranslation();
  return (
    <>
      <WorkspaceLayout
        topBar={<TopBar />}
        body={
          <DockArea
            map={<MapView label={t('map.label')} mountOptions={mapMountOptions} background={placeholder} />}
            mapOverlay={
              <>
                <MapLoading onRetry={applyBasemap} />
                <UndoToast />
              </>
            }
          />
        }
        statusBar={<StatusBar />}
        mapOnly={mapOnly}
      />
      <MapControls />
    </>
  );
}
