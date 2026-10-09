/**
 * Session-local undo/redo (spec addition, M5). One central stack for the whole workspace: tools
 * and panels push commands, the top bar and Ctrl/Cmd+Z / Ctrl+Shift+Z / Ctrl+Y drive it.
 * In memory only — a reload starts a fresh history, as in most editors.
 */
export interface Command {
  /** What the user did, for tooltips and the undo toast ("Deleted “Fence”"). */
  label: string;
  undo(): void;
  redo(): void;
}

export interface PushOptions {
  /** Offer an Undo button right away (single-item deletes are immediate, so they must). */
  toast?: boolean;
}

export interface HistoryState {
  undoLabel: string | null;
  redoLabel: string | null;
  /** The last command pushed with `toast`, while it is still the newest one. */
  toast: { id: number; label: string } | null;
}

const LIMIT = 100;

export class History {
  private past: Command[] = [];
  private future: Command[] = [];
  private listeners = new Set<() => void>();
  private state: HistoryState = { undoLabel: null, redoLabel: null, toast: null };
  private toastSeq = 0;

  /** Records a command whose effect has already been applied. */
  push(cmd: Command, opts: PushOptions = {}): void {
    this.past.push(cmd);
    if (this.past.length > LIMIT) this.past.shift();
    this.future = [];
    this.emit(opts.toast ? { id: ++this.toastSeq, label: cmd.label } : null);
  }

  /** Applies a change and records it. */
  run(cmd: Command, opts?: PushOptions): void {
    cmd.redo();
    this.push(cmd, opts);
  }

  undo(): boolean {
    const cmd = this.past.pop();
    if (!cmd) return false;
    cmd.undo();
    this.future.push(cmd);
    this.emit(null);
    return true;
  }

  redo(): boolean {
    const cmd = this.future.pop();
    if (!cmd) return false;
    cmd.redo();
    this.past.push(cmd);
    this.emit(null);
    return true;
  }

  /** Undo only if the toast's command is still the newest (the user may have done more since). */
  undoToast(id: number): boolean {
    return this.state.toast?.id === id ? this.undo() : false;
  }

  dismissToast(): void {
    if (this.state.toast) this.emit(null);
  }

  clear(): void {
    this.past = [];
    this.future = [];
    this.emit(null);
  }

  getState = (): HistoryState => this.state;

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  private emit(toast: HistoryState['toast']): void {
    this.state = {
      undoLabel: this.past.at(-1)?.label ?? null,
      redoLabel: this.future.at(-1)?.label ?? null,
      toast,
    };
    for (const fn of this.listeners) fn();
  }
}

/** The workspace's one history. */
export const history = new History();
