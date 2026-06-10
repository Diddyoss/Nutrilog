import { CalendarDays, Home, Settings, User } from 'lucide-react';

export type Tab = 'today' | 'history' | 'profile' | 'settings';

const TABS: { id: Tab; label: string; icon: typeof Home }[] = [
  { id: 'today', label: 'Today', icon: Home },
  { id: 'history', label: 'History', icon: CalendarDays },
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function BottomNav({ tab, onChange }: { tab: Tab; onChange: (tab: Tab) => void }) {
  return (
    <nav className="bottom-nav">
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
