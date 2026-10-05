import { describe, expect, it } from 'vitest';
import {
  activatePanel,
  canSplit,
  closePanel,
  COMPACT_BELOW,
  dockWidth,
  emptyDock,
  findPanel,
  MAP_MIN,
  mapWidth,
  movePanelToOtherSide,
  openPanel,
  PANEL_DEFAULT,
  PANEL_MAX,
  PANEL_MIN,
  reflow,
  resizeColumn,
  sanitizeDock,
  setMapOnly,
  splitPanelToColumn,
  togglePanel,
  type DockState,
} from './dockPlanner';

const W = 1366;
const open = (s: DockState, id: string, side: 'left' | 'right' = 'left', w = W) => openPanel(s, id, side, w);
const shape = (s: DockState) => ({
  left: s.columns.left.map((c) => c.panelIds.join('+')),
  right: s.columns.right.map((c) => c.panelIds.join('+')),
});

/** The invariants of spec §5.2/5.4 that every layout must satisfy. */
function assertInvariants(s: DockState, bodyWidth: number) {
  const all = [...s.columns.left, ...s.columns.right].flatMap((c) => c.panelIds);
  expect(new Set(all).size).toBe(all.length); // DCK-02: a panel lives in exactly one place
  for (const c of [...s.columns.left, ...s.columns.right]) {
    expect(c.width).toBeGreaterThanOrEqual(PANEL_MIN);
    expect(c.width).toBeLessThanOrEqual(PANEL_MAX);
    expect(c.panelIds).toContain(c.activePanelId);
  }
  if (bodyWidth >= MAP_MIN + PANEL_MIN * 2 + 8) expect(mapWidth(s, bodyWidth)).toBeGreaterThanOrEqual(MAP_MIN);
}

describe('openPanel', () => {
  it('opens a first panel as a column at the default width', () => {
    const s = open(emptyDock(), 'a');
    expect(shape(s)).toEqual({ left: ['a'], right: [] });
    expect(s.columns.left[0]!.width).toBe(PANEL_DEFAULT);
  });

  it('opens both sides at once (DCK-03) and side by side on one side when room permits (DCK-04)', () => {
    let s = open(emptyDock(), 'a');
    s = open(s, 'b');
    s = open(s, 'c', 'right');
    expect(shape(s)).toEqual({ left: ['a', 'b'], right: ['c'] });
    expect(s.columns.left[1]!.panelIds).toEqual(['b']); // newest is innermost, next to the map
    assertInvariants(s, W);
  });

  it('falls back to a tab in the innermost column when another column would squeeze the map', () => {
    let s = emptyDock();
    for (const id of ['a', 'b']) s = open(s, id);
    s = open(s, 'c', 'right');
    s = open(s, 'd', 'right');
    expect(shape(s)).toEqual({ left: ['a', 'b'], right: ['c+d'] });
    expect(s.columns.right[0]!.activePanelId).toBe('d');
    assertInvariants(s, W);
  });

  it('uses a narrower column when the default does not fit but the minimum does', () => {
    const w = MAP_MIN + 2 * (PANEL_DEFAULT + 4) + 240 + 4; // room for a 240 px third column
    let s = open(emptyDock(), 'a', 'left', w);
    s = open(s, 'b', 'left', w);
    s = open(s, 'c', 'right', w);
    expect(shape(s).right).toEqual(['c']);
    expect(s.columns.right[0]!.width).toBe(240);
    assertInvariants(s, w);
  });

  it('makes room on the other side when the requested side is empty and the map is full', () => {
    const w = 1300;
    let s = emptyDock();
    s = open(s, 'a', 'left', w);
    s = open(s, 'b', 'left', w);
    s = resizeColumn(s, s.columns.left[0]!.id, 400, w);
    s = resizeColumn(s, s.columns.left[1]!.id, 400, w);
    s = open(s, 'c', 'right', w);
    expect(shape(s).right).toEqual(['c']);
    assertInvariants(s, w);
  });

  it('reuses a panel’s remembered width', () => {
    let s = open(emptyDock(), 'a');
    s = resizeColumn(s, s.columns.left[0]!.id, 360, W);
    s = closePanel(s, 'a');
    s = open(s, 'a');
    expect(s.columns.left[0]!.width).toBe(360);
  });

  it('activates an already open tab instead of opening it twice', () => {
    let s = open(emptyDock(), 'a', 'right', 800);
    s = open(s, 'b', 'right', 800);
    s = open(s, 'a', 'left', 800);
    expect(shape(s)).toEqual({ left: [], right: ['a+b'] });
    expect(s.columns.right[0]!.activePanelId).toBe('a');
  });

  it('keeps one column per side in compact widths', () => {
    let s = emptyDock();
    for (const id of ['a', 'b', 'c']) s = open(s, id, 'left', COMPACT_BELOW - 1);
    expect(shape(s)).toEqual({ left: ['a+b+c'], right: [] });
  });

  it('never breaks the invariants, whatever the sequence', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
    for (const w of [1024, 1366, 1920, 2560]) {
      let s = emptyDock();
      for (let i = 0; i < 60; i++) {
        const id = ids[(i * 7) % ids.length]!;
        const side = i % 3 === 0 ? 'right' : 'left';
        s = i % 5 === 4 ? closePanel(s, id) : togglePanel(s, id, side, w);
        assertInvariants(s, w);
      }
    }
  });
});

