import { Languages, Maximize2, Minimize2, Redo2, Settings, Undo2 } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { history } from '../history/history';
import { DEBUG_MODE } from '../persistence';
import { isActive } from './dockPlanner';
import { useTranslation } from 'react-i18next';
import { useWorkspace } from '../store/workspaceStore';
import { IconButton } from '../ui/IconButton';
import styles from './TopBar.module.css';

export function TopBar() {
  const { t } = useTranslation();
  const language = useWorkspace((s) => s.settings.language);
  const updateSettings = useWorkspace((s) => s.updateSettings);
  const mapOnly = useWorkspace((s) => s.dock.mapOnly);
  const setMapOnly = useWorkspace((s) => s.setMapOnly);
  const settingsShowing = useWorkspace((s) => !s.dock.mapOnly && isActive(s.dock, 'settings'));
  const togglePanel = useWorkspace((s) => s.togglePanel);
  const undoLabel = useSyncExternalStore(history.subscribe, () => history.getState().undoLabel);
  const redoLabel = useSyncExternalStore(history.subscribe, () => history.getState().redoLabel);

  return (
    <div className={styles.bar}>
      <div className={styles.brand}>
        <span className={styles.logo} aria-hidden />
        <span className={styles.name} lang="en">
          {t('app.name')}
        </span>
        <span className={styles.sep} aria-hidden>
          /
        </span>
        <span className={styles.workspace} title={t('app.workspace')}>
          {t('app.untitled')}
        </span>
        {DEBUG_MODE && (
          <span className={styles.debug} role="status" title={t('debugMode.hint')} data-testid="debug-badge">
            {t('debugMode.badge')}
          </span>
        )}
      </div>
      <div className={styles.actions}>
        <IconButton
          label={undoLabel ? t('history.undoWhat', { what: undoLabel }) : t('history.nothingToUndo')}
          icon={<Undo2 size={16} aria-hidden className="mirror-rtl" />}
          aria-disabled={!undoLabel}
          onClick={() => history.undo()}
          data-testid="undo"
        />
        <IconButton
          label={redoLabel ? t('history.redoWhat', { what: redoLabel }) : t('history.nothingToRedo')}
          icon={<Redo2 size={16} aria-hidden className="mirror-rtl" />}
          aria-disabled={!redoLabel}
          onClick={() => history.redo()}
          data-testid="redo"
        />
        <span className={styles.divider} aria-hidden />
        <IconButton
          label={t(mapOnly ? 'topbar.exitMapOnly' : 'topbar.mapOnly')}
          icon={mapOnly ? <Minimize2 size={16} aria-hidden /> : <Maximize2 size={16} aria-hidden />}
          pressed={mapOnly}
          onClick={() => setMapOnly(!mapOnly)}
          data-testid="map-only"
        />
        <IconButton
          label={t('topbar.settings')}
          icon={<Settings size={16} aria-hidden />}
          pressed={settingsShowing}
          onClick={() => togglePanel('settings')}
          data-testid="topbar-settings"
        />
        <span className={styles.divider} aria-hidden />
        <IconButton
          label={t('topbar.switchLanguage')}
          icon={
            <>
              <Languages size={16} aria-hidden />
              <span className={styles.lang}>{t('topbar.languageShort')}</span>
            </>
          }
          onClick={() => updateSettings({ language: language === 'he' ? 'en' : 'he' })}
        />
      </div>
    </div>
  );
}
