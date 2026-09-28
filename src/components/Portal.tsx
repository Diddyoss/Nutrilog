import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';

/**
 * Render children directly under <body>.
 *
 * Anything `position: fixed` (sheets, modals, floating buttons) must live here:
 * a transformed ancestor — like `.page` during its entrance animation — becomes
 * the containing block for fixed descendants, pinning them to the bottom of the
 * page instead of the screen.
 */
export function Portal({ children }: { children: ReactNode }) {
  return createPortal(children, document.body);
}
