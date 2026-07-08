import { useCallback, useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '../lib/motion';

/**
 * Two-phase close for overlays that are conditionally rendered by their parent:
 * `requestClose()` flips `closing` (drives the CSS exit animation), then calls
 * `onClose` once the animation has had time to play. Route ALL of a component's
 * close paths (backdrop tap, Cancel, successful save) through `requestClose` so
 * exits animate uniformly instead of hard-cutting on unmount.
 */
export function useExitTransition(onClose: () => void, durationMs = 240) {
  const [closing, setClosing] = useState(false);
  const timer = useRef<number | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  const requestClose = useCallback(() => {
    if (timer.current !== null) return; // already closing
    if (prefersReducedMotion()) {
      closeRef.current();
      return;
    }
    setClosing(true);
    timer.current = window.setTimeout(() => closeRef.current(), durationMs);
  }, [durationMs]);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    []
  );

  return { closing, requestClose };
}
