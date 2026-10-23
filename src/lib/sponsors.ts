// Sponsor logos per race (admin → Página → Patrocinadores).
import { many, one } from './db';

export type Sponsor = { id: string; name: string; url: string | null; w: number; h: number; v: string };

export const sponsorsOf = async (raceId: string): Promise<Sponsor[]> =>
  (await many<{ id: string; name: string; url: string | null; w: number; h: number; created_at: string }>(
    'SELECT id, name, url, w, h, created_at FROM race_sponsors WHERE race_id = ? ORDER BY sort, created_at', [raceId]))
    .map(({ created_at, ...x }) => ({ ...x, v: created_at.replace(/\D/g, '').slice(-8) }));

export const sponsorMono = async (raceId: string) =>
  !!(await one<{ sponsor_mono: boolean }>('SELECT sponsor_mono FROM races WHERE id = ?', [raceId]))?.sponsor_mono;
