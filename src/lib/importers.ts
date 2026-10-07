// Importers for the 2026 data: RedPodium registrant exports (teams + runners)
// and Ecwid order exports (holds + runner-slot payments). Both are safe to
// re-run: RedPodium rows dedupe on Registrant ID, Ecwid on order number.
import { parseCsv } from './csv';
import { parseHalf } from './groups';
import { many, one, run } from './db';
import { newClaimCode, newId, now } from './ids';
import {
  type Team, getRace, createTeam, recordPayment, assignPayment, sizeOptions,
} from './repo';

const lc = (s: string | null | undefined) => (s || '').trim().toLowerCase();
const words = (s: string | null | undefined) =>
  (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/).filter(Boolean);

// "2026-04-20 9:41 AM" or "Jun 17, 2026 11:49 AM" → ISO (Mexico City time).
function toIso(s: string): string {
  if (!s) return now();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  let d: Date;
  if (m) {
    let h = Number(m[4]) % 12;
    if ((m[6] || '').toUpperCase() === 'PM') h += 12;
    d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], h + 6, +m[5])); // CST = UTC-6
  } else {
    const p = new Date(s + ' GMT-0600');
    d = isNaN(+p) ? new Date() : p;
  }
  return d.toISOString();
}

export type ImportResult = { kind: string; teamsCreated: number; runnersCreated: number; paymentsCreated: number; skipped: number; unmatched: number; warnings: string[] };

/* ---------------- RedPodium ---------------- */
export function looksLikeRedPodium(rows: Record<string, string>[]) {
  return !!rows[0] && 'Team Name' in rows[0] && 'Registrant ID' in rows[0];
}

