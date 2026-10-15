'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth-guard';
import { many, run } from '@/lib/db';
import { newId, now } from '@/lib/ids';

const toBuf = (dataUrl: string) => {
  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || '');
  return m ? Buffer.from(m[1], 'base64') : null;
};

export async function uploadRacePhoto(raceId: string, lg: string, sm: string, w: number, h: number): Promise<{ error?: string; id?: string }> {
  if (!(await getCurrentUser())) throw new Error('Not signed in');
  const a = toBuf(lg), b = toBuf(sm);
  if (!a || !b || a.length > 3_000_000 || b.length > 600_000) return { error: 'ph_bad' };
  const id = newId();
  await run('INSERT INTO race_photos (id, race_id, lg, sm, w, h, created_at) VALUES (?,?,?,?,?,?,?)',
    [id, raceId, a, b, Math.round(w) || 0, Math.round(h) || 0, now()]);
  revalidatePath('/admin', 'layout');
  return { id: 'u:' + id };
}

export async function deleteRacePhoto(raceId: string, photoId: string): Promise<{ error?: string }> {
  if (!(await getCurrentUser())) throw new Error('Not signed in');
  await run('DELETE FROM race_photos WHERE id = ? AND race_id = ?', [photoId.replace(/^u:/, ''), raceId]);
  revalidatePath('/admin', 'layout');
  return {};
}

export async function racePhotoIds(raceId: string) {
  return (await many<{ id: string; w: number; h: number }>('SELECT id, w, h FROM race_photos WHERE race_id = ? ORDER BY created_at DESC', [raceId]))
    .map((p) => ({ id: 'u:' + p.id, w: p.w, h: p.h }));
}
