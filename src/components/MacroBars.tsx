interface MacroBarsProps {
  protein: { consumed: number; target: number };
  carbs: { consumed: number; target: number };
  fat: { consumed: number; target: number };
}

function MacroBar({
  label,
  consumed,
  target,
  colorClass,
}: {
  label: string;
  consumed: number;
  target: number;
  colorClass: 'protein' | 'carbs' | 'fat';
}) {
  const safeTarget = target > 0 ? target : 1;
  const pct = Math.min(100, (consumed / safeTarget) * 100);
  const remaining = Math.round(target - consumed);
  const over = remaining < 0;

  return (
    <div className="macro-row">
      <span className="macro-label">
        <span className={`macro-dot ${colorClass}`} />
        {label}
      </span>
      <span className="macro-value">
        {Math.round(consumed)}
        <span className="macro-of">/{Math.round(target)}g</span>
      </span>
      <div className="macro-track">
        <div className={`macro-fill ${colorClass}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`macro-sub${over ? ' over' : ''}`}>
        {over ? `${Math.abs(remaining)}g over` : `${remaining}g left`}
      </span>
    </div>
  );
}

/** Protein / carbs / fat side by side under the calorie ring. */
export function MacroBars({ protein, carbs, fat }: MacroBarsProps) {
  return (
    <div className="macro-bars">
      <MacroBar label="Protein" colorClass="protein" consumed={protein.consumed} target={protein.target} />
      <MacroBar label="Carbs" colorClass="carbs" consumed={carbs.consumed} target={carbs.target} />
      <MacroBar label="Fat" colorClass="fat" consumed={fat.consumed} target={fat.target} />
    </div>
  );
}
