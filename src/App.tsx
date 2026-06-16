import { useState } from 'react';
import { BottomNav } from './components/BottomNav';
import type { Tab } from './components/BottomNav';
import { Today } from './pages/Today';
import { History } from './pages/History';
import { CoachPage } from './pages/CoachPage';
import { ProfilePage } from './pages/Profile';
import { SettingsPage } from './pages/Settings';
import { Onboarding } from './pages/Onboarding';
import { useProfile } from './hooks/useProfile';
import { isSupabaseConfigured } from './lib/supabase';

function Splash() {
  return (
    <div className="fullscreen-center">
      <div className="logo pulse">NUTRILOG</div>
    </div>
  );
}

function SetupNotice() {
  return (
    <div className="fullscreen-center">
      <div className="setup-notice">
        <div className="logo">NUTRILOG</div>
        <p className="body-text">Supabase is not configured.</p>
        <p className="caption muted">
          Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in a{' '}
          <code>.env</code> file (see <code>.env.example</code>), then restart the dev server.
        </p>
      </div>
    </div>
  );
}

function ErrorScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="fullscreen-center">
      <div className="setup-notice">
        <div className="logo">NUTRILOG</div>
        <p className="body-text">Could not connect.</p>
        <p className="caption muted">Check your connection and Supabase settings, then try again.</p>
        <button className="btn btn-primary" onClick={onRetry} type="button">
          Retry
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const { profile, status, reload, saveProfile, updateProfile } = useProfile();
  const [tab, setTab] = useState<Tab>('today');

  if (!isSupabaseConfigured) return <SetupNotice />;
  if (status === 'loading') return <Splash />;
  if (status === 'error') return <ErrorScreen onRetry={reload} />;
  if (!profile) return <Onboarding onComplete={saveProfile} />;

  return (
    <div className="app">
      <main>
        {tab === 'today' && <Today profile={profile} />}
        {tab === 'history' && <History profile={profile} />}
        {tab === 'coach' && <CoachPage profile={profile} />}
        {tab === 'profile' && (
          <ProfilePage profile={profile} onSaveProfile={saveProfile} onUpdateProfile={updateProfile} />
        )}
        {tab === 'settings' && <SettingsPage profile={profile} onUpdateProfile={updateProfile} />}
      </main>
      <BottomNav tab={tab} onChange={setTab} />
    </div>
  );
}
