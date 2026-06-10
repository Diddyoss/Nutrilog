import { ProfileWizard } from '../components/ProfileWizard';
import type { ProfileInput } from '../types';

export function Onboarding({ onComplete }: { onComplete: (input: ProfileInput) => Promise<boolean> }) {
  return (
    <div className="onboarding">
      <div className="onboarding-head">
        <div className="logo">NUTRILOG</div>
        <p className="caption">Let's calculate your daily calorie and macro targets.</p>
      </div>
      <ProfileWizard
        submitLabel="Calculate targets"
        onComplete={async (input) => {
          await onComplete(input);
        }}
      />
    </div>
  );
}
