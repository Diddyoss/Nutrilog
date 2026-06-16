import { useCallback, useEffect, useRef, useState } from 'react';
import type { CoachMessage, Profile } from '../types';

const STORAGE_KEY = 'coach-conversation';

const GREETING =
  "Hi! I'm your nutrition coach. I can see your targets and everything you've logged today. " +
  'Ask how you\'re tracking, what to eat next, or how to hit your protein.';

export interface CoachTodayLog {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  meals: { meal: string; food_name: string; calories: number }[];
}

interface UseCoachReturn {
  messages: CoachMessage[];
  isLoading: boolean;
  sendMessage: (text: string) => Promise<void>;
  clearConversation: () => void;
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function greetingMessage(): CoachMessage {
  return { id: makeId(), role: 'assistant', content: GREETING, timestamp: new Date() };
}

/** sessionStorage (not localStorage) so the chat survives tab switches but resets each session. */
function loadStored(): CoachMessage[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [greetingMessage()];
    const parsed = JSON.parse(raw) as CoachMessage[];
    if (!Array.isArray(parsed) || parsed.length === 0) return [greetingMessage()];
    return parsed.map((m) => ({ ...m, timestamp: new Date(m.timestamp), isLoading: false }));
  } catch {
    return [greetingMessage()];
  }
}

export function useCoach(profile: Profile, todayLog: CoachTodayLog): UseCoachReturn {
  const [messages, setMessages] = useState<CoachMessage[]>(loadStored);
  const [isLoading, setIsLoading] = useState(false);

  // Hold the latest context so sendMessage never closes over stale data.
  const contextRef = useRef({ profile, todayLog });
  useEffect(() => {
    contextRef.current = { profile, todayLog };
  }, [profile, todayLog]);

  useEffect(() => {
    try {
      const persistable = messages.filter((m) => !m.isLoading);
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(persistable));
    } catch {
      // sessionStorage unavailable (private mode etc.) — non-fatal.
    }
  }, [messages]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      const userMsg: CoachMessage = {
        id: makeId(),
        role: 'user',
        content: trimmed,
        timestamp: new Date(),
      };
      const placeholder: CoachMessage = {
        id: makeId(),
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isLoading: true,
      };

      const history = messages
        .filter((m) => !m.isLoading)
        .map((m) => ({ role: m.role, content: m.content }));

      setMessages((prev) => [...prev, userMsg, placeholder]);
      setIsLoading(true);

      try {
        const { profile: p, todayLog: t } = contextRef.current;
        const coachProfile = {
          goal: p.goal,
          activity_level: p.activity_level,
          calorie_target: p.calorie_override ?? p.calorie_target,
          protein_target_g: p.protein_target_g,
          carbs_target_g: p.carbs_target_g,
          fat_target_g: p.fat_target_g,
          weight_kg: p.weight_kg,
          age: p.age,
          sex: p.sex,
        };

        const res = await fetch('/api/coach', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profile: coachProfile,
            todayLog: t,
            conversationHistory: history,
            userMessage: trimmed,
          }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.reply) throw new Error(data?.error || 'Coach request failed');

        setMessages((prev) =>
          prev.map((m) => (m.id === placeholder.id ? { ...m, content: data.reply, isLoading: false } : m))
        );
      } catch (err) {
        const reason = err instanceof Error ? err.message : 'Something went wrong';
        setMessages((prev) =>
          prev.map((m) =>
            m.id === placeholder.id
              ? { ...m, content: `Sorry — ${reason}. Please try again.`, isLoading: false }
              : m
          )
        );
      } finally {
        setIsLoading(false);
      }
    },
    [messages, isLoading]
  );

  const clearConversation = useCallback(() => {
    setMessages([greetingMessage()]);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  return { messages, isLoading, sendMessage, clearConversation };
}
