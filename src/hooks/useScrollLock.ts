import { useEffect } from 'react';

// Overlays can stack (sheet → modal), so the body unlocks only when the
// last locker unmounts.
let lockCount = 0;

/** Locks body scroll while `active` — call from any full-screen overlay. */
export function useScrollLock(active = true) {
  useEffect(() => {
    if (!active) return;
    lockCount += 1;
    if (lockCount === 1) document.body.style.overflow = 'hidden';
    return () => {
      lockCount -= 1;
      if (lockCount === 0) document.body.style.overflow = '';
    };
  }, [active]);
}
