import type { ReactNode } from 'react';
import styles from './WorkspaceLayout.module.css';

interface WorkspaceLayoutProps {
  topBar: ReactNode;
  body: ReactNode;
}

/**
 * Only the top bar is fixed chrome; the map runs edge to edge beneath it, with tools and
 * status floating on top. Docked panels live in the body beside the map (see DockArea).
 */
export function WorkspaceLayout({ topBar, body }: WorkspaceLayoutProps) {
  return (
    <div className={styles.layout}>
      <header className={styles.top}>{topBar}</header>
      <main className={styles.main}>{body}</main>
    </div>
  );
}
