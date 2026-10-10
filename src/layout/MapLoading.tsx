import { AlertTriangle, LoaderCircle, RotateCw } from 'lucide-react';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { mapService, type MapLoadState } from '../map/MapService';
import styles from './MapLoading.module.css';

/** A fast load shows nothing; only a slow one gets the indicator (no flicker on every switch). */
const SHOW_AFTER_MS = 200;

const subscribe = (fn: () => void) => mapService.onLoadState(fn);
const getState = (): MapLoadState => mapService.getLoadState();

/**
 * Non-blocking basemap status, centred on the map (never over the attribution or the controls):
 * a small "Loading map…" pill after a short delay while the basemap loads, or an error card with
 * Retry when the style or every basemap tile failed. The map stays interactive underneath.
 */
export function MapLoading({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  const state = useSyncExternalStore(subscribe, getState);
  // The load (identified by its start time) that has been going on long enough to show.
  const [slowSince, setSlowSince] = useState<number | null>(null);
  const since = state.phase === 'loading' ? state.since : null;

  useEffect(() => {
    if (since === null) return;
    const id = setTimeout(() => setSlowSince(since), Math.max(0, SHOW_AFTER_MS - (Date.now() - since)));
    return () => clearTimeout(id);
  }, [since]);
  const slow = since !== null && slowSince === since;

  if (state.phase === 'error') {
    return (
      <div className={styles.center}>
        <div className={styles.card} role="alert" data-testid="map-error">
          <AlertTriangle size={16} aria-hidden className={styles.warn} />
          <span>{t(state.reason === 'style' ? 'mapLoad.styleError' : 'mapLoad.tilesError')}</span>
          <button type="button" className={styles.retry} onClick={onRetry} data-testid="map-retry">
            <RotateCw size={14} aria-hidden /> {t('mapLoad.retry')}
          </button>
        </div>
      </div>
    );
  }
  if (state.phase === 'loading' && slow) {
    return (
      <div className={styles.center} aria-live="polite">
        <div className={styles.pill} role="status" data-testid="map-loading">
          <LoaderCircle size={14} aria-hidden className={styles.spin} />
          {t('mapLoad.loading')}
        </div>
      </div>
    );
  }
  return null;
}
