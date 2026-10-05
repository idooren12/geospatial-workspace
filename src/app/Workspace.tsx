import { useEffect } from 'react';
import { applyDocumentLanguage, dirOf } from '../i18n';
import i18n from '../i18n';
import { MapControls } from '../layout/overlay/MapControls';
import { MapStatus } from '../layout/overlay/MapStatus';
import { TopBar } from '../layout/TopBar';
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
        if (mine === request) mapService.setStyle(style); // ignore stale, slower requests
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

export function Workspace() {
  useWorkspaceWiring();
  return (
    <>
      <WorkspaceLayout topBar={<TopBar />} map={<MapView />} />
      <MapControls />
      <MapStatus />
    </>
  );
}
