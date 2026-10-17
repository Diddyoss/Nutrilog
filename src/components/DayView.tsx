import { useEffect, useMemo, useRef, useState } from 'react';
import { CalorieRing } from './CalorieRing';
import { MacroBars } from './MacroBars';
import { MealSection } from './MealSection';
import { MEALS, MEAL_LABELS } from '../lib/meals';
import { AddFoodSheet } from './AddFoodSheet';
import { FoodModal } from './FoodModal';
import { NutrientPieChart } from './NutrientPieChart';
import { NutrientBreakdownTable } from './NutrientBreakdownTable';
import { SupplementModal } from './SupplementModal';
import { ActivitySection } from './ActivitySection';
import { ActivityModal } from './ActivityModal';
import { useFoodLog } from '../hooks/useFoodLog';
import { useSupplementLog } from '../hooks/useSupplementLog';
import { useActivityLog } from '../hooks/useActivityLog';
import { useCustomFoods } from '../hooks/useCustomFoods';
import { customFoodFromSaveFields, saveToLibraryByDefault, shouldSaveAsCustomFood } from '../lib/customFoods';
import { useToast } from './Toast';
import { microsFromRow, sumNutrients } from '../lib/nutrientReference';
import { dayProgress, todayStr } from '../lib/date';
import type { FoodDraft, FoodEntry, NutrientKey, Profile } from '../types';

interface DayViewProps {
  date: string;
  profile: Profile;
  canAdd: boolean;
  onChanged?: () => void;
  /** The nav + asked for the add-food sheet; opened (if allowed) then acknowledged. */
  addRequested?: boolean;
  onAddHandled?: () => void;
}

function entryToDraft(entry: FoodEntry): FoodDraft {
  return {
    food_name: entry.food_name,
    serving_size: entry.serving_size ?? '',
    calories: entry.calories,
    protein_g: entry.protein_g,
    carbs_g: entry.carbs_g,
    fat_g: entry.fat_g,
    source: entry.source,
    perGram: null,
    micros: microsFromRow(entry),
  };
}

