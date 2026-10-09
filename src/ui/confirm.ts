export interface ConfirmOptions {
  title: string;
  /** What exactly will be removed. */
  description: string;
  /** Extra line, e.g. how to undo. */
  hint?: string;
  confirmLabel: string;
  cancelLabel: string;
  danger?: boolean;
}

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void; returnFocus: HTMLElement | null };

let pending: Pending | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

/**
 * Asks the user to confirm a destructive action that removes more than one item (spec M5 #6).
 * Resolves true on confirm, false on cancel / Escape. Only one dialog at a time.
 */
export function confirmAction(opts: ConfirmOptions): Promise<boolean> {
  pending?.resolve(false);
  return new Promise((resolve) => {
    // Let a menu that triggered this finish closing first: two Radix modal layers opening and
    // closing in the same tick can leave the page with pointer-events disabled.
    setTimeout(() => {
      // Opened from code (no trigger element), so remember where focus is, to put it back.
      const active = document.activeElement;
      pending = { ...opts, resolve, returnFocus: active instanceof HTMLElement ? active : null };
      emit();
    }, 0);
  });
}

let lastReturnFocus: HTMLElement | null = null;

/** Where focus goes when the dialog has closed (the element that opened it). */
export function takeReturnFocus(): HTMLElement | null {
  const el = lastReturnFocus;
  lastReturnFocus = null;
  return el;
}

export function closeConfirm(ok: boolean) {
  const p = pending;
  lastReturnFocus = p?.returnFocus ?? null;
  pending = null;
  emit();
  p?.resolve(ok);
}

export const confirmStore = {
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  get: () => pending,
};
