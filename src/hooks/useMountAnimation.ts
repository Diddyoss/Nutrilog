import { useEffect, useState } from 'react';
import { prefersReducedMotion } from '../lib/motion';

/**
 * False on first paint, true one frame later — lets CSS transitions animate
 * values "in from zero" on mount (transitions never run on the initial
 * render, so charts otherwise jump straight to their final state).
 * Immediately true under reduced motion.
 */
export function useMountAnimation(): boolean {
  const [ready, setReady] = useState(() => prefersReducedMotion());

  useEffect(() => {
    if (ready) return;
    let id2 = 0;
    const id1 = requestAnimationFrame(() => {
      id2 = requestAnimationFrame(() => setReady(true));
    });
    return () => {
      cancelAnimationFrame(id1);
      if (id2) cancelAnimationFrame(id2);
    };
  }, [ready]);

  return ready;
}
