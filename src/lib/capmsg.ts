// Message that gives a captain their code: shared by the team drawer, the
// "Capitanes" tab and the CSV export so every channel says the same thing.
import { teamSlots } from './stats';
import { money } from './format';

type Tr = (k: string) => string;
type MsgTeam = { captain_name: string; name: string; claim_code: string; amount?: number; payment_status?: string; team_size?: number | null; extra_slots?: number; is_solo?: boolean; settled_at?: string | null };
type MsgRace = { id: string; name: string; slug: string | null; access_code: string | null; team_size?: number; capacity_teams?: number; hold_slots?: number; runner_fee?: number; settle_amounts?: string | null; settle_deadline?: string | null };

const MONTHS: Record<string, string[]> = {
  es: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};
// "2026-12-15" → "15 de diciembre" (no timezone shift: it's a plain date).
export function dayMonth(iso: string | null | undefined, lang: 'es' | 'en' = 'es') {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  if (!m) return '';
  const mo = MONTHS[lang][Number(m[2]) - 1];
  return lang === 'es' ? `${Number(m[3])} de ${mo}` : `${mo} ${Number(m[3])}`;
}

// What the captain still owes as the team "liquidación": fixed amount per team
// size if staff set one, else the unpaid spots. 0 once settled.
export function settleDue(team: MsgTeam, race: MsgRace): number {
  if (team.settled_at || team.is_solo || team.payment_status === undefined || race.team_size === undefined) return 0;
  const size = team.team_size || race.team_size;
  let fixed = 0;
  try { fixed = Number((JSON.parse(race.settle_amounts || '{}') as Record<string, number>)[String(size)]) || 0; } catch { /* ignore */ }
  if (fixed > 0) return fixed;
  return teamSlots({ amount: team.amount || 0, payment_status: team.payment_status, team_size: team.team_size, extra_slots: team.extra_slots, is_solo: team.is_solo, settled_at: team.settled_at },
    { capacity_teams: race.capacity_teams || 0, team_size: race.team_size, hold_slots: race.hold_slots, runner_fee: race.runner_fee }).balance;
}

export function captainMessage(
  tr: Tr,
  team: MsgTeam,
  race: MsgRace,
  origin: string,
  forEmail = false,
  lang: 'es' | 'en' = 'es',
) {
  const url = `${origin}/${race.slug || 'r/' + race.id}`;
  const first = (team.captain_name || '').trim().split(/\s+/)[0] || '';
  let body = tr('capMsg')
    .replace('{name}', first).replace('{race}', race.name).replace('{team}', team.name).replace('{url}', url)
    .replace('{pass}', race.access_code ? `\n${tr('capMsgPass')}: ${race.access_code}` : '').replace('{code}', team.claim_code);
  const due = settleDue(team, race);
  if (due > 0) {
    body += '\n\n' + tr('capMsgSettle')
      // team.amount is the race price, not what the deposit was, so no amount here.
      .replace('{paid}', '')
      .replace('{amount}', money(due, lang))
      .replace('{deadline}', race.settle_deadline ? ' ' + tr('capMsgDeadline').replace('{date}', dayMonth(race.settle_deadline, lang)) : '');
  }
  if (forEmail) body += '\n\n' + tr('capMsgSign');
  return { subject: `${race.name} · ${tr('captainCode')}: ${team.claim_code}`, body, url };
}
export const waLink = (phone: string | null | undefined, text: string) => {
  const d = (phone || '').replace(/\D/g, '');
  return d ? `https://wa.me/${d.length === 10 ? '52' + d : d}?text=${encodeURIComponent(text)}` : null;
};
export const mailLink = (email: string | null | undefined, subject: string, body: string) =>
  email ? `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}` : null;
