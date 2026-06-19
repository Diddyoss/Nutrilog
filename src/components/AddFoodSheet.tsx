import { useEffect, useState } from 'react';
import { ScanTab } from './ScanTab';
import { PhotoTab } from './PhotoTab';
import { SearchTab } from './SearchTab';
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

  useEffect(() => {
    if (open) setTab('scan');
  }, [open]);

  if (!open) return null;

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Add food">
        <div className="sheet-handle" />
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
