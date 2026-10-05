import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useWorkspace } from '../store/workspaceStore';
import { dirOf } from '../i18n';
import { BasemapManager } from './BasemapManager';
import { INITIAL_BOUNDS, INITIAL_BOUNDS_PADDING } from './mapConfig';
import { mapService } from './MapService';
import styles from './MapView.module.css';

/**
 * Renders the one map container. It sits in a fixed grid cell, so opening, closing or
 * resizing panels never re-renders it; MapService's ResizeObserver handles map.resize().
 */
export function MapView() {
  const ref = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const s = useWorkspace.getState();
    // Imagery styles are assembled asynchronously; mount is idempotent, so a StrictMode
    // double-run resolving twice still creates one map.
    void BasemapManager.styleFor(s.basemapId, s.mapTheme).then((style) =>
      mapService.mount(el, {
        style,
        view: s.view,
        fallbackBounds: INITIAL_BOUNDS,
        fallbackPadding: INITIAL_BOUNDS_PADDING,
        labelLanguage: s.settings.language,
        scaleUnit: s.settings.units,
        controlCorner: dirOf(s.settings.language) === 'rtl' ? 'top-left' : 'top-right',
      }),
    );
    // No cleanup: the map lives for the whole page (MAP-01).
  }, []);

  return <div ref={ref} className={styles.map} role="region" aria-label={t('map.label')} />;
}
