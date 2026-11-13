import { one } from './db';

// Server-only read of a race's staff guide (password + JSON content).
export async function guideOf(raceId: string): Promise<{ password: string; data: string; updated_at: string } | null> {
  return one('SELECT password, data, updated_at FROM staff_guides WHERE race_id = ?', [raceId]);
}
