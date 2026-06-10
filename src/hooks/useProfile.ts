import { useCallback, useEffect, useState } from 'react';
import { ensureSession, supabase } from '../lib/supabase';
import { calculateTargets } from '../lib/calculations';
import { useToast } from '../components/Toast';
import type { Profile, ProfileInput } from '../types';

export type ProfileStatus = 'loading' | 'ready' | 'error';

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [status, setStatus] = useState<ProfileStatus>('loading');
  const { toast } = useToast();

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      await ensureSession();
      const { data, error } = await supabase.from('user_profile').select('*').maybeSingle();
      if (error) throw error;
      setProfile((data as Profile) ?? null);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** Save core stats (insert or update) and recalculate all targets. */
  const saveProfile = useCallback(
    async (input: ProfileInput): Promise<boolean> => {
      const targets = calculateTargets(input);
      const row = { ...input, ...targets };
      try {
        if (profile) {
          const { data, error } = await supabase
            .from('user_profile')
            .update(row)
            .eq('id', profile.id)
            .select()
            .single();
          if (error) throw error;
          setProfile(data as Profile);
        } else {
          const { data, error } = await supabase.from('user_profile').insert(row).select().single();
          if (error) throw error;
          setProfile(data as Profile);
        }
        return true;
      } catch {
        toast('Could not save profile — check your connection');
        return false;
      }
    },
    [profile, toast]
  );

  /** Patch individual fields (name, units, override, wake/sleep) without recalculating. */
  const updateProfile = useCallback(
    async (patch: Partial<Profile>): Promise<boolean> => {
      if (!profile) return false;
      try {
        const { data, error } = await supabase
          .from('user_profile')
          .update(patch)
          .eq('id', profile.id)
          .select()
          .single();
        if (error) throw error;
        setProfile(data as Profile);
        return true;
      } catch {
        toast('Could not save — check your connection');
        return false;
      }
    },
    [profile, toast]
  );

  return { profile, status, reload: load, saveProfile, updateProfile };
}
