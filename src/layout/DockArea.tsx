import { Fragment, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { useWorkspace } from '../store/workspaceStore';
import { SPLITTER, type DockColumn, type DockState } from './dockPlanner';
import { DockColumnView } from './DockColumnView';
import { Rail } from './Rail';
import { Splitter } from './Splitter';
import styles from './dock.module.css';

/** Grid columns, in DOM order: start columns (edge → map), the map, end columns (map → edge). */
function template(dock: DockState, override?: { id: string; width: number }): string {
  if (dock.mapOnly) return 'minmax(0, 1fr)';
  const w = (c: DockColumn) => (override?.id === c.id ? override.width : c.width);
  const start = dock.columns.left.map((c) => `${w(c)}px ${SPLITTER}px`);
  const end = [...dock.columns.right].reverse().map((c) => `${SPLITTER}px ${w(c)}px`);
  return [...start, 'minmax(0, 1fr)', ...end].join(' ');
}

/**
 * The workspace body: docked columns beside the map, never over it (DCK-01). Column widths change
 * the real map container size; MapService's ResizeObserver resizes MapLibre (MAP-02). The map
 * element is a stable child, so nothing here remounts it.
 */
export function DockArea({ map }: { map: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const dock = useWorkspace((s) => s.dock);
  const dir = useWorkspace((s) => s.settings.language) === 'he' ? 'rtl' : 'ltr';
  const setBodyWidth = useWorkspace((s) => s.setBodyWidth);
  const resize = useWorkspace((s) => s.resizeColumn);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    setBodyWidth(el.clientWidth);
    const ro = new ResizeObserver(() => setBodyWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, [setBodyWidth]);

  // Splitter drags write the grid template straight to the DOM; the store hears only the release.
  const preview = useCallback(
    (id: string, width: number | null) => {
      const el = ref.current;
      if (el) el.style.gridTemplateColumns = template(dock, width === null ? undefined : { id, width });
    },
    [dock],
  );

  const columnFor = (col: DockColumn, side: 'left' | 'right') => {
    const splitter = (
      <div className={styles.splitterCell} hidden={dock.mapOnly}>
        <Splitter
          side={side}
          width={col.width}
          dir={dir}
          onPreview={(w) => preview(col.id, w)}
          onCommit={(w) => resize(col.id, w)}
        />
      </div>
    );
    const view = (
      <div className={styles.columnCell} hidden={dock.mapOnly}>
        <DockColumnView column={col} />
      </div>
    );
    return (
      <Fragment key={col.id}>
        {side === 'left' ? view : splitter}
        {side === 'left' ? splitter : view}
      </Fragment>
    );
  };

  return (
    <div ref={ref} className={styles.area} style={{ gridTemplateColumns: template(dock) }} data-testid="dock-area">
      {dock.columns.left.map((c) => columnFor(c, 'left'))}
      <div className={styles.mapCell} data-testid="map-cell">
        {map}
        <Rail side="left" />
        <Rail side="right" />
      </div>
      {[...dock.columns.right].reverse().map((c) => columnFor(c, 'right'))}
    </div>
  );
}
