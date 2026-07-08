import { useEffect, useState } from 'react';
import { ScanTab } from './ScanTab';
import { PhotoTab } from './PhotoTab';
import { SearchTab } from './SearchTab';
import { useDragDismiss } from '../hooks/useDragDismiss';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { usePresence } from '../hooks/usePresence';
import { useScrollLock } from '../hooks/useScrollLock';
import { blankManualDraft } from '../lib/api';
import type { FoodDraft } from '../types';

type SheetTab = 'scan' | 'photo' | 'search';

const TAB_LABELS: Record<SheetTab, string> = { scan: 'Scan', photo: 'Photo', search: 'Search' };

interface AddFoodSheetProps {
  open: boolean;
  onClose: () => void;
  onResult: (draft: FoodDraft) => void;
}

export function AddFoodSheet({ open, onClose, onResult }: AddFoodSheetProps) {
  const [tab, setTab] = useState<SheetTab>('scan');
  // Stays mounted through the exit animation after the parent flips `open`.
  const { mounted, closing } = usePresence(open);
  // Drag the handle to dismiss: past 35% height or a downward flick closes;
  // the exit animation continues from the dragged position.
  const { targetRef, handleProps } = useDragDismiss({ onDismiss: onClose });
  useScrollLock(mounted);
  useEscapeKey(onClose, open);

  useEffect(() => {
    if (open) setTab('scan');
  }, [open]);

  if (!mounted) return null;

  return (
    <div className={`sheet-overlay${closing ? ' closing' : ''}`} onClick={onClose}>
      <div
        className="sheet"
        ref={targetRef}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Add food"
      >
        <div className="sheet-grab" {...handleProps}>
          <div className="sheet-handle" />
        </div>
        <div className="sheet-tabs">
          {(Object.keys(TAB_LABELS) as SheetTab[]).map((t) => (
            <button
              key={t}
              className={`sheet-tab${tab === t ? ' active' : ''}`}
              onClick={() => setTab(t)}
              type="button"
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>
        <div className="sheet-content">
          {tab === 'scan' && <ScanTab onResult={onResult} onSwitchToPhoto={() => setTab('photo')} />}
          {tab === 'photo' && <PhotoTab onResult={onResult} />}
          {tab === 'search' && <SearchTab onResult={onResult} />}
        </div>
        <div className="sheet-footer">
          <button
            className="btn btn-secondary btn-block"
            onClick={() => onResult(blankManualDraft())}
            type="button"
          >
            Enter food manually
          </button>
        </div>
      </div>
    </div>
  );
}
