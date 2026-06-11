import { useState } from 'react';
import { Plus } from 'lucide-react';
import { CalorieRing } from './CalorieRing';
import { MacroBars } from './MacroBars';
import { MealSection, MEALS } from './MealSection';
import { AddFoodSheet } from './AddFoodSheet';
import { FoodModal } from './FoodModal';
import { useFoodLog } from '../hooks/useFoodLog';
import { dayProgress, todayStr } from '../lib/date';
import type { FoodDraft, FoodEntry, Profile } from '../types';

interface DayViewProps {
  date: string;
  profile: Profile;
  canAdd: boolean;
  onChanged?: () => void;
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
  };
}

export function DayView({ date, profile, canAdd, onChanged }: DayViewProps) {
  const { byMeal, entries, totals, loading, addEntry, updateEntry, deleteEntry } = useFoodLog(
    date,
    onChanged
  );
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState<FoodDraft | null>(null);
  const [editing, setEditing] = useState<FoodEntry | null>(null);

  const isToday = date === todayStr();
  const target = profile.calorie_override ?? profile.calorie_target;

  const impactTargets = {
    calories: target,
    protein: profile.protein_target_g,
    carbs: profile.carbs_target_g,
    fat: profile.fat_target_g,
  };
  const addImpact = {
    baseline: {
      calories: totals.calories,
      protein: totals.protein,
      carbs: totals.carbs,
      fat: totals.fat,
    },
    targets: impactTargets,
  };
  // For edits, the baseline excludes the entry itself so the rings show the
  // day as it would be with the edited values instead of double-counting.
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

  return (
    <>
      <section className="card stats-card">
        <CalorieRing
          consumed={totals.calories}
          target={target}
          dayProgress={isToday ? dayProgress(profile.wake_time, profile.sleep_time) : null}
        />
        <MacroBars
          protein={{ consumed: totals.protein, target: profile.protein_target_g }}
          carbs={{ consumed: totals.carbs, target: profile.carbs_target_g }}
          fat={{ consumed: totals.fat, target: profile.fat_target_g }}
        />
      </section>

      {!loading && entries.length === 0 ? (
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
        <button className="fab" onClick={() => setSheetOpen(true)} aria-label="Add food" type="button">
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
          onSave={async (fields) => {
            const ok = await addEntry(fields);
            if (ok) setDraft(null);
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
    </>
  );
}
