import { useEffect, useRef } from 'react';
import { mapService, type MountOptions } from './MapService';
import styles from './MapView.module.css';

interface MapViewProps {
  /** Accessible name of the map region (translated by the app). */
  label: string;
  /**
   * Builds the mount options once, when the container exists. The app supplies it, so Map Core
   * knows nothing about the store, settings or languages.
   */
  mountOptions: () => Promise<MountOptions>;
}

/**
 * Renders the one map container. It sits in a fixed grid cell, so opening, closing or
 * resizing panels never re-renders it; MapService's ResizeObserver handles map.resize().
 */
export function MapView({ label, mountOptions }: MapViewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const options = useRef(mountOptions);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // mount is idempotent, so a StrictMode double-run resolving twice still creates one map.
    void options.current().then((o) => mapService.mount(el, o));
    // No cleanup: the map lives for the whole page (MAP-01).
  }, []);

  return <div ref={ref} className={styles.map} role="region" aria-label={label} />;
}
