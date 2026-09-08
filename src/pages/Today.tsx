import { DayView } from '../components/DayView';
import { formatLongDate, todayStr } from '../lib/date';
import type { Profile } from '../types';

interface TodayProps {
  profile: Profile;
  /** Increments when the nav + is tapped, to open the add-food sheet. */
  openAddSignal?: number;
}

export function Today({ profile, openAddSignal }: TodayProps) {
  return (
    <div className="page">
      <header className="page-header">
        <div className="micro-label">Today</div>
        <h1 className="page-title">{formatLongDate(new Date())}</h1>
      </header>
      {/* No floating button here — the nav + is the add control for today. */}
      <DayView
        date={todayStr()}
        profile={profile}
        canAdd
        showFab={false}
        openAddSignal={openAddSignal}
      />
    </div>
  );
}
