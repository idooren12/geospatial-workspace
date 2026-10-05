import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { applyDocumentLanguage, dirOf } from '../i18n';
import i18n from '../i18n';
import { WorkspaceLayout } from '../layout/WorkspaceLayout';
import { StatusBar } from '../layout/StatusBar';
import { TopBar } from '../layout/TopBar';
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
    const offs = [
      useWorkspace.subscribe(
        (s) => s.basemapId,
        (id) => mapService.setStyle(BasemapManager.resolve(id).styleUrl),
      ),
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
  const { t } = useTranslation();

  // Rails are filled from the Tool Registry in M3.
  return (
    <WorkspaceLayout
      topBar={<TopBar />}
      leftRailLabel={t('rail.left')}
      rightRailLabel={t('rail.right')}
      leftRail={null}
      rightRail={null}
      map={<MapView />}
      statusBar={<StatusBar />}
    />
  );
}