export async function importRedPodium(raceId: string, rows: Record<string, string>[]): Promise<ImportResult> {
  const race = await getRace(raceId);
  if (!race) throw new Error('race_not_found');
  const res: ImportResult = { kind: 'redpodium', teamsCreated: 0, runnersCreated: 0, paymentsCreated: 0, skipped: 0, unmatched: 0, warnings: [] };
  const sizes = sizeOptions(race);
  const live = rows.filter((r) => lc(r['Registrant Status']) !== 'canceled' && r['Team Name']);
  live.sort((a, b) => toIso(a['Registration Date']).localeCompare(toIso(b['Registration Date'])));

  // Group by team name; size = most common "N runners" category.
  const groups = new Map<string, Record<string, string>[]>();
  for (const r of live) {
    const k = lc(r['Team Name']);
    groups.set(k, [...(groups.get(k) || []), r]);
  }
  const existing = await many<Team>('SELECT * FROM teams WHERE race_id = ?', [race.id]);
  for (const [key, members] of groups) {
    const counts = new Map<number, number>();
    for (const m of members) {
      const n = parseInt(m['Categoría'] || m['Categoria'] || '', 10);
      if (n) counts.set(n, (counts.get(n) || 0) + 1);
    }
    let size = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || race.team_size;
    if (!sizes.includes(size)) size = sizes[sizes.length - 1];


    const halves = members.map((m) => parseHalf(m['Promedio de Medio Maraton x Equipo'])).filter((x): x is number => !!x);
    const half = halves.length ? [...halves].sort((a, b) => halves.filter((v) => v === b).length - halves.filter((v) => v === a).length)[0] : null;
    let team = existing.find((t) => lc(t.name) === key);
    if (team && !team.half_avg_min && half) await run('UPDATE teams SET half_avg_min = ? WHERE id = ?', [half, team.id]);
    if (!team) {
      const first = members[0];
      const captainName = `${first['Billing Name (First Name)'] || first['Nombre (First Name)']} ${first['Billing Name (Last Name)'] || first['Nombre (Last Name)']}`.trim();
      const id = await createTeam({
        race_id: race.id, name: first['Team Name'].trim(), category: null, captain_name: captainName,
        captain_email: lc(first['Billing Email Address'] || first['Mail']), captain_phone: first['Teléfono'] || null,
        amount: race.team_price, payment_status: 'pending', payment_method: 'manual', paid_at: null,
        claim_code: newClaimCode(race.brand), team_size: size, notes: null, created_at: toIso(first['Registration Date']), half_avg_min: half,
      });
      team = (await one<Team>('SELECT * FROM teams WHERE id = ?', [id]))!;
      existing.push(team);
      res.teamsCreated++;
    }
    // RedPodium sometimes has the same person twice in a team (re-registered):
    // keep the first one, matched by first + last name (captains often put
    // their own email for every teammate, so email alone isn't reliable).
    const seen = new Set((await many<{ first_name: string; last_name: string }>('SELECT first_name, last_name FROM runners WHERE team_id = ?', [team.id]))
      .map((r) => words(r.first_name)[0] + ' ' + words(r.last_name)[0]));
    for (const m of members) {
      const ext = 'redpodium:' + m['Registrant ID'];
      if (await one('SELECT 1 FROM runners WHERE external_id = ?', [ext])) { res.skipped++; continue; }
      const nk = words(m['Nombre (First Name)'])[0] + ' ' + words(m['Nombre (Last Name)'])[0];
      if (seen.has(nk)) { res.warnings.push(`${m['Team Name'].trim()}: ${m['Nombre (First Name)']} ${m['Nombre (Last Name)']} repetido, se omitió`); res.skipped++; continue; }
      seen.add(nk);
      const top = await one<{ bib: number | null }>('SELECT max(bib) AS bib FROM runners WHERE race_id = ?', [race.id]);
      const bib = Math.max(race.bib_start - 1, top?.bib || 0) + 1;
      const gender = /^f/i.test(m['Genero']) ? 'F' : /^m/i.test(m['Genero']) ? 'M' : null;
      const waived = lc(m['Waiver']) === 'completed';
      await run(
        `INSERT INTO runners (id, race_id, team_id, bib, first_name, last_name, email, phone, birth_date, gender, shirt_size,
           waiver_accepted_at, waiver_text, fee, payment_status, payment_method, external_id, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [newId(), race.id, team.id, bib, m['Nombre (First Name)'], m['Nombre (Last Name)'], lc(m['Mail']), m['Teléfono'] || null,
          m['Fecha de Nacimiento'] || null, gender, m['T-Shirt'] || null, waived ? toIso(m['Date Completed'] || m['Registration Date']) : null,
          waived ? 'Aceptado en RedPodium' : null, 0, 'paid', 'import', ext, toIso(m['Registration Date'])]
      );
      res.runnersCreated++;
    }
  }
  res.unmatched = await rematch(race.id);
  return res;
}

/* ---------------- Ecwid ---------------- */
export function looksLikeEcwid(rows: Record<string, string>[]) {
  return !!rows[0] && 'order_number' in rows[0] && 'name' in rows[0];
}

export async function importEcwid(raceId: string, rows: Record<string, string>[]): Promise<ImportResult> {
  const race = await getRace(raceId);
  if (!race) throw new Error('race_not_found');
  const res: ImportResult = { kind: 'ecwid', teamsCreated: 0, runnersCreated: 0, paymentsCreated: 0, skipped: 0, unmatched: 0, warnings: [] };
  for (const o of rows) {
    const product = o['name'] || '';
    const isHold = /hold|apartado/i.test(product);
    const isRunner = /runner|corredor/i.test(product);
    if (!isHold && !isRunner) { res.skipped++; continue; }
    if (o['payment_status'] && !/paid|pagad/i.test(o['payment_status'])) { res.skipped++; continue; }
    const price = Number(o['price']) || race.runner_fee;
    const total = Number(o['order_total'] || o['total']) || price;
    const qty = Number(o['quantity']) || Math.max(1, Math.round(total / price));
    const created = await recordPayment({
      race_id: race.id, team_id: null, kind: isHold ? 'team' : 'slots', source: 'ecwid', external_id: 'ecwid:' + o['order_number'],
      quantity: isHold ? 1 : qty, amount: Math.round(total), payer_name: o['bill_person_name'] || o['shipto_person_name'] || null,
      payer_email: lc(o['email']), payer_phone: (o['bill_person_phone'] || '').replace(/[^\d+]/g, '') || null,
      comment: (o['order_comments'] || '').replace(/<br\s*\/?>/gi, ' · ') || null, paid_at: toIso(o['timestamp']),
    });
    if (created) res.paymentsCreated++; else res.skipped++;
  }
  res.unmatched = await rematch(race.id);
  return res;
}

/* ---------------- matching ---------------- */
// Tries to place every unassigned payment on a team: payer email against
// captains and runners, then payer name against runner names. Returns how
// many are still unassigned.
export async function rematch(raceId: string): Promise<number> {
  const pending = await many<{ id: string; payer_email: string | null; payer_name: string | null }>(
    'SELECT id, payer_email, payer_name FROM payments WHERE race_id = ? AND team_id IS NULL AND resolution IS NULL ORDER BY paid_at', [raceId]);
  if (!pending.length) return 0;
  const teams = await many<{ id: string; captain_email: string; captain_name: string }>('SELECT id, captain_email, captain_name FROM teams WHERE race_id = ?', [raceId]);
  const runners = await many<{ team_id: string; email: string; first_name: string; last_name: string }>(
    'SELECT team_id, email, first_name, last_name FROM runners WHERE race_id = ?', [raceId]);
  const byEmail = new Map<string, Set<string>>();
  const add = (m: Map<string, Set<string>>, k: string, v: string) => { if (k) m.set(k, (m.get(k) || new Set()).add(v)); };
  teams.forEach((t) => add(byEmail, lc(t.captain_email), t.id));
  runners.forEach((r) => add(byEmail, lc(r.email), r.team_id));
  const byName = new Map<string, Set<string>>();
  const nameKeys = (first: string, last: string) => {
    const f = words(first)[0], l = words(last);
    return f && l.length ? [`${f} ${l[0]}`] : [];
  };
  runners.forEach((r) => nameKeys(r.first_name, r.last_name).forEach((k) => add(byName, k, r.team_id)));
  teams.forEach((t) => { const w = words(t.captain_name); if (w.length > 1) add(byName, `${w[0]} ${w[1]}`, t.id); });

  let left = 0;
  for (const p of pending) {
    let hit = byEmail.get(lc(p.payer_email));
    if (!hit || hit.size !== 1) {
      const w = words(p.payer_name);
      const tries = w.length > 1 ? [`${w[0]} ${w[1]}`, `${w[0]} ${w[w.length - 2] || ''}`, `${w[0]} ${w[w.length - 1]}`] : [];
      hit = undefined;
      for (const k of tries) { const h = byName.get(k); if (h && h.size === 1) { hit = h; break; } }
    }
    if (hit && hit.size === 1) await assignPayment(p.id, [...hit][0]);
    else left++;
  }
  return left;
}

export async function importCsvText(raceId: string, text: string): Promise<ImportResult> {
  const rows = parseCsv(text);
  if (looksLikeRedPodium(rows)) return importRedPodium(raceId, rows);
  if (looksLikeEcwid(rows)) return importEcwid(raceId, rows);
  throw new Error('unknown_csv');
}
