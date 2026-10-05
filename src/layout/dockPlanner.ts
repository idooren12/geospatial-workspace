/**
 * Dock layout planner — pure functions, no React, no DOM.
 *
 * The workspace body is one row: [start columns][map][end columns]. Each column holds one panel
 * or a tab group. Every column carries a splitter on its map-facing side. These functions decide
 * where a panel goes so that panels never overlap and the map never drops below MAP_MIN
 * (spec §5.2–5.4). "left"/"right" are logical: inline-start/inline-end, mirrored in RTL.
 */

export type DockSide = 'left' | 'right';

export interface DockColumn {
  id: string;
  width: number;
  panelIds: string[];
  activePanelId: string;
}

export interface DockState {
  /** Per side, ordered from the page edge inward: the last column touches the map. */
  columns: Record<DockSide, DockColumn[]>;
  mapOnly: boolean;
  /** Last width of each panel, reused when it is opened again. */
  widthMemory: Record<string, number>;
}

export const PANEL_MIN = 220;
export const PANEL_DEFAULT = 280;
export const PANEL_MAX = 450;
export const MAP_MIN = 500;
export const SPLITTER = 4;
/** Below this body width, at most one column per side; extra panels become tabs (spec §13.1). */
export const COMPACT_BELOW = 900;

export const emptyDock = (): DockState => ({ columns: { left: [], right: [] }, mapOnly: false, widthMemory: {} });

const SIDES: DockSide[] = ['left', 'right'];
export const otherSide = (s: DockSide): DockSide => (s === 'left' ? 'right' : 'left');
const clampWidth = (w: number) => Math.round(Math.min(PANEL_MAX, Math.max(PANEL_MIN, w)));

let idSeq = 0;
const newColumnId = () => `col-${Date.now().toString(36)}-${(idSeq++).toString(36)}`;

/** Total width taken by docked columns (plus their splitters). */
export function dockWidth(state: DockState): number {
  if (state.mapOnly) return 0;
  return SIDES.reduce((sum, s) => sum + state.columns[s].reduce((a, c) => a + c.width + SPLITTER, 0), 0);
}

/** Width left for the map. */
export function mapWidth(state: DockState, bodyWidth: number): number {
  return bodyWidth - dockWidth(state);
}

export function findPanel(state: DockState, panelId: string): { side: DockSide; column: DockColumn; index: number } | null {
  for (const side of SIDES) {
    const index = state.columns[side].findIndex((c) => c.panelIds.includes(panelId));
    const column = state.columns[side][index];
    if (column) return { side, column, index };
  }
  return null;
}

export const isOpen = (state: DockState, panelId: string) => findPanel(state, panelId) !== null;

export const isActive = (state: DockState, panelId: string) => findPanel(state, panelId)?.column.activePanelId === panelId;

function clone(state: DockState): DockState {
  return {
    mapOnly: state.mapOnly,
    widthMemory: { ...state.widthMemory },
    columns: {
      left: state.columns.left.map((c) => ({ ...c, panelIds: [...c.panelIds] })),
      right: state.columns.right.map((c) => ({ ...c, panelIds: [...c.panelIds] })),
    },
  };
}

function freeSpace(state: DockState, bodyWidth: number): number {
  return bodyWidth - dockWidth({ ...state, mapOnly: false }) - MAP_MIN;
}

/** Merges the innermost column of a side into its neighbour as tabs. Returns false if nothing to merge. */
function mergeInnermost(state: DockState, side: DockSide): boolean {
  const cols = state.columns[side];
  if (cols.length < 2) return false;
  const inner = cols.pop()!;
  const target = cols[cols.length - 1]!;
  target.panelIds.push(...inner.panelIds);
  target.activePanelId = inner.activePanelId;
  target.width = Math.max(target.width, inner.width);
  return true;
}

/**
 * Restores the invariants after the body width changed or a layout was loaded:
 * compact mode allows one column per side; otherwise shrink columns toward PANEL_MIN, then merge
 * innermost columns into tab groups (the side with more columns first) until the map fits.
 */
