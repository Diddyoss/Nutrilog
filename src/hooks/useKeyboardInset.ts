import { useEffect } from 'react';

/**
 * Mirrors the on-screen keyboard's overlap into a root CSS variable,
 * `--keyboard-inset`, via the visualViewport API. Fixed-position elements
 * (like the coach composer) offset themselves with it so the keyboard never
 * covers them — mobile browsers do NOT move `position: fixed` elements when
 * the keyboard opens. Mount once at the app root.
 */
export function useKeyboardInset() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    const update = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      root.style.setProperty('--keyboard-inset', `${Math.round(inset)}px`);
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      root.style.setProperty('--keyboard-inset', '0px');
    };
  }, []);
}
