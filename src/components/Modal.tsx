import type { ReactNode } from 'react';
import { Portal } from './Portal';

interface ModalProps {
  /** Called when the backdrop is tapped. */
  onClose: () => void;
  children: ReactNode;
}

/** Centred dialog over a dimmed backdrop; tapping the backdrop closes it. */
export function Modal({ onClose, children }: ModalProps) {
  return (
    <Portal>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
          {children}
        </div>
      </div>
    </Portal>
  );
}
