import { Check, Copy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BasemapManager } from '../map/BasemapManager';
import { mapService } from '../map/MapService';
import { useWorkspace } from '../store/workspaceStore';
import { formatCoords, formatZoom } from '../utilities/coordinates/format';
import styles from './StatusBar.module.css';

/**
 * The status bar (spec §9.1, UTL-01/02): a fixed row under the map and docks — never on top of
 * the map — with cursor coordinates, zoom and the basemap. Coordinates and zoom are written
 * straight to the DOM once per animation frame, so pointer movement never re-renders React.
 * Hidden in Map Only (spec §4.6).
 */
export function StatusBar() {
  const { t } = useTranslation();
  const coordRef = useRef<HTMLSpanElement>(null);
  const zoomRef = useRef<HTMLSpanElement>(null);
  const last = useRef<{ lng: number; lat: number } | null>(null);
  const coordFormat = useWorkspace((s) => s.settings.coordFormat);
  const basemapId = useWorkspace((s) => s.basemapId);
  const theme = useWorkspace((s) => s.mapTheme);
  const [basemapError, setBasemapError] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let frame = 0;
    let over = false;
    const paint = () => {
      frame = 0;
      const el = coordRef.current;
      if (!el) return;
      const p = last.current;
      el.textContent = p ? formatCoords(p.lng, p.lat, coordFormat) : t('status.noCursor');
      // Off the map the last position stays, dimmed, so it can still be copied.
      el.dataset.stale = String(!!p && !over);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const offMove = mapService.on('mousemove', (e) => {
      over = true;
      last.current = { lng: e.lngLat.lng, lat: e.lngLat.lat };
      schedule();
    });
    const offOut = mapService.on('mouseout', () => {
      over = false;
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
    const offs = [mapService.on('zoom', schedule), mapService.on('load', schedule)];
    void mapService.whenMounted().then(schedule);
    return () => {
      offs.forEach((off) => off());
      cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    const offErr = mapService.on('error', (e) => {
      // Style or tile failures of the basemap surface here; the map stays usable, we just say so.
      const sourceId = (e as { sourceId?: string }).sourceId;
      if (!sourceId?.startsWith('ws:')) setBasemapError(true);
    });
    const offOk = mapService.onStyleLoad(() => setBasemapError(false));
    return () => {
      offErr();
      offOk();
    };
  }, []);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(id);
  }, [copied]);

  const copy = async () => {
    const p = last.current;
    if (!p) return;
    try {
      await navigator.clipboard.writeText(formatCoords(p.lng, p.lat, coordFormat));
      setCopied(true);
    } catch {
      /* clipboard blocked: nothing to do */
    }
  };

  const def = BasemapManager.resolve(basemapId);
  const basemapName = t(def.nameKey);
  const basemapText = BasemapManager.hasThemes(def)
    ? t('status.themeOf', { basemap: basemapName, theme: t(`layers.${theme}`) })
    : basemapName;

  return (
    <div className={styles.bar} role="group" aria-label={t('status.label')} data-testid="status-bar">
      <button
        type="button"
        className={styles.coords}
        onClick={() => void copy()}
        title={t('status.lastCursor')}
        aria-label={t('status.copy')}
        data-testid="status-coords"
      >
        <span ref={coordRef} className="num" data-testid="cursor-coords" />
        {copied ? <Check size={12} aria-hidden className={styles.copyIcon} /> : <Copy size={12} aria-hidden className={styles.copyIcon} />}
        {copied && <span className={styles.srOnly}>{t('status.copied')}</span>}
      </button>
      <span className={styles.divider} aria-hidden />
      <span className={styles.field} title={t('status.zoom')}>
        {t('status.zoom')} <span ref={zoomRef} className="num" data-testid="zoom-level" />
      </span>
      <span className={`${styles.divider} ${styles.optional}`} aria-hidden />
      <span className={`${styles.field} ${styles.optional}`} title={t('status.basemap')} data-testid="status-basemap">
        {basemapText}
      </span>
      {basemapError && (
        <>
          <span className={styles.divider} aria-hidden />
          <span className={styles.error} role="status" data-testid="status-error">
            {t('status.basemapError')}
          </span>
        </>
      )}
    </div>
  );
}
