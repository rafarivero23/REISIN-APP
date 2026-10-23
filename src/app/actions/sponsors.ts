'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth-guard';
import { getRace } from '@/lib/repo';
import { many, one, run } from '@/lib/db';
import { newId, now } from '@/lib/ids';
import { safeUrl } from '@/lib/racepage';

async function guard(raceId: string) {
  if (!(await getCurrentUser())) throw new Error('Not signed in');
  const race = await getRace(raceId);
  if (!race) throw new Error('Race not found');
  return race;
}
function refresh(race: { id: string; slug?: string | null }) {
  revalidatePath('/admin', 'layout');
  revalidatePath(`/r/${race.id}`);
  if (race.slug) revalidatePath(`/r/${race.slug}`);
}

// png = data URL already trimmed and resized in the browser.
export async function addSponsor(raceId: string, name: string, png: string, w: number, h: number): Promise<{ error?: string }> {
  const race = await guard(raceId);
  const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(png || '');
  const buf = m ? Buffer.from(m[1], 'base64') : null;
  if (!buf || buf.length > 2_000_000 || !(w > 0 && h > 0)) return { error: 'sp_bad' };
  const last = await one<{ n: number }>('SELECT COALESCE(MAX(sort), 0) AS n FROM race_sponsors WHERE race_id = ?', [race.id]);
  await run('INSERT INTO race_sponsors (id, race_id, name, url, img, w, h, sort, created_at) VALUES (?,?,?,?,?,?,?,?,?)',
    [newId(), race.id, String(name || '').trim().slice(0, 80), null, buf, Math.round(w), Math.round(h), Number(last?.n || 0) + 1, now()]);
  refresh(race);
  return {};
}

export async function updateSponsor(raceId: string, id: string, input: { name: string; url: string }): Promise<{ error?: string }> {
  const race = await guard(raceId);
  const url = String(input.url || '').trim();
  const clean = url ? safeUrl(url) : '';
  if (url && !clean) return { error: 'sp_badUrl' };
  await run('UPDATE race_sponsors SET name = ?, url = ? WHERE id = ? AND race_id = ?', [String(input.name || '').trim().slice(0, 80), clean || null, id, race.id]);
  refresh(race);
  return {};
}

export async function deleteSponsor(raceId: string, id: string) {
  const race = await guard(raceId);
  await run('DELETE FROM race_sponsors WHERE id = ? AND race_id = ?', [id, race.id]);
  refresh(race);
}

export async function moveSponsor(raceId: string, id: string, dir: -1 | 1) {
  const race = await guard(raceId);
  const list = await many<{ id: string }>('SELECT id FROM race_sponsors WHERE race_id = ? ORDER BY sort, created_at', [race.id]);
  const i = list.findIndex((x) => x.id === id), j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  for (const [k, x] of list.entries()) await run('UPDATE race_sponsors SET sort = ? WHERE id = ?', [k + 1, x.id]);
  refresh(race);
}

export async function setSponsorMono(raceId: string, mono: boolean) {
  const race = await guard(raceId);
  await run('UPDATE races SET sponsor_mono = ? WHERE id = ?', [!!mono, race.id]);
  refresh(race);
}
