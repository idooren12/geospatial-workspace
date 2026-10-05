import type { ToolDefinition } from './types';

/** Holds every tool known to the workspace. Registration order does not matter; `order` does. */
class Registry {
  private readonly tools = new Map<string, ToolDefinition>();
  private readonly listeners = new Set<() => void>();
  private snapshot: ToolDefinition[] = [];

  register(def: ToolDefinition): void {
    if (def.devOnly && !import.meta.env.DEV) return;
    if (this.tools.has(def.id)) throw new Error(`Tool "${def.id}" is already registered`);
    this.tools.set(def.id, def);
    this.snapshot = [...this.tools.values()].sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
    this.listeners.forEach((l) => l());
  }

  get(id: string): ToolDefinition | undefined {
    return this.tools.get(id);
  }

  list(): readonly ToolDefinition[] {
    return this.snapshot;
  }

  ids(): ReadonlySet<string> {
    return new Set(this.tools.keys());
  }

  /** For useSyncExternalStore. */
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getSnapshot = (): readonly ToolDefinition[] => this.snapshot;
}

export const toolRegistry = new Registry();
