// Shared by server pages and client components (must not live in a 'use client' file).
type T = { amount: number; payment_status: string };
type R = { fee: number; payment_status: string };
export function raceStats(r: { capacity_teams: number; team_size: number }, teams: T[], runners: R[]) {
  const revenue = teams.filter((x) => x.payment_status === 'paid').reduce((a, x) => a + x.amount, 0) + runners.filter((x) => x.payment_status === 'paid').reduce((a, x) => a + x.fee, 0);
  const pending = teams.filter((x) => x.payment_status !== 'paid').reduce((a, x) => a + x.amount, 0) + runners.filter((x) => x.payment_status !== 'paid').reduce((a, x) => a + x.fee, 0);
  const cap = r.capacity_teams * r.team_size;
  return { teams: teams.length, runners: runners.length, revenue, pending, capRunners: cap, fill: cap ? runners.length / cap : 0, teamsLeft: Math.max(0, r.capacity_teams - teams.length) };
}
