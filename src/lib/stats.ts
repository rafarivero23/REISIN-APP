// Shared by server pages and client components (must not live in a 'use client' file).
type R = { capacity_teams: number; team_size: number; hold_slots?: number; runner_fee?: number };
type T = { id?: string; amount: number; payment_status: string; team_size?: number | null; extra_slots?: number };
type Run = { team_id?: string; fee: number; payment_status: string };
type P = { amount: number };

export const isHold = (r: Pick<R, 'hold_slots'>) => (r.hold_slots || 0) > 0;

// Team-level slot accounting. Classic races: size only, no balance.
export function teamSlots(t: T, r: R) {
  const size = t.team_size || r.team_size;
  if (!isHold(r)) return { size, paid: t.payment_status === 'paid' ? size : 0, balance: t.payment_status === 'paid' ? 0 : t.amount };
  // The deposit is worth hold_slots runners, so what's owed is simply the
  // unpaid spots × runner fee (a team that paid every spot owes nothing,
  // even if its deposit came in as runner payments).
  const paid = (t.payment_status === 'paid' ? r.hold_slots || 0 : 0) + (t.extra_slots || 0);
  const balance = Math.max(0, size - paid) * (r.runner_fee || 0);
  return { size, paid, balance };
}

export function raceStats(r: R, teams: T[], runners: Run[], payments?: P[]) {
  const revenue = payments
    ? payments.reduce((a, p) => a + p.amount, 0)
    : teams.filter((x) => x.payment_status === 'paid').reduce((a, x) => a + x.amount, 0) + runners.filter((x) => x.payment_status === 'paid').reduce((a, x) => a + x.fee, 0);
  const pending = teams.reduce((a, t) => a + teamSlots(t, r).balance, 0) +
    (isHold(r) ? 0 : runners.filter((x) => x.payment_status !== 'paid').reduce((a, x) => a + x.fee, 0));
  const cap = teams.length ? teams.reduce((a, t) => a + teamSlots(t, r).size, 0) + Math.max(0, r.capacity_teams - teams.length) * r.team_size : r.capacity_teams * r.team_size;
  return { teams: teams.length, runners: runners.length, revenue, pending, capRunners: cap, fill: cap ? runners.length / cap : 0, teamsLeft: Math.max(0, r.capacity_teams - teams.length) };
}
