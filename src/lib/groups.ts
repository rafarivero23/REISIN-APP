// Start groups and category, shared by server and client code.
export type StartGroup = { label: string; max: number | null; color: string; start: string };

export function parseGroups(json: string | null | undefined): StartGroup[] {
  try {
    const g = JSON.parse(json || '[]');
    if (Array.isArray(g) && g.length) return g;
  } catch {}
  return [{ label: '1', max: 99, color: '#2f7d4f', start: '' }, { label: '2', max: 115, color: '#c2571b', start: '' }, { label: '3', max: null, color: '#1d4ed8', start: '' }];
}

// Team half-marathon average (minutes) → its group. Groups are checked in
// order of their limit; the one without a limit catches everything slower.
export function groupFor(min: number | null | undefined, groups: StartGroup[]): StartGroup | null {
  if (!min) return null;
  const sorted = [...groups].sort((a, b) => (a.max ?? Infinity) - (b.max ?? Infinity));
  return sorted.find((g) => g.max == null || min <= g.max) || null;
}

// "1:40:00", "1:40", "100" or "1:40:00 AM" → minutes.
export function parseHalf(v: string | null | undefined): number | null {
  const s = String(v || '').replace(/\s*(AM|PM)\s*$/i, '').trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) return Number(s) || null;
  const p = s.split(':').map(Number);
  if (p.some(isNaN)) return null;
  const min = p.length === 3 ? p[0] * 60 + p[1] + p[2] / 60 : p[0] * 60 + p[1];
  return Math.round(min) || null;
}
export const fmtHalf = (min: number | null | undefined) => (min ? `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}` : '—');

// Varonil if everyone is male, Femenil if everyone is female, otherwise Mixto.
export function categoryOf(genders: (string | null)[]): 'varonil' | 'femenil' | 'mixto' | null {
  const g = genders.filter(Boolean);
  if (!g.length) return null;
  if (g.every((x) => x === 'M')) return 'varonil';
  if (g.every((x) => x === 'F')) return 'femenil';
  return 'mixto';
}
