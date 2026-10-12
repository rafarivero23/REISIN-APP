// Pure timing helpers + types, safe for client components.
export type Checkpoint = { id: string; race_id: string; num: number; name: string; km: number | null };
export type Checkin = { id: string; team_id: string; checkpoint_id: string; at: string; by_name: string | null };
export const START = 'start'; // checkpoint_id used for the start line

export type BoardTeam = {
  id: string; no: number | null; name: string; logo: string | null; category: string | null; group: string | null; groupColor: string | null;
  start: string | null; times: Record<string, number>; // checkpoint id → elapsed ms since start
  last: number; lastMs: number | null; // furthest checkpoint num reached (0 = started, -1 = not started)
};
export type Board = { checkpoints: Checkpoint[]; teams: BoardTeam[]; updated: string };

// Furthest checkpoint first; same checkpoint → least elapsed time. Teams
// that haven't started go last, by number then name.
export function rankTeams<T extends Pick<BoardTeam, 'last' | 'lastMs' | 'no' | 'name'>>(list: T[]): T[] {
  return [...list].sort((a, b) =>
    b.last - a.last || (a.lastMs ?? Infinity) - (b.lastMs ?? Infinity) || (a.no ?? 1e9) - (b.no ?? 1e9) || a.name.localeCompare(b.name));
}

export function fmtElapsed(ms: number | null | undefined) {
  if (ms == null || !(ms >= 0)) return '—';
  const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}`;
}
