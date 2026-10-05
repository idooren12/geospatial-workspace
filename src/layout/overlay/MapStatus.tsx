import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { mapService } from '../../map/MapService';
import { useWorkspace } from '../../store/workspaceStore';
import { formatCoords, formatZoom } from '../../utilities/coordinates/format';
import styles from './overlay.module.css';

/**
 * Floating readout in the bottom corner of the map: cursor coordinates and zoom.
 * Values are written straight to the DOM once per frame, so pointer movement never
 * re-renders React (performance requirement 13.2).
 */
export function MapStatus() {
  const { t } = useTranslation();
  const coordRef = useRef<HTMLSpanElement>(null);
  const zoomRef = useRef<HTMLSpanElement>(null);
  const coordFormat = useWorkspace((s) => s.settings.coordFormat);
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
    void mapService.whenMounted().then(schedule);
    return () => {
      offZoom();
      offLoad();
      cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    const offErr = mapService.on('error', (e) => {
      // Style or tile fetch failures surface here; the map stays usable, we just say so.
      const sourceId = (e as { sourceId?: string }).sourceId;
      if (!sourceId?.startsWith('ws:')) setBasemapError(true);
    });
    const offOk = mapService.onStyleLoad(() => setBasemapError(false));
    return () => {
      offErr();
      offOk();
    };
  }, []);

  return createPortal(
    <div className={styles.status}>
      <span title={t('status.cursor')}>
        <span ref={coordRef} className={`num ${styles.coords}`} data-testid="cursor-coords" />
      </span>
      <span className={styles.divider} aria-hidden />
      <span>
        {t('status.zoom')} <span ref={zoomRef} className="num" data-testid="zoom-level" />
      </span>
      {basemapError && (
        <>
          <span className={styles.divider} aria-hidden />
          <span className={styles.error} role="status">
            {t('status.basemapError')}
          </span>
        </>
      )}
    </div>,
    mapService.getControlSlot('status'),
  );
}
