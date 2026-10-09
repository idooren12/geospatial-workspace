import { describe, expect, it } from 'vitest';
import { History } from './history';

const counter = () => {
  const box = { n: 0 };
  const inc = (label = 'inc') => ({ label, undo: () => void box.n--, redo: () => void box.n++ });
  return { box, inc };
};

describe('History', () => {
  it('undoes and redoes in order, and a new command clears the redo stack', () => {
    const h = new History();
    const { box, inc } = counter();
    h.run(inc('a'));
    h.run(inc('b'));
    expect(box.n).toBe(2);
    expect(h.getState().undoLabel).toBe('b');
    h.undo();
    expect(box.n).toBe(1);
    expect(h.getState()).toMatchObject({ undoLabel: 'a', redoLabel: 'b' });
    h.redo();
    expect(box.n).toBe(2);
    h.undo();
    h.run(inc('c'));
    expect(h.getState().redoLabel).toBeNull();
    expect(h.redo()).toBe(false);
  });

  it('offers a toast for the newest command only', () => {
    const h = new History();
    const { box, inc } = counter();
    h.run(inc('delete'), { toast: true });
    const id = h.getState().toast!.id;
    h.run(inc('other'));
    expect(h.getState().toast).toBeNull();
    expect(h.undoToast(id)).toBe(false); // stale toast must not undo "other"
    expect(box.n).toBe(2);
  });

  it('caps its length and notifies subscribers', () => {
    const h = new History();
    const { inc } = counter();
    let calls = 0;
    const off = h.subscribe(() => calls++);
    for (let i = 0; i < 150; i++) h.run(inc());
    let undone = 0;
    while (h.undo()) undone++;
    expect(undone).toBe(100);
    expect(calls).toBe(250);
    off();
  });
});
