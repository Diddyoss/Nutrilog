import { useEffect } from 'react';

/** Runs `handler` on Escape while `active` — desktop dismissal for overlays. */
export function useEscapeKey(handler: () => void, active = true) {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handler();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handler, active]);
}
