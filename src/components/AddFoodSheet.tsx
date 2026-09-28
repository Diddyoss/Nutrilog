import { useEffect, useState } from 'react';
import { ScanTab } from './ScanTab';
import { PhotoTab } from './PhotoTab';
import { SearchTab } from './SearchTab';
import { ManualTab } from './ManualTab';
import { Portal } from './Portal';
import type { CustomFood, FoodDraft } from '../types';

type SheetTab = 'scan' | 'photo' | 'search' | 'manual';

const TAB_LABELS: Record<SheetTab, string> = {
  scan: 'Scan',
  photo: 'Photo',
  search: 'Search',
  manual: 'Manual',
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
    <Portal>
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
            {tab === 'manual' && (
              <ManualTab
                foods={customFoods}
                loading={customFoodsLoading}
                available={customFoodsAvailable}
                onResult={onResult}
                onRemove={onRemoveCustomFood}
              />
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
}
