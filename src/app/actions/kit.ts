'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth-guard';
import { getRace, getTeam } from '@/lib/repo';
import { run } from '@/lib/db';
import { timingAccess } from '@/lib/team-session';

// Race-day check-in (kit pickup). Staff with the admin login or the staff passcode.
async function staffName(raceId: string): Promise<string | null> {
  const user = await getCurrentUser();
  if (user) return user.name || user.email;
  const race = await getRace(raceId);
  const a = race ? await timingAccess(race.id, race.timing_code) : null;
  return a ? a.name || 'Staff' : null;
}
const done = (raceId: string) => { revalidatePath(`/r/${raceId}/registro`); revalidatePath('/admin', 'layout'); };

export async function kitCheckIn(raceId: string, teamId: string, input: { count: number; note: string }): Promise<{ error?: string }> {
  const who = await staffName(raceId);
  if (!who) return { error: 'p_badPass' };
  const t = await getTeam(teamId);
  if (!t || t.race_id !== (await getRace(raceId))?.id) return { error: 'not_found' };
  await run('UPDATE teams SET kit_at = ?, kit_by = ?, kit_count = ?, kit_note = ? WHERE id = ?',
    [new Date().toISOString(), who, Math.max(0, Math.round(Number(input.count) || 0)), String(input.note || '').trim().slice(0, 500) || null, teamId]);
  done(raceId);
  return {};
}
export async function kitUndo(raceId: string, teamId: string): Promise<{ error?: string }> {
  if (!(await staffName(raceId))) return { error: 'p_badPass' };
  await run('UPDATE teams SET kit_at = NULL, kit_by = NULL, kit_count = NULL, kit_note = NULL WHERE id = ? AND race_id = (SELECT id FROM races WHERE id = ?)', [teamId, (await getRace(raceId))?.id]);
  done(raceId);
  return {};
}
