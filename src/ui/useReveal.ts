import { useEffect, useRef } from 'react';

/**
 * Scrolls an element into view and flashes it (data-flash) whenever `trigger` changes to a new
 * value while `active`. The flash is a DOM attribute, not React state, so no re-render is needed.
 */
export function useReveal<T extends HTMLElement = HTMLLIElement>(active: boolean, trigger: number | undefined) {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!active || trigger === undefined || !el) return;
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    el.dataset.flash = 'true';
    el.dataset.revealed = 'true'; // stays, so tests can tell what was revealed after the flash
    const id = setTimeout(() => delete el.dataset.flash, 1600);
    return () => {
      clearTimeout(id);
      delete el.dataset.flash;
    };
  }, [active, trigger]);
  return ref;
}
