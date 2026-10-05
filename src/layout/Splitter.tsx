import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { PANEL_MAX, PANEL_MIN, type DockSide } from './dockPlanner';
import styles from './dock.module.css';

interface SplitterProps {
  side: DockSide;
  width: number;
  dir: 'ltr' | 'rtl';
  /** Live preview while dragging: must not re-render React (spec §5.3). */
  onPreview: (width: number | null) => void;
  /** Commit on release / keyboard step; the planner clamps it. */
  onCommit: (width: number) => void;
}

const KEY_STEP = 16;

/**
 * Vertical splitter on the map-facing edge of a dock column. Dragging toward the map widens the
 * column. Which screen direction that is depends on the dock side and the text direction.
 */
export function Splitter({ side, width, dir, onPreview, onCommit }: SplitterProps) {
  const { t } = useTranslation();
  const drag = useRef<{ x: number; width: number; last: number } | null>(null);
  // +1: moving the pointer right widens the column.
  const sign = (side === 'left' ? 1 : -1) * (dir === 'ltr' ? 1 : -1);
  const clamp = (w: number) => Math.round(Math.min(PANEL_MAX, Math.max(PANEL_MIN, w)));

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, width, last: width };
    document.body.classList.add('gws-resizing');
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    d.last = clamp(d.width + sign * (e.clientX - d.x));
    onPreview(d.last);
  };
  const end = () => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    document.body.classList.remove('gws-resizing');
    onPreview(null);
    if (d.last !== d.width) onCommit(d.last);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    // Arrow keys move the splitter visually; map that to wider/narrower for this side.
    const visual = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (visual) {
      e.preventDefault();
      onCommit(clamp(width + sign * visual * KEY_STEP));
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      onCommit(e.key === 'Home' ? PANEL_MIN : PANEL_MAX);
    }
  };

  return (
    <div
      className={styles.splitter}
      role="separator"
      aria-orientation="vertical"
      aria-label={t('dock.resize')}
      aria-valuemin={PANEL_MIN}
      aria-valuemax={PANEL_MAX}
      aria-valuenow={width}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
      onKeyDown={onKeyDown}
      data-testid="splitter"
    />
  );
}
