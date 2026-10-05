import { useEffect, useState } from 'react';

/**
 * Tap once to arm, tap again within `timeoutMs` to confirm. Used for
 * destructive actions where a modal would be heavy-handed.
 */
export function useConfirmTap(onConfirm: () => void, timeoutMs = 3000) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), timeoutMs);
    return () => clearTimeout(t);
  }, [armed, timeoutMs]);

  const tap = () => {
    if (!armed) {
      setArmed(true);
      return;
    }
    setArmed(false);
    onConfirm();
  };

  return { armed, tap };
}
