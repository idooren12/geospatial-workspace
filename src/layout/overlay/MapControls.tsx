import { Layers, Moon, Ruler, Sun } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { BasemapManager } from '../../map/BasemapManager';
import { mapService } from '../../map/MapService';
import { useWorkspace } from '../../store/workspaceStore';
import { isActive } from '../dockPlanner';
import { MapButton } from './MapButton';

/** Panel id of the built-in Layers panel (registered in src/app/builtinTools.tsx). */
const LAYERS_PANEL = 'layers';
/** Panel id of the built-in Measure & draw panel. */
const MEASURE_PANEL = 'measure';
import styles from './overlay.module.css';

/** Layers, measure & draw, and light/dark buttons, rendered inside the map under the zoom controls. */
export function MapControls() {
  return createPortal(
    <div className={styles.group}>
      <LayersButton />
      <MeasureButton />
      <ThemeToggle />
    </div>,
    mapService.getControlSlot('tools'),
  );
}

/** Opens the Layers panel (basemap choice + workspace layers). Pressed while the panel shows. */
function LayersButton() {
  const { t } = useTranslation();
  const showing = useWorkspace((s) => !s.dock.mapOnly && isActive(s.dock, LAYERS_PANEL));
  const toggle = useWorkspace((s) => s.togglePanel);
  return (
    <MapButton
      label={t('tools.layers')}
      icon={<Layers size={16} aria-hidden />}
      aria-pressed={showing}
      onClick={() => toggle(LAYERS_PANEL)}
      data-testid="layers-button"
    />
  );
}

/** Opens the Measure & draw panel. */
function MeasureButton() {
  const { t } = useTranslation();
  const showing = useWorkspace((s) => !s.dock.mapOnly && isActive(s.dock, MEASURE_PANEL));
  const toggle = useWorkspace((s) => s.togglePanel);
  return (
    <MapButton
      label={t('tools.measure')}
      icon={<Ruler size={16} aria-hidden />}
      aria-pressed={showing}
      onClick={() => toggle(MEASURE_PANEL)}
      data-testid="measure-button"
    />
  );
}

/** Shows the icon of the theme it switches TO, and says so in its tooltip. */
function ThemeToggle() {
  const { t } = useTranslation();
  const basemapId = useWorkspace((s) => s.basemapId);
  const theme = useWorkspace((s) => s.mapTheme);
  const setMapTheme = useWorkspace((s) => s.setMapTheme);
  if (!BasemapManager.hasThemes(BasemapManager.resolve(basemapId))) return null;

  const toDark = theme === 'light';
  return (
    <MapButton
      label={t(toDark ? 'theme.toDark' : 'theme.toLight')}
      icon={toDark ? <Moon size={16} aria-hidden /> : <Sun size={16} aria-hidden />}
      onClick={() => setMapTheme(toDark ? 'dark' : 'light')}
      data-testid="theme-toggle"
    />
  );
}