export function DayView({
  date,
  profile,
  canAdd,
  onChanged,
  addRequested = false,
  onAddHandled,
}: DayViewProps) {
  const { byMeal, entries, totals, loading, addEntry, updateEntry, deleteEntry } = useFoodLog(
    date,
    onChanged
  );
  const { entries: supplements, addEntry: addSupplement } = useSupplementLog(date, onChanged);
  const {
    entries: activities,
    totalBurned,
    addEntry: addActivity,
    deleteEntry: deleteActivity,
  } = useActivityLog(date, onChanged);
  const {
    foods: customFoods,
    loading: customFoodsLoading,
    available: customFoodsAvailable,
    save: saveCustomFood,
    touch: touchCustomFood,
    remove: removeCustomFood,
  } = useCustomFoods();

  const [sheetOpen, setSheetOpen] = useState(false);
  // Drafts waiting to be confirmed: one normally, several after a multi-photo pick.
  const [queue, setQueue] = useState<{
    drafts: FoodDraft[];
    index: number;
    batch: number;
    notice?: string;
  } | null>(null);
  const draft = queue ? queue.drafts[queue.index] : null;
  const { toast } = useToast();
  const startQueue = (drafts: FoodDraft[], notice?: string) =>
    setQueue((q) => ({ drafts, index: 0, batch: (q?.batch ?? 0) + 1, notice }));
  const nextDraft = () =>
    setQueue((q) => (q && q.index + 1 < q.drafts.length ? { ...q, index: q.index + 1 } : null));
  const [editing, setEditing] = useState<FoodEntry | null>(null);
  const [suppOpen, setSuppOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [panel, setPanel] = useState(0);
  const [highlight, setHighlight] = useState<{ key: NutrientKey; nonce: number } | null>(null);

  const swipeRef = useRef<HTMLDivElement>(null);
  const nonce = useRef(0);
  // The nav + lives outside this component. A pending request is consumed on
  // mount too, so + from another tab opens the sheet once this view appears.
  useEffect(() => {
    if (!addRequested) return;
    if (canAdd) setSheetOpen(true);
    onAddHandled?.();
  }, [addRequested, canAdd, onAddHandled]);

  const isToday = date === todayStr();
  const target = profile.calorie_override ?? profile.calorie_target;
  const netCalories = totals.calories - totalBurned;

  const nutrientTotals = useMemo(() => sumNutrients(entries, supplements), [entries, supplements]);
  const hasNutrientData = entries.length > 0 || supplements.length > 0;

  const impactTargets = {
    calories: target,
    protein: profile.protein_target_g,
    carbs: profile.carbs_target_g,
    fat: profile.fat_target_g,
  };
  const addImpact = {
    baseline: { calories: totals.calories, protein: totals.protein, carbs: totals.carbs, fat: totals.fat },
    targets: impactTargets,
  };
  const editImpact = editing
    ? {
        baseline: {
          calories: totals.calories - (editing.calories ?? 0),
          protein: totals.protein - (editing.protein_g ?? 0),
          carbs: totals.carbs - (editing.carbs_g ?? 0),
          fat: totals.fat - (editing.fat_g ?? 0),
        },
        targets: impactTargets,
      }
    : undefined;

  const onSwipeScroll = () => {
    const el = swipeRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    if (idx !== panel) setPanel(idx);
  };

  const goToPanel = (i: number) => {
    const el = swipeRef.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  };

  const handleSegmentTap = (key: NutrientKey) => setHighlight({ key, nonce: ++nonce.current });

  return (
    <>
      <div className="swipe-card">
        <div className="swipe-container" ref={swipeRef} onScroll={onSwipeScroll}>
          <div className="swipe-panel">
            <section className="card stats-card">
              <CalorieRing
                consumed={netCalories}
                target={target}
                burned={totalBurned}
                dayProgress={isToday ? dayProgress(profile.wake_time, profile.sleep_time) : null}
              />
              <MacroBars
                protein={{ consumed: totals.protein, target: profile.protein_target_g }}
                carbs={{ consumed: totals.carbs, target: profile.carbs_target_g }}
                fat={{ consumed: totals.fat, target: profile.fat_target_g }}
              />
            </section>
          </div>
          <div className="swipe-panel">
            <section className="card pie-card">
              <NutrientPieChart
                totals={nutrientTotals}
                hasData={hasNutrientData}
                onSegmentTap={handleSegmentTap}
              />
            </section>
          </div>
        </div>
        <div className="swipe-dots">
          {[0, 1].map((i) => (
            <button
              key={i}
              className={`swipe-dot${panel === i ? ' active' : ''}`}
              onClick={() => goToPanel(i)}
              aria-label={`Panel ${i + 1}`}
              type="button"
            />
          ))}
        </div>
      </div>

      <ActivitySection
        entries={activities}
        totalBurned={totalBurned}
        canAdd={canAdd}
        onAdd={() => setActivityOpen(true)}
        onDelete={deleteActivity}
      />

      <NutrientBreakdownTable
        totals={nutrientTotals}
        foods={entries}
        supplements={supplements}
        mealLabel={(e) => MEAL_LABELS[e.meal]}
        highlight={highlight}
        onAddSupplement={canAdd ? () => setSuppOpen(true) : undefined}
      />

      {!loading && entries.length === 0 ? (
        <div className="empty-state">
          <p>Nothing logged {isToday ? 'yet today' : 'on this day'}.</p>
          {canAdd && <p className="muted">Tap + to log your first meal.</p>}
        </div>
      ) : (
        <section className="card meals-card" aria-label="Meals">
          {MEALS.map((meal) => (
            <MealSection
              key={meal}
              meal={meal}
              entries={byMeal[meal]}
              onEdit={setEditing}
              onDelete={deleteEntry}
            />
          ))}
        </section>
      )}

      <AddFoodSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onResults={(drafts, notice) => {
          setSheetOpen(false);
          startQueue(drafts, notice);
        }}
        customFoods={customFoods}
        customFoodsLoading={customFoodsLoading}
        customFoodsAvailable={customFoodsAvailable}
        onRemoveCustomFood={removeCustomFood}
      />

      {queue && draft && (
        <FoodModal
          key={`${queue.batch}-${queue.index}`}
          title="Confirm food"
          saveLabel="Add to Log"
          draft={draft}
          impact={addImpact}
          progress={queue.drafts.length > 1 ? `Photo ${queue.index + 1} of ${queue.drafts.length}` : undefined}
          notice={queue.notice}
          cancelLabel={queue.index + 1 < queue.drafts.length ? 'Skip' : 'Cancel'}
          // Re-logging a saved food needs no checkbox: it's already in My Foods.
          saveToLibraryDefault={draft.custom_food_id ? undefined : saveToLibraryByDefault(draft.source)}
          onClose={nextDraft}
          onSave={async (fields, { saveToLibrary }) => {
            const ok = await addEntry(fields);
            if (!ok) return;
            nextDraft();
            // Re-logging a saved food only bumps its usage; otherwise save (or
            // refresh by name) if the box was ticked.
            if (draft.custom_food_id) {
              void touchCustomFood(draft.custom_food_id);
            } else if (shouldSaveAsCustomFood(fields, saveToLibrary)) {
              const saved = await saveCustomFood(customFoodFromSaveFields(fields));
              if (saved && fields.source !== 'manual') toast('Saved to My Foods');
            }
          }}
        />
      )}

      {editing && (
        <FoodModal
          title="Edit food"
          saveLabel="Save Changes"
          draft={entryToDraft(editing)}
          initialMeal={editing.meal}
          impact={editImpact}
          onClose={() => setEditing(null)}
          onSave={async (fields) => {
            const ok = await updateEntry(editing.id, fields);
            if (ok) setEditing(null);
          }}
        />
      )}

      {suppOpen && (
        <SupplementModal
          onClose={() => setSuppOpen(false)}
          onSave={async (fields) => {
            const ok = await addSupplement(fields);
            if (ok) setSuppOpen(false);
          }}
        />
      )}

      {activityOpen && (
        <ActivityModal
          onClose={() => setActivityOpen(false)}
          onSave={async (fields) => {
            const ok = await addActivity(fields);
            if (ok) setActivityOpen(false);
          }}
        />
      )}
    </>
  );
}
