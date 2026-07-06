import { useCallback, useEffect, useRef } from 'react';
import { prefersReducedMotion } from '../lib/motion';

interface DragDismissOptions {
  /** Called when a drag ends past the dismiss threshold. */
  onDismiss: () => void;
  /** Fraction of the element's height that must be dragged down to dismiss. */
  threshold?: number;
  /** Release velocity (px/ms, downward) that dismisses regardless of distance. */
  velocity?: number;
}

/**
 * Pointer-driven drag-to-dismiss for bottom sheets. Attach `targetRef` to the
 * sheet element and spread `handleProps` onto the drag surface (the grab
 * handle area — not the scrollable body). Downward drags track the finger
 * 1:1; upward drags rubber-band at 1/3. On release: dismiss when past the
 * distance threshold or flicked faster than `velocity`, otherwise spring back.
 * On dismiss the dragged transform is left in place so a `to`-only exit
 * animation continues from under the finger.
 */
export function useDragDismiss({ onDismiss, threshold = 0.35, velocity = 0.5 }: DragDismissOptions) {
  const targetRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef({ startY: 0, lastY: 0, lastT: 0, v: 0, active: false });
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  const onPointerMove = useCallback((e: PointerEvent) => {
    const el = targetRef.current;
    const d = drag.current;
    if (!el || !d.active) return;
    const dt = e.timeStamp - d.lastT;
    if (dt > 0) d.v = (e.clientY - d.lastY) / dt;
    d.lastY = e.clientY;
    d.lastT = e.timeStamp;
    const dy = e.clientY - d.startY;
    el.style.transform = `translateY(${dy >= 0 ? dy : dy / 3}px)`;
  }, []);

  const settle = useCallback(() => {
    const el = targetRef.current;
    const d = drag.current;
    if (!el || !d.active) return;
    d.active = false;
    window.removeEventListener('pointermove', onPointerMove);
    const dy = d.lastY - d.startY;
    if (dy > 0 && (d.v > velocity || dy > el.offsetHeight * threshold)) {
      dismissRef.current(); // exit animation takes over from the dragged position
      return;
    }
    if (prefersReducedMotion()) {
      el.style.transform = '';
      return;
    }
    // Spring back to rest.
    el.style.transition = 'transform 320ms var(--spring)';
    el.style.transform = 'translateY(0)';
    const clear = () => {
      el.style.transition = '';
      el.style.transform = '';
      el.removeEventListener('transitionend', clear);
    };
    el.addEventListener('transitionend', clear);
  }, [onPointerMove, threshold, velocity]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const el = targetRef.current;
      if (!el) return;
      drag.current = { startY: e.clientY, lastY: e.clientY, lastT: e.timeStamp, v: 0, active: true };
      el.style.transition = '';
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', settle, { once: true });
      window.addEventListener('pointercancel', settle, { once: true });
    },
    [onPointerMove, settle]
  );

  useEffect(
    () => () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', settle);
      window.removeEventListener('pointercancel', settle);
    },
    [onPointerMove, settle]
  );

  return { targetRef, handleProps: { onPointerDown } };
}
