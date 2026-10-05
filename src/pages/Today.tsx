import { DayView } from '../components/DayView';
import { formatLongDate, todayStr } from '../lib/date';
import type { Profile } from '../types';

interface TodayProps {
  profile: Profile;
  /** The nav + asked to open the add-food sheet. */
  addRequested: boolean;
  onAddHandled: () => void;
}

export function Today({ profile, addRequested, onAddHandled }: TodayProps) {
  return (
    <div className="page">
      <header className="page-header">
        <div className="micro-label">Today</div>
        <h1 className="page-title">{formatLongDate(new Date())}</h1>
      </header>
      <DayView
        date={todayStr()}
        profile={profile}
        canAdd
        addRequested={addRequested}
        onAddHandled={onAddHandled}
      />
    </div>
  );
}
