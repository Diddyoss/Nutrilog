import { useCallback, useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { useCoach } from '../hooks/useCoach';
import type { CoachRecent } from '../hooks/useCoach';
import { useFoodLog } from '../hooks/useFoodLog';
import { MEAL_LABELS } from '../components/MealSection';
import { supabase } from '../lib/supabase';
import { addDays, toDateStr, todayStr } from '../lib/date';
import { round1 } from '../lib/units';
import type { Profile } from '../types';

const QUICK_PROMPTS = [
  'How am I doing today?',
  'What should I eat next?',
  'How has my week been?',
  'Tips for hitting my protein?',
];

const EMPTY_RECENT: CoachRecent = { days: [], weights: [] };

export function CoachPage({ profile }: { profile: Profile }) {
  const { entries, totals } = useFoodLog(todayStr());
  const [recent, setRecent] = useState<CoachRecent>(EMPTY_RECENT);

  const todayLog = {
    calories: Math.round(totals.calories),
    protein_g: Math.round(totals.protein),
    carbs_g: Math.round(totals.carbs),
    fat_g: Math.round(totals.fat),
    meals: entries.map((e) => ({
      meal: MEAL_LABELS[e.meal],
      food_name: e.food_name,
      calories: e.calories,
    })),
  };

  // Load the prior 7 days of daily totals + recent weights so the coach can spot trends.
  const loadRecent = useCallback(async () => {
    const today = todayStr();
    const foodFrom = toDateStr(addDays(new Date(), -7));
    const { data: food } = await supabase
      .from('food_log')
      .select('log_date, calories, protein_g, carbs_g, fat_g')
      .gte('log_date', foodFrom);

    const byDay = new Map<string, { calories: number; protein_g: number; carbs_g: number; fat_g: number }>();
    for (const row of (food ?? []) as {
      log_date: string;
      calories: number;
      protein_g: number | null;
      carbs_g: number | null;
      fat_g: number | null;
    }[]) {
      if (row.log_date === today) continue; // today is already sent in detail
      const d = byDay.get(row.log_date) ?? { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
      d.calories += row.calories ?? 0;
      d.protein_g += row.protein_g ?? 0;
      d.carbs_g += row.carbs_g ?? 0;
      d.fat_g += row.fat_g ?? 0;
      byDay.set(row.log_date, d);
    }
    const days = [...byDay.entries()]
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => (a.date < b.date ? 1 : -1));

    const wFrom = toDateStr(addDays(new Date(), -14));
    const { data: w } = await supabase
      .from('weight_log')
      .select('log_date, weight_kg')
      .gte('log_date', wFrom)
      .order('log_date', { ascending: false })
      .order('logged_at', { ascending: false });
    const seen = new Set<string>();
    const weights: { date: string; weight_kg: number }[] = [];
    for (const row of (w ?? []) as { log_date: string; weight_kg: number }[]) {
      if (seen.has(row.log_date)) continue;
      seen.add(row.log_date);
      weights.push({ date: row.log_date, weight_kg: round1(row.weight_kg) });
      if (weights.length >= 5) break;
    }

    setRecent({ days, weights });
  }, []);

  useEffect(() => {
    loadRecent();
  }, [loadRecent]);

  const { messages, isLoading, sendMessage, clearConversation } = useCoach(profile, todayLog, recent);
  const [input, setInput] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!confirmClear) return;
    const t = setTimeout(() => setConfirmClear(false), 3000);
    return () => clearTimeout(t);
  }, [confirmClear]);

  const submit = () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput('');
    sendMessage(text);
    inputRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const handleClear = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    setConfirmClear(false);
    clearConversation();
  };

  const showChips = messages.length < 3;

  return (
    <div className="page coach-page">
      <header className="page-header coach-header">
        <div className="coach-title-group">
          <h1 className="page-title">Coach</h1>
          <p className="caption muted">Powered by DeepSeek V4 · Gemini 3 Flash</p>
        </div>
        <button className="btn-text" onClick={handleClear} type="button">
          {confirmClear ? 'Tap to confirm' : 'Clear'}
        </button>
      </header>

      <div className="coach-messages">
        {messages.map((m) => (
          <div key={m.id} className={`bubble-row ${m.role}`}>
            <div className={`bubble ${m.role}`}>
              {m.isLoading ? (
                <div className="loading-dots">
                  <span />
                  <span />
                  <span />
                </div>
              ) : (
                m.content
              )}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="coach-input-area">
        {showChips && (
          <div className="coach-chips">
            {QUICK_PROMPTS.map((q) => (
              <button
                key={q}
                className="chip"
                type="button"
                disabled={isLoading}
                onClick={() => sendMessage(q)}
              >
                {q}
              </button>
            ))}
          </div>
        )}
        <div className="coach-input-bar">
          <input
            ref={inputRef}
            className="input"
            placeholder="Ask your coach..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <button
            className="coach-send"
            type="button"
            onClick={submit}
            disabled={!input.trim() || isLoading}
            aria-label="Send message"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
