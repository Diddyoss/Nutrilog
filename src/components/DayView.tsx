import { useMemo, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { CalorieRing } from './CalorieRing';
import { MacroBars } from './MacroBars';
import { MealSection, MEALS, MEAL_LABELS } from './MealSection';
import { MealSectionSkeleton } from './Skeleton';
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
import { ALL_NUTRIENT_KEYS, sumNutrients } from '../lib/nutrientReference';
import { dayProgress, todayStr } from '../lib/date';
import { haptic } from '../lib/haptics';
import type { FoodDraft, FoodEntry, NutrientKey, NutrientValues, Profile } from '../types';

interface DayViewProps {
  date: string;
  profile: Profile;
  canAdd: boolean;
  onChanged?: () => void;
}

function entryToDraft(entry: FoodEntry): FoodDraft {
  const micros: Partial<NutrientValues> = {};
  for (const k of ALL_NUTRIENT_KEYS) {
    const v = entry[k];
    if (v != null) micros[k] = Number(v);
  }
  return {
    food_name: entry.food_name,
    serving_size: entry.serving_size ?? '',
    calories: entry.calories,
    protein_g: entry.protein_g,
    carbs_g: entry.carbs_g,
    fat_g: entry.fat_g,
    source: entry.source,
    perGram: null,
    micros,
  };
}

export function DayView({ date, profile, canAdd, onChanged }: DayViewProps) {
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

  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState<FoodDraft | null>(null);
  const [editing, setEditing] = useState<FoodEntry | null>(null);
  const [suppOpen, setSuppOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [panel, setPanel] = useState(0);
  const [highlight, setHighlight] = useState<{ key: NutrientKey; nonce: number } | null>(null);

  const swipeRef = useRef<HTMLDivElement>(null);
  const nonce = useRef(0);

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

      {loading ? (
        <div className="meals">
          <MealSectionSkeleton />
          <MealSectionSkeleton />
          <MealSectionSkeleton />
        </div>
      ) : entries.length === 0 ? (
        <div className="empty-state">
          <p>Nothing logged {isToday ? 'yet today' : 'on this day'}.</p>
          {canAdd && <p className="muted">Tap + to log your first meal.</p>}
        </div>
      ) : (
        <div className="meals">
          {MEALS.map((meal) => (
            <MealSection
              key={meal}
              meal={meal}
              entries={byMeal[meal]}
              onEdit={setEditing}
              onDelete={deleteEntry}
            />
          ))}
        </div>
      )}

      {canAdd && (
        <button
          className="fab"
          onClick={() => {
            haptic('light');
            setSheetOpen(true);
          }}
          aria-label="Add food"
          type="button"
        >
          <Plus size={26} />
        </button>
      )}

      <AddFoodSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onResult={(d) => {
          setSheetOpen(false);
          setDraft(d);
        }}
      />

      {draft && (
        <FoodModal
          title="Confirm food"
          saveLabel="Add to Log"
          draft={draft}
          impact={addImpact}
          onClose={() => setDraft(null)}
          onSave={(fields) => addEntry(fields)}
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
          onSave={(fields) => updateEntry(editing.id, fields)}
        />
      )}

      {suppOpen && (
        <SupplementModal
          onClose={() => setSuppOpen(false)}
          onSave={(fields) => addSupplement(fields)}
        />
      )}

      {activityOpen && (
        <ActivityModal
          onClose={() => setActivityOpen(false)}
          onSave={(fields) => addActivity(fields)}
        />
      )}
    </>
  );
}