describe('togglePanel (rail clicks)', () => {
  it('opens, then closes on a second click', () => {
    let s = togglePanel(emptyDock(), 'a', 'left', W);
    expect(findPanel(s, 'a')).not.toBeNull();
    s = togglePanel(s, 'a', 'left', W);
    expect(findPanel(s, 'a')).toBeNull();
  });

  it('brings a hidden tab to the front instead of closing it', () => {
    let s = open(emptyDock(), 'a', 'left', 800);
    s = open(s, 'b', 'left', 800);
    s = togglePanel(s, 'a', 'left', 800);
    expect(s.columns.left[0]!.activePanelId).toBe('a');
  });
});

describe('closePanel', () => {
  it('returns all width to the map and drops the empty column (DCK-05)', () => {
    let s = open(emptyDock(), 'a');
    s = closePanel(s, 'a');
    expect(dockWidth(s)).toBe(0);
    expect(mapWidth(s, W)).toBe(W);
  });

  it('activates the neighbouring tab when the active tab closes', () => {
    let s = emptyDock();
    for (const id of ['a', 'b', 'c']) s = open(s, id, 'left', 800);
    s = activatePanel(s, 'b');
    s = closePanel(s, 'b');
    expect(s.columns.left[0]!.panelIds).toEqual(['a', 'c']);
    expect(s.columns.left[0]!.activePanelId).toBe('c');
  });
});

describe('resizeColumn', () => {
  it('clamps to the min and max panel width', () => {
    let s = open(emptyDock(), 'a');
    const id = s.columns.left[0]!.id;
    expect(resizeColumn(s, id, 100, W).columns.left[0]!.width).toBe(PANEL_MIN);
    s = resizeColumn(s, id, 999, W);
    expect(s.columns.left[0]!.width).toBe(PANEL_MAX);
  });

  it('never squeezes the map below its minimum', () => {
    let s = emptyDock();
    for (const id of ['a', 'b']) s = open(s, id, 'left', 1100);
    s = resizeColumn(s, s.columns.left[0]!.id, PANEL_MAX, 1100);
    expect(mapWidth(s, 1100)).toBeGreaterThanOrEqual(MAP_MIN);
  });
});

describe('reflow (window resize, restored layout)', () => {
  it('shrinks and then merges columns into tabs to keep the map usable', () => {
    let s = emptyDock();
    for (const id of ['a', 'b']) s = open(s, id, 'left', 2560);
    for (const id of ['c', 'd']) s = open(s, id, 'right', 2560);
    s = reflow(s, 1366);
    assertInvariants(s, 1366);
    expect(s.columns.left.length + s.columns.right.length).toBeLessThan(4);
    const all = [...s.columns.left, ...s.columns.right].flatMap((c) => c.panelIds).sort();
    expect(all).toEqual(['a', 'b', 'c', 'd']); // nothing is lost
  });

  it('is a no-op when everything fits', () => {
    const s = open(open(emptyDock(), 'a'), 'b', 'right');
    expect(reflow(s, W)).toEqual(s);
  });
});

describe('tab menu actions', () => {
  it('moves a panel to the other side', () => {
    let s = open(open(emptyDock(), 'a'), 'b');
    s = movePanelToOtherSide(s, 'a', W);
    expect(shape(s)).toEqual({ left: ['b'], right: ['a'] });
  });

  it('splits a tab into its own column only when there is room', () => {
    let s = open(emptyDock(), 'a', 'left', 800);
    s = open(s, 'b', 'left', 800);
    expect(canSplit(s, 'b', 800)).toBe(false);
    expect(canSplit(s, 'b', W)).toBe(true);
    s = splitPanelToColumn(s, 'b', W);
    expect(shape(s)).toEqual({ left: ['a', 'b'], right: [] });
    assertInvariants(s, W);
  });
});

describe('Map Only', () => {
  it('hides every column and restores the exact layout afterwards', () => {
    let s = open(open(open(emptyDock(), 'a'), 'b'), 'c', 'right');
    const before = s;
    s = setMapOnly(s, true);
    expect(dockWidth(s)).toBe(0);
    s = setMapOnly(s, false);
    expect(s.columns).toEqual(before.columns);
  });

  it('leaves Map Only when a panel is opened from a rail', () => {
    let s = setMapOnly(open(emptyDock(), 'a'), true);
    s = togglePanel(s, 'a', 'left', W);
    expect(s.mapOnly).toBe(false);
    expect(findPanel(s, 'a')).not.toBeNull();
  });
});

describe('sanitizeDock', () => {
  it('keeps valid columns and drops unknown or duplicated panels', () => {
    const s = sanitizeDock(
      {
        mapOnly: true,
        widthMemory: { a: 9999, b: 'x' },
        columns: {
          left: [
            { id: 'c1', width: 300, panelIds: ['a', 'gone'], activePanelId: 'gone' },
            { id: 'c2', width: 50, panelIds: ['a'] },
          ],
          right: 'nonsense',
        },
      },
      new Set(['a', 'b']),
    );
    expect(s.mapOnly).toBe(true);
    expect(s.widthMemory).toEqual({ a: PANEL_MAX });
    expect(s.columns.left).toEqual([{ id: 'c1', width: 300, panelIds: ['a'], activePanelId: 'a' }]);
    expect(s.columns.right).toEqual([]);
  });

  it('returns an empty dock for garbage', () => {
    expect(sanitizeDock(null, new Set())).toEqual(emptyDock());
    expect(sanitizeDock(42, new Set())).toEqual(emptyDock());
  });
});
