'use server';

import { revalidatePath } from 'next/cache';
import { getRace, setRacePage } from '@/lib/repo';
import { getCurrentUser } from '@/lib/auth-guard';
import { setRaceAccess } from '@/lib/team-session';
import { cleanPage, cleanSlug, RESERVED_SLUGS, type PageData } from '@/lib/racepage';

// Portal: unlock a password-protected race page.
export async function unlockRace(raceId: string, code: string): Promise<{ error: string } | { ok: true }> {
  const race = await getRace(raceId);
  if (!race) return { error: 'race_not_found' };
  const given = String(code || '').trim().toLowerCase();
  if (!race.access_code || given !== race.access_code.trim().toLowerCase()) return { error: 'p_badPass' };
  await setRaceAccess(race.id, race.access_code);
  return { ok: true };
}

// Admin: URL, password and content of the race page.
export async function saveRacePage(raceId: string, input: { slug: string; access_code: string; page: PageData }): Promise<{ error?: string; slug?: string }> {
  if (!(await getCurrentUser())) throw new Error('Not signed in');
  const race = await getRace(raceId);
  if (!race) return { error: 'not_found' };
  const slug = cleanSlug(input.slug) || null;
  if (slug && (slug.length < 3 || RESERVED_SLUGS.includes(slug))) return { error: 'pg_slugBad' };
  const access_code = String(input.access_code || '').trim().slice(0, 40) || null;
  if (access_code && access_code.length < 4) return { error: 'p_passMin' };
  try {
    await setRacePage(race.id, { slug, access_code, page: JSON.stringify(cleanPage(input.page)) });
  } catch (e: any) {
    if (e?.code === '23505') return { error: 'pg_slugTaken' };
    throw e;
  }
  revalidatePath('/admin', 'layout');
  revalidatePath(`/r/${race.id}`);
  return { slug: slug || undefined };
}
