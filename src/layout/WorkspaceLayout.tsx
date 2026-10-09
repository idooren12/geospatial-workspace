import type { ReactNode } from 'react';
import styles from './WorkspaceLayout.module.css';

interface WorkspaceLayoutProps {
  topBar: ReactNode;
  body: ReactNode;
  statusBar: ReactNode;
  /** Map Only hides the status bar (spec §4.6); the body takes its row. */
  mapOnly: boolean;
}

/**
 * Fixed chrome: the top bar and the status bar. Between them the body: the map with docked
 * panels beside it (see DockArea). Nothing in the chrome is ever drawn over the map.
 */
export function WorkspaceLayout({ topBar, body, statusBar, mapOnly }: WorkspaceLayoutProps) {
  return (
    <div className={styles.layout} data-map-only={mapOnly}>
      <header className={styles.top}>{topBar}</header>
      <main className={styles.main}>{body}</main>
      <footer className={styles.status} hidden={mapOnly}>
        {statusBar}
      </footer>
    </div>
  );
}
