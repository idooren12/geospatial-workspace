import type { ReactNode } from 'react';
import styles from './WorkspaceLayout.module.css';

interface WorkspaceLayoutProps {
  topBar: ReactNode;
  map: ReactNode;
}

/**
 * Only the top bar is fixed chrome; the map runs edge to edge beneath it, with tools and
 * status floating on top. Dock columns (M2) will be grid columns beside the map, so a docked
 * panel always takes width from the map and never floats over it (DCK-01).
 * Under dir="rtl" the grid mirrors automatically.
 */
export function WorkspaceLayout({ topBar, map }: WorkspaceLayoutProps) {
  return (
    <div className={styles.layout}>
      <header className={styles.top}>{topBar}</header>
      <main className={styles.main}>{map}</main>
    </div>
  );
}
