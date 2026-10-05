import { useEffect } from 'react';
import { applyDocumentLanguage, dirOf } from '../i18n';
import i18n from '../i18n';
import { MapControls } from '../layout/overlay/MapControls';
import { MapStatus } from '../layout/overlay/MapStatus';
import { DockArea } from '../layout/DockArea';
import { TopBar } from '../layout/TopBar';
import { toolRegistry } from '../tools/ToolRegistry';
import { WorkspaceLayout } from '../layout/WorkspaceLayout';
import { BasemapManager } from '../map/BasemapManager';
import { mapService } from '../map/MapService';
import { MapView } from '../map/MapView';
import { startPersistence, useWorkspace } from '../store/workspaceStore';

/** Wires store ⇄ map ⇄ document. Contains no domain logic. */
function useWorkspaceWiring() {
  useEffect(() => startPersistence(), []);

  // Camera → store (persisted, debounced).
  useEffect(
    () =>
      mapService.on('moveend', () => {
        const v = mapService.getView();
        if (v) useWorkspace.getState().setView(v);
      }),
    [],
  );

  // Store → map / document. Subscriptions fire on change only, never on mount.
  useEffect(() => {
    let request = 0;
    const applyBasemap = () => {
      const { basemapId, mapTheme } = useWorkspace.getState();
      const mine = ++request;
      void BasemapManager.styleFor(basemapId, mapTheme).then((style) => {
        if (mine === request) mapService.setStyle(style, BasemapManager.labelPaintFor(basemapId, mapTheme)); // ignore stale, slower requests
      });
    };
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

/** Ctrl+Shift+M toggles Map Only; Escape leaves it (unless a menu/popover took the key). */
function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useWorkspace.getState();
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'm') {
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

export function Workspace() {
  useWorkspaceWiring();
  useShortcuts();
  // Stored layouts may name tools that no longer exist.
  useEffect(() => useWorkspace.getState().pruneDock(toolRegistry.ids()), []);
  return (
    <>
      <WorkspaceLayout topBar={<TopBar />} body={<DockArea map={<MapView />} />} />
      <MapControls />
      <MapStatus />
    </>
  );
}
