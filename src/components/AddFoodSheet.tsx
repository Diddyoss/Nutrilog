import { useEffect, useState } from 'react';
import { ScanTab } from './ScanTab';
import { PhotoTab } from './PhotoTab';
import { SearchTab } from './SearchTab';
import { MyFoodsTab } from './MyFoodsTab';
import { blankManualDraft } from '../lib/api';
import type { CustomFood, FoodDraft } from '../types';

type SheetTab = 'scan' | 'photo' | 'search' | 'mine';

const TAB_LABELS: Record<SheetTab, string> = {
  scan: 'Scan',
  photo: 'Photo',
  search: 'Search',
  mine: 'My Foods',
};

interface AddFoodSheetProps {
  open: boolean;
  onClose: () => void;
  onResult: (draft: FoodDraft) => void;
  customFoods: CustomFood[];
  customFoodsLoading: boolean;
  customFoodsAvailable: boolean;
  onRemoveCustomFood: (id: string) => void;
}

export function AddFoodSheet({
  open,
  onClose,
  onResult,
  customFoods,
  customFoodsLoading,
  customFoodsAvailable,
  onRemoveCustomFood,
}: AddFoodSheetProps) {
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
          {tab === 'mine' && (
            <MyFoodsTab
              foods={customFoods}
              loading={customFoodsLoading}
              available={customFoodsAvailable}
              onResult={onResult}
              onRemove={onRemoveCustomFood}
            />
          )}
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
