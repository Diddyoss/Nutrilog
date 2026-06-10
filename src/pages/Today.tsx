import { DayView } from '../components/DayView';
import { formatLongDate, todayStr } from '../lib/date';
import type { Profile } from '../types';

export function Today({ profile }: { profile: Profile }) {
  return (
    <div className="page">
      <header className="page-header">
        <div className="micro-label">Today</div>
        <h1 className="page-title">{formatLongDate(new Date())}</h1>
      </header>
      <DayView date={todayStr()} profile={profile} canAdd />
    </div>
  );
}
