import { Check, Trash2 } from 'lucide-react';
import { useConfirmTap } from '../hooks/useConfirmTap';

interface ConfirmDeleteButtonProps {
  onConfirm: () => void;
  /** Accessible label before arming, e.g. "Delete entry". */
  label: string;
  /** Accessible label once armed. */
  confirmLabel?: string;
}

/** Trash icon that turns into a check; the second tap deletes. */
export function ConfirmDeleteButton({ onConfirm, label, confirmLabel = 'Confirm delete' }: ConfirmDeleteButtonProps) {
  const { armed, tap } = useConfirmTap(onConfirm);
  return (
    <button
      className={`icon-btn${armed ? ' armed' : ''}`}
      aria-label={armed ? confirmLabel : label}
      onClick={tap}
      type="button"
    >
      {armed ? <Check size={16} /> : <Trash2 size={16} />}
    </button>
  );
}
