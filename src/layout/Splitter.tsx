import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { PANEL_MIN, type DockSide } from './dockPlanner';
import styles from './dock.module.css';

interface SplitterProps {
  side: DockSide;
  width: number;
  /** Current upper bound: panel maximum, or less so the map keeps its minimum width. */
  max: number;
  dir: 'ltr' | 'rtl';
  /** id of the column this splitter resizes (aria-controls). */
  controls: string;
  /** Live preview while dragging: must not re-render React (spec §5.3). */
  onPreview: (width: number | null) => void;
  /** Commit on release / keyboard step; the planner clamps it again. */
  onCommit: (width: number) => void;
}

const KEY_STEP = 16;
const KEY_STEP_LARGE = 64;

/**
 * Vertical splitter on the map-facing edge of a dock column (WAI-ARIA window splitter). Dragging
 * toward the map widens the column; which screen direction that is depends on the dock side and the
 * text direction. Keyboard: arrows move it by 16px (Shift: 64px), PageUp/PageDown by 64px,
 * Home/End to the minimum/maximum. Pointer and keyboard share the same limits.
 */
export function Splitter({ side, width, max, dir, controls, onPreview, onCommit }: SplitterProps) {
  const { t } = useTranslation();
  const drag = useRef<{ x: number; width: number; last: number } | null>(null);
  // +1: moving the pointer right widens the column.
  const sign = (side === 'left' ? 1 : -1) * (dir === 'ltr' ? 1 : -1);
  const clamp = (w: number) => Math.round(Math.min(max, Math.max(PANEL_MIN, w)));

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, width, last: width };
    document.body.classList.add('gws-resizing');
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const next = clamp(d.width + sign * (e.clientX - d.x));
    if (next === d.last) return;
    d.last = next;
    onPreview(next);
  };
  const end = () => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    document.body.classList.remove('gws-resizing');
    onPreview(null);
    if (d.last !== d.width) onCommit(d.last); // one store update (and one save) per drag
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? KEY_STEP_LARGE : KEY_STEP;
    // Arrow keys move the splitter visually; map that to wider/narrower for this side.
    const visual = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    let next: number | null = null;
    if (visual) next = width + sign * visual * step;
    else if (e.key === 'PageUp') next = width + KEY_STEP_LARGE;
    else if (e.key === 'PageDown') next = width - KEY_STEP_LARGE;
    else if (e.key === 'Home') next = PANEL_MIN;
    else if (e.key === 'End') next = max;
    if (next === null) return;
    e.preventDefault();
    const w = clamp(next);
    if (w !== width) onCommit(w);
  };

  return (
    <div
      className={styles.splitter}
      role="separator"
      aria-orientation="vertical"
      aria-label={t('dock.resize')}
      aria-controls={controls}
      aria-valuemin={PANEL_MIN}
      aria-valuemax={max}
      aria-valuenow={width}
      aria-valuetext={t('dock.widthPx', { width })}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={end}
      onKeyDown={onKeyDown}
      data-testid="splitter"
    />
  );
}
