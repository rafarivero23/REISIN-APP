'use server';

import { revalidatePath } from 'next/cache';
import { getRace } from '@/lib/repo';
import { run } from '@/lib/db';
import { guideOf } from '@/lib/guideDb';
import { getCurrentUser } from '@/lib/auth-guard';
import { setRaceAccess } from '@/lib/team-session';
import { cleanGuide, type GuideData } from '@/lib/staffGuide';

const now = () => new Date().toISOString();

// Public: unlock the staff guide with its password (signed cookie per race).
export async function unlockGuide(raceId: string, code: string): Promise<{ error: string } | { ok: true }> {
  const race = await getRace(raceId);
  if (!race) return { error: 'race_not_found' };
  const g = await guideOf(race.id);
  const given = String(code || '').trim().toLowerCase();
  if (!g?.password || given !== g.password.trim().toLowerCase()) return { error: 'p_badPass' };
  await setRaceAccess('guide:' + race.id, g.password);
  return { ok: true };
}

// Admin: password + content of the staff guide.
export async function saveGuide(raceId: string, input: { password: string; data: GuideData }): Promise<{ error?: string }> {
  if (!(await getCurrentUser())) throw new Error('Not signed in');
  const race = await getRace(raceId);
  if (!race) return { error: 'not_found' };
  const password = String(input.password || '').trim().slice(0, 40);
  if (password.length < 4) return { error: 'p_passMin' };
  const data = JSON.stringify(cleanGuide(input.data));
  await run(
    'INSERT INTO staff_guides (race_id, password, data, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT (race_id) DO UPDATE SET password = EXCLUDED.password, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at',
    [race.id, password, data, now()]
  );
  revalidatePath('/admin', 'layout');
  revalidatePath(`/guia/${race.id}`);
  if (race.slug) revalidatePath(`/guia/${race.slug}`);
  return {};
}
