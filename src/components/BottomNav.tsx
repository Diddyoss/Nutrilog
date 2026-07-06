import { Brain, CalendarDays, Home, Settings, User } from 'lucide-react';

export type Tab = 'today' | 'history' | 'coach' | 'profile' | 'settings';

const TABS: { id: Tab; label: string; icon: typeof Home }[] = [
  { id: 'today', label: 'Today', icon: Home },
  { id: 'history', label: 'History', icon: CalendarDays },
  { id: 'coach', label: 'Coach', icon: Brain },
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function BottomNav({ tab, onChange }: { tab: Tab; onChange: (tab: Tab) => void }) {
  const activeIndex = TABS.findIndex((t) => t.id === tab);
  return (
    <nav className="bottom-nav">
      <span
        className="nav-indicator"
        style={{ transform: `translateX(${activeIndex * 100}%)` }}
        aria-hidden="true"
      />
      {TABS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          className={`nav-item${tab === id ? ' active' : ''}`}
          onClick={() => onChange(id)}
          aria-current={tab === id ? 'page' : undefined}
          type="button"
        >
          <Icon size={20} strokeWidth={tab === id ? 2 : 1.5} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
