import type { Team, Runner, Race, Payment } from '@/lib/repo';
import { isListedTeam } from '@/lib/repo';
import type { ARace, ATeam, ARunner, APayment } from '@/components/admin';

// Strips what the browser shouldn't get (password hashes, Stripe ids).
export const toARace = (r: Race): ARace => ({
  id: r.id, name: r.name, brand: r.brand, status: r.status, race_date: r.race_date, location: r.location, team_price: r.team_price,
  runner_fee: r.runner_fee, team_size: r.team_size, capacity_teams: r.capacity_teams, categories: r.categories, bib_start: r.bib_start, waiver: r.waiver,
  team_sizes: r.team_sizes, hold_slots: r.hold_slots, start_groups: r.start_groups,
  slug: r.slug, access_code: r.access_code, page: r.page,
});
export const toATeams = (teams: Team[]): ATeam[] =>
  teams.filter(isListedTeam).map((x) => ({
    id: x.id, race_id: x.race_id, name: x.name, category: x.category, captain_name: x.captain_name, captain_email: x.captain_email,
    captain_phone: x.captain_phone, amount: x.amount, payment_status: x.payment_status, payment_method: x.payment_method, paid_at: x.paid_at,
    claim_code: x.claim_code, has_password: !!x.password_hash, created_at: x.created_at,
    team_size: x.team_size, extra_slots: x.extra_slots, notes: x.notes, half_avg_min: x.half_avg_min, reg_type: x.reg_type,
    logo_v: x.logo ? String(x.logo.length) : null, code_sent_at: x.code_sent_at,
  }));
export const toARunners = (rs: Runner[]): ARunner[] =>
  rs.map((x) => ({
    id: x.id, race_id: x.race_id, team_id: x.team_id, bib: x.bib, first_name: x.first_name, last_name: x.last_name, email: x.email, phone: x.phone,
    birth_date: x.birth_date, gender: x.gender, shirt_size: x.shirt_size, emergency_name: x.emergency_name, emergency_phone: x.emergency_phone,
    waiver_accepted_at: x.waiver_accepted_at, fee: x.fee, payment_status: x.payment_status, payment_method: x.payment_method, paid_at: x.paid_at, created_at: x.created_at,
    notes: x.notes,
  }));
export const toAPayments = (ps: Payment[]): APayment[] =>
  ps.map((p) => ({
    id: p.id, team_id: p.team_id, runner_id: p.runner_id, kind: p.kind, source: p.source, external_id: p.external_id, quantity: p.quantity,
    amount: p.amount, payer_name: p.payer_name, payer_email: p.payer_email, comment: p.comment, paid_at: p.paid_at, notes: p.notes,
  }));
