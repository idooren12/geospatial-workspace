import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BasemapManager } from '../map/BasemapManager';
import { mapService } from '../map/MapService';
import { useWorkspace } from '../store/workspaceStore';
import { formatCoords, formatZoom } from '../utilities/coordinates/format';
import styles from './StatusBar.module.css';

/**
 * Cursor coordinates and zoom update the DOM directly once per animation frame,
 * so pointer movement never re-renders React (performance requirement 13.2).
 */
export function StatusBar() {
  const { t } = useTranslation();
  const coordRef = useRef<HTMLSpanElement>(null);
  const zoomRef = useRef<HTMLSpanElement>(null);
  const coordFormat = useWorkspace((s) => s.settings.coordFormat);
  const basemapId = useWorkspace((s) => s.basemapId);
  const setBasemap = useWorkspace((s) => s.setBasemap);
  const [basemapError, setBasemapError] = useState(false);

  useEffect(() => {
    let frame = 0;
    let last: { lng: number; lat: number } | null = null;
    const paint = () => {
      frame = 0;
      if (coordRef.current) {
        coordRef.current.textContent = last ? formatCoords(last.lng, last.lat, coordFormat) : t('status.noCursor');
      }
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const offMove = mapService.on('mousemove', (e) => {
      last = { lng: e.lngLat.lng, lat: e.lngLat.lat };
      schedule();
    });
    const offOut = mapService.on('mouseout', () => {
      last = null;
      schedule();
    });
    paint();
    return () => {
      offMove();
      offOut();
      cancelAnimationFrame(frame);
    };
  }, [coordFormat, t]);

  useEffect(() => {
    let frame = 0;
    const paint = () => {
      frame = 0;
      const z = mapService.getZoom();
      if (zoomRef.current && z !== null) zoomRef.current.textContent = formatZoom(z);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const offZoom = mapService.on('zoom', schedule);
    const offLoad = mapService.on('load', schedule);
    schedule();
    return () => {
      offZoom();
      offLoad();
      cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    const offErr = mapService.on('error', (e) => {
      // Style or tile fetch failures surface here; keep the map usable and say so quietly.
      const sourceId = (e as { sourceId?: string }).sourceId;
      if (!sourceId?.startsWith('ws:')) setBasemapError(true);
    });
    const offOk = mapService.onStyleLoad(() => setBasemapError(false));
    return () => {
      offErr();
      offOk();
    };
  }, []);

  const current = BasemapManager.resolve(basemapId);
  const next = BasemapManager.next(current.id);

  return (
    <div className={styles.bar}>
      <span className={styles.item} title={t('status.cursor')}>
        <span ref={coordRef} className={`num ${styles.coords}`} data-testid="cursor-coords" />
      </span>
      <span className={styles.divider} aria-hidden />
      <span className={styles.item}>
        {t('status.zoom')}{' '}
        <span ref={zoomRef} className="num" data-testid="zoom-level" />
      </span>
      <span className={styles.divider} aria-hidden />
      <button
        type="button"
        className={styles.basemap}
        onClick={() => {
          setBasemapError(false);
          setBasemap(next.id);
        }}
        title={t('status.switchBasemap', { name: t(next.nameKey) })}
        aria-label={`${t('status.basemap')}: ${t(current.nameKey)}. ${t('status.switchBasemap', { name: t(next.nameKey) })}`}
        data-testid="basemap-toggle"
      >
        {t(current.nameKey)}
      </button>
      {basemapError && (
        <span className={styles.error} role="status">
          {t('status.basemapError')}
        </span>
      )}
    </div>
  );
}