export function reflow(input: DockState, bodyWidth: number): DockState {
  const state = clone(input);
  if (bodyWidth < COMPACT_BELOW) {
    for (const side of SIDES) while (mergeInnermost(state, side));
  }
  for (const side of SIDES) for (const c of state.columns[side]) c.width = clampWidth(c.width);

  let deficit = -freeSpace(state, bodyWidth);
  if (deficit <= 0) return state;

  // 1. Shrink, innermost columns first.
  for (const side of SIDES) {
    for (const c of [...state.columns[side]].reverse()) {
      if (deficit <= 0) break;
      const take = Math.min(c.width - PANEL_MIN, deficit);
      c.width -= take;
      deficit -= take;
    }
  }
  // 2. Merge into tabs, side with more columns first.
  while (deficit > 0) {
    const side = state.columns.left.length >= state.columns.right.length ? 'left' : 'right';
    const before = dockWidth(state);
    if (!mergeInnermost(state, side) && !mergeInnermost(state, otherSide(side))) break;
    deficit -= before - dockWidth(state);
  }
  return state;
}

/**
 * Opens a panel (spec §4.3). Already open → just activate its tab. Otherwise, in order:
 * a new column at the default width; a narrower new column; a tab in the side's innermost
 * column; finally, make room by shrinking or tab-merging the other side.
 */
export function openPanel(input: DockState, panelId: string, side: DockSide, bodyWidth: number): DockState {
  const found = findPanel(input, panelId);
  if (found) return activatePanel(input, panelId);

  const state = clone(input);
  state.mapOnly = false;
  const cols = state.columns[side];
  const wanted = clampWidth(state.widthMemory[panelId] ?? PANEL_DEFAULT);
  const compact = bodyWidth < COMPACT_BELOW;
  const free = freeSpace(state, bodyWidth) - SPLITTER;

  const addColumn = (width: number) => {
    cols.push({ id: newColumnId(), width, panelIds: [panelId], activePanelId: panelId });
  };

  if (!(compact && cols.length > 0)) {
    if (free >= wanted) {
      addColumn(wanted);
      return state;
    }
    if (free >= PANEL_MIN) {
      addColumn(Math.floor(free));
      return state;
    }
  }
  const inner = cols[cols.length - 1];
  if (inner) {
    inner.panelIds.push(panelId);
    inner.activePanelId = panelId;
    return state;
  }
  // The side is empty and there is no room: take it from the other side.
  addColumn(PANEL_MIN);
  return reflow(state, bodyWidth);
}

/** Rail behaviour: closed → open; open but hidden behind another tab → show it; showing → close. */
export function togglePanel(state: DockState, panelId: string, side: DockSide, bodyWidth: number): DockState {
  if (!isOpen(state, panelId)) return openPanel(state, panelId, side, bodyWidth);
  if (!isActive(state, panelId) || state.mapOnly) return { ...activatePanel(state, panelId), mapOnly: false };
  return closePanel(state, panelId);
}

export function activatePanel(input: DockState, panelId: string): DockState {
  const found = findPanel(input, panelId);
  if (!found || found.column.activePanelId === panelId) return input;
  const state = clone(input);
  state.columns[found.side][found.index]!.activePanelId = panelId;
  return state;
}

/** DCK-05: closing returns the width to the map; an emptied column disappears. */
export function closePanel(input: DockState, panelId: string): DockState {
  const found = findPanel(input, panelId);
  if (!found) return input;
  const state = clone(input);
  const cols = state.columns[found.side];
  const col = cols[found.index]!;
  state.widthMemory[panelId] = col.width;
  const at = col.panelIds.indexOf(panelId);
  col.panelIds.splice(at, 1);
  if (col.panelIds.length === 0) cols.splice(found.index, 1);
  else if (col.activePanelId === panelId) col.activePanelId = col.panelIds[Math.min(at, col.panelIds.length - 1)]!;
  return state;
}

