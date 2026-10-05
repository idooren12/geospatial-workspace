import { describe, expect, it } from 'vitest';
import { toolRegistry } from './ToolRegistry';

const Dummy = () => null;

describe('toolRegistry', () => {
  it('lists tools by order and rejects duplicate ids', () => {
    toolRegistry.register({ id: 't-b', name: 'B', icon: null, defaultDock: 'right', component: Dummy, order: 2 });
    toolRegistry.register({ id: 't-a', name: 'A', icon: null, defaultDock: 'left', component: Dummy, order: 1 });
    const ids = toolRegistry.list().map((t) => t.id);
    expect(ids.indexOf('t-a')).toBeLessThan(ids.indexOf('t-b'));
    expect(() =>
      toolRegistry.register({ id: 't-a', name: 'A', icon: null, defaultDock: 'left', component: Dummy }),
    ).toThrow(/already registered/);
    expect(toolRegistry.ids().has('t-b')).toBe(true);
  });

  it('notifies subscribers and gives a stable snapshot between changes', () => {
    let calls = 0;
    const off = toolRegistry.subscribe(() => calls++);
    const before = toolRegistry.getSnapshot();
    expect(toolRegistry.getSnapshot()).toBe(before);
    toolRegistry.register({ id: 't-c', name: 'C', icon: null, defaultDock: 'left', component: Dummy });
    expect(calls).toBe(1);
    expect(toolRegistry.getSnapshot()).not.toBe(before);
    off();
  });
});
