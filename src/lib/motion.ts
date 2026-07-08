/** True when the user has requested reduced motion — JS-driven animations must respect it. */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Focus handler for scrollable overlays: keeps the focused field visible
 * above the on-screen keyboard. The delay lets the keyboard start opening
 * so scrollIntoView measures the shrunken viewport, not the full one.
 */
export function scrollFocusedFieldIntoView(e: { target: EventTarget | null }): void {
  const t = e.target;
  if (!(t instanceof HTMLElement) || !t.matches('input, textarea, select')) return;
  window.setTimeout(
    () => t.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' }),
    250
  );
}