/** Splitter: the new width is clamped to [PANEL_MIN, PANEL_MAX] and to what keeps the map ≥ MAP_MIN. */
export function resizeColumn(input: DockState, columnId: string, width: number, bodyWidth: number): DockState {
  const state = clone(input);
  for (const side of SIDES) {
    const col = state.columns[side].find((c) => c.id === columnId);
    if (!col) continue;
    const maxByMap = col.width + freeSpace(state, bodyWidth);
    col.width = clampWidth(Math.min(width, Math.max(PANEL_MIN, maxByMap)));
    for (const p of col.panelIds) state.widthMemory[p] = col.width;
    return state;
  }
  return input;
}

/** Tab menu: move a panel to the other dock. */
export function movePanelToOtherSide(state: DockState, panelId: string, bodyWidth: number): DockState {
  const found = findPanel(state, panelId);
  if (!found) return state;
  return openPanel(closePanel(state, panelId), panelId, otherSide(found.side), bodyWidth);
}

/** Tab menu: take a tab out of its group into its own column on the same side, if there is room. */
export function splitPanelToColumn(input: DockState, panelId: string, bodyWidth: number): DockState {
  const found = findPanel(input, panelId);
  if (!found || found.column.panelIds.length < 2) return input;
  if (bodyWidth < COMPACT_BELOW || freeSpace(input, bodyWidth) - SPLITTER < PANEL_MIN) return input;
  const state = closePanel(input, panelId);
  const width = Math.min(clampWidth(state.widthMemory[panelId] ?? PANEL_DEFAULT), Math.floor(freeSpace(state, bodyWidth) - SPLITTER));
  const cols = state.columns[found.side];
  // Place it right inside of the column it came from.
  const at = cols.findIndex((c) => c.id === found.column.id);
  cols.splice(at + 1, 0, { id: newColumnId(), width, panelIds: [panelId], activePanelId: panelId });
  return state;
}

export function canSplit(state: DockState, panelId: string, bodyWidth: number): boolean {
  const found = findPanel(state, panelId);
  return (
    !!found &&
    found.column.panelIds.length > 1 &&
    bodyWidth >= COMPACT_BELOW &&
    freeSpace(state, bodyWidth) - SPLITTER >= PANEL_MIN
  );
}

export function setMapOnly(state: DockState, mapOnly: boolean): DockState {
  // Columns stay in state untouched, so leaving Map Only restores the exact layout.
  return state.mapOnly === mapOnly ? state : { ...state, mapOnly };
}

/** Drops unknown panels (e.g. a tool that no longer exists) and malformed columns from stored state. */
/** `knownPanels` null accepts any id (structure-only check, before tools are registered). */
export function sanitizeDock(raw: unknown, knownPanels: ReadonlySet<string> | null): DockState {
  const state = emptyDock();
  if (!raw || typeof raw !== 'object') return state;
  const o = raw as Record<string, unknown>;
  state.mapOnly = o.mapOnly === true;
  const mem = o.widthMemory;
  if (mem && typeof mem === 'object') {
    for (const [k, v] of Object.entries(mem)) if (typeof v === 'number' && Number.isFinite(v)) state.widthMemory[k] = clampWidth(v);
  }
  const seen = new Set<string>();
  const cols = (o.columns ?? {}) as Record<string, unknown>;
  for (const side of SIDES) {
    const list = Array.isArray(cols[side]) ? (cols[side] as unknown[]) : [];
    for (const c of list) {
      if (!c || typeof c !== 'object') continue;
      const col = c as Record<string, unknown>;
      const ids = (Array.isArray(col.panelIds) ? col.panelIds : []).filter(
        (p): p is string => typeof p === 'string' && (knownPanels === null || knownPanels.has(p)) && !seen.has(p),
      );
      if (ids.length === 0) continue;
      ids.forEach((p) => seen.add(p));
      const active = typeof col.activePanelId === 'string' && ids.includes(col.activePanelId) ? col.activePanelId : ids[0]!;
      state.columns[side].push({
        id: typeof col.id === 'string' ? col.id : newColumnId(),
        width: clampWidth(typeof col.width === 'number' ? col.width : PANEL_DEFAULT),
        panelIds: ids,
        activePanelId: active,
      });
    }
  }
  return state;
}
