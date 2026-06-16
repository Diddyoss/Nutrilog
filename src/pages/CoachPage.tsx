import { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { useCoach } from '../hooks/useCoach';
import { useFoodLog } from '../hooks/useFoodLog';
import { MEAL_LABELS } from '../components/MealSection';
import { todayStr } from '../lib/date';
import type { Profile } from '../types';

const QUICK_PROMPTS = [
  'How am I doing today?',
  'What should I eat next?',
  'Tips for hitting my protein?',
  'Rate my meals today',
];

export function CoachPage({ profile }: { profile: Profile }) {
  const { entries, totals } = useFoodLog(todayStr());

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

  const { messages, isLoading, sendMessage, clearConversation } = useCoach(profile, todayLog);
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
          <p className="caption muted">Powered by Fusion · Budget</p>
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
