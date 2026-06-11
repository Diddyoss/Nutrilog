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
  const c = Math.round(consumed);

  return (
    <div className="macro-row">
      <div className="macro-head">
        <span className="micro-label macro-label">
          <span className={`macro-dot ${colorClass}`} />
          {label}
        </span>
        <span className="caption">
          {c}g / {Math.round(target)}g
        </span>
      </div>
      <div className="macro-track">
        <div className={`macro-fill ${colorClass}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="macro-sub">{remaining >= 0 ? `${remaining}g remaining` : `${Math.abs(remaining)}g over`}</div>
    </div>
  );
}

export function MacroBars({ protein, carbs, fat }: MacroBarsProps) {
  return (
    <div className="macro-bars">
      <MacroBar label="Protein" colorClass="protein" consumed={protein.consumed} target={protein.target} />
      <MacroBar label="Carbs" colorClass="carbs" consumed={carbs.consumed} target={carbs.target} />
      <MacroBar label="Fat" colorClass="fat" consumed={fat.consumed} target={fat.target} />
    </div>
  );
}
