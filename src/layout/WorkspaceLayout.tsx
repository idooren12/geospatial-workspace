import type { ReactNode } from 'react';
import styles from './WorkspaceLayout.module.css';

interface WorkspaceLayoutProps {
  topBar: ReactNode;
  leftRail: ReactNode;
  leftRailLabel: string;
  rightRailLabel: string;
  rightRail: ReactNode;
  map: ReactNode;
  statusBar: ReactNode;
}

/**
 * The workspace grid. Dock columns (M2) are inserted as grid columns between the rails and
 * the map, so a panel always takes width from the map and never floats over it (DCK-01).
 * Under dir="rtl" the grid mirrors automatically.
 */
export function WorkspaceLayout({
  topBar,
  leftRail,
  rightRail,
  leftRailLabel,
  rightRailLabel,
  map,
  statusBar,
}: WorkspaceLayoutProps) {
  return (
    <div className={styles.layout}>
      <header className={styles.top}>{topBar}</header>
      <nav className={styles.leftRail} aria-label={leftRailLabel}>{leftRail}</nav>
      <main className={styles.main}>{map}</main>
      <nav className={styles.rightRail} aria-label={rightRailLabel}>{rightRail}</nav>
      <footer className={styles.status}>{statusBar}</footer>
    </div>
  );
}
