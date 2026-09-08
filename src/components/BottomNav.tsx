import { CalendarDays, Home, Plus, Settings, User } from 'lucide-react';

export type Tab = 'today' | 'history' | 'profile' | 'settings';

interface TabDef {
  id: Tab;
  label: string;
  icon: typeof Home;
}

const LEFT_TABS: TabDef[] = [
  { id: 'today', label: 'Today', icon: Home },
  { id: 'history', label: 'History', icon: CalendarDays },
];

const RIGHT_TABS: TabDef[] = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'settings', label: 'Settings', icon: Settings },
];

interface BottomNavProps {
  tab: Tab;
  onChange: (tab: Tab) => void;
  /** Centre + — jumps to Today and opens the add-food sheet. */
  onAddFood: () => void;
}

export function BottomNav({ tab, onChange, onAddFood }: BottomNavProps) {
  const renderTab = ({ id, label, icon: Icon }: TabDef) => (
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
  );

  return (
    <nav className="bottom-nav">
      {LEFT_TABS.map(renderTab)}
      <button className="nav-add" onClick={onAddFood} aria-label="Add food" type="button">
        <span className="nav-add-circle">
          <Plus size={22} />
        </span>
      </button>
      {RIGHT_TABS.map(renderTab)}
    </nav>
  );
}
