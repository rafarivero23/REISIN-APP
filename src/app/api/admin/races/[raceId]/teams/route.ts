import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getCurrentUser } from '@/lib/auth-guard';
import { getRace, teamsOfRace, runnersOfRace, isListedTeam, type Team, type Runner } from '@/lib/repo';
import { parseGroups, groupFor, categoryOf, categoryLabel, fmtHalf } from '@/lib/groups';
import { translate } from '@/lib/dict';
import { teamSlots } from '@/lib/stats';

export const dynamic = 'force-dynamic';

// Confirmed teams + status (registration, waivers, payment) as an Excel file:
// sheets Resumen · Equipos · Solos · Corredores.
export async function GET(_req: Request, { params }: { params: { raceId: string } }) {
  if (!(await getCurrentUser())) return new NextResponse('Unauthorized', { status: 401 });
  const race = await getRace(params.raceId);
  if (!race) return new NextResponse('Not found', { status: 404 });
  const all = (await teamsOfRace(race.id)).filter(isListedTeam);
  const runners = await runnersOfRace(race.id);
  const groups = parseGroups(race.start_groups);
  const tr = (k: string) => translate('es', k);
  const byNo = (a: Team, b: Team) => (a.team_no ?? 1e9) - (b.team_no ?? 1e9) || a.name.localeCompare(b.name, 'es');
  const teams = all.filter((t) => !t.is_solo).sort(byNo);
  const solos = all.filter((t) => t.is_solo).sort(byNo);
  const rs = (id: string) => runners.filter((r) => r.team_id === id).sort((a, b) => (a.bib || 0) - (b.bib || 0));
  const fullName = (r: Runner) => `${r.first_name} ${r.last_name}`.trim();
  const d = (s: string | null) => (s ? s.slice(0, 10) : '');

  const status = (t: Team) => {
    const list = rs(t.id), sl = teamSlots(t, race);
    const missing = Math.max(0, sl.size - list.length);
    const noWaiver = list.filter((r) => !r.waiver_accepted_at);
    const complete = missing === 0 && noWaiver.length === 0;
    const pend: string[] = [];
    if (missing) pend.push(`Faltan ${missing} corredor${missing > 1 ? 'es' : ''}`);
    if (noWaiver.length) pend.push(`Sin exoneración: ${noWaiver.map(fullName).join(', ')}`);
    const pay = t.settled_at ? 'Liquidado' : sl.balance > 0 ? `Saldo $${sl.balance.toLocaleString('es-MX')}` : t.payment_status === 'paid' ? 'Pagado' : 'Pendiente';
    return { list, sl, missing, noWaiver, complete, pend: pend.join(' · '), pay };
  };

  const teamRows: unknown[][] = [['No.', 'Equipo', 'Categoría', 'Integrantes', 'Grupo', 'Salida', 'Prom. medio maratón', 'Capitán', 'Correo capitán', 'Teléfono capitán', 'Código capitán', 'Código enviado',
    'Corredores registrados', 'Faltan corredores', 'Exoneraciones firmadas', 'Sin exoneración', 'Estado registro', 'Pendientes', 'Pago', 'Tipo de registro', 'Contraseña de equipo', 'Logo', 'Compite', 'Notas']];
  const stats = { complete: 0, incomplete: 0, runners: 0, slots: 0, waivers: 0, missing: 0, noWaiver: 0 };
  for (const t of teams) {
    const s = status(t), g = groupFor(t.half_avg_min, groups);
    const cat = categoryLabel(String(s.sl.size), categoryOf(s.list.map((r) => r.gender), false), tr);
    stats[s.complete ? 'complete' : 'incomplete']++; stats.runners += s.list.length; stats.slots += s.sl.size;
    stats.waivers += s.list.length - s.noWaiver.length; stats.missing += s.missing; stats.noWaiver += s.noWaiver.length;
    teamRows.push([t.team_no ?? '', t.name, cat, s.sl.size, g?.label ? `Grupo ${g.label}` : '', g?.start || '', t.half_avg_min ? fmtHalf(t.half_avg_min) : '', t.captain_name, t.captain_email, t.captain_phone || '', t.claim_code, t.code_sent_at ? `Sí · ${d(t.code_sent_at)}` : 'No',
      `${s.list.length}/${s.sl.size}`, s.missing, s.list.length - s.noWaiver.length, s.noWaiver.length, s.complete ? 'Completo' : 'Incompleto', s.pend, s.pay, t.reg_type === 'full' ? 'Completo' : 'Preventa', t.password_hash ? 'Sí' : 'No', t.logo ? 'Sí' : 'No', t.no_race ? 'NO COMPITE' : 'Sí', t.notes || '']);
  }
  const soloRows: unknown[][] = [['No.', 'Nombre', 'Correo', 'Teléfono', 'Código', 'Registro', 'Exoneración', 'Estado', 'Pago', 'Notas']];
  for (const t of solos) {
    const s = status(t), r = s.list[0];
    soloRows.push([t.team_no != null ? `S${t.team_no}` : '', r ? fullName(r) : t.captain_name, r?.email || t.captain_email, r?.phone || t.captain_phone || '', t.claim_code, r ? 'Sí' : 'No', r?.waiver_accepted_at ? `Sí · ${d(r.waiver_accepted_at)}` : 'No',
      s.complete ? 'Completo' : 'Incompleto', s.pay, t.notes || '']);
  }
  const runnerRows: unknown[][] = [['No. equipo', 'Equipo', 'Número', 'Nombre', 'Apellidos', 'Correo', 'Teléfono', 'Género', 'Talla', 'Fecha de nacimiento', 'Contacto de emergencia', 'Teléfono de emergencia', 'Exoneración', 'Fecha exoneración', 'Pago corredor', 'Registrado']];
  for (const t of [...teams, ...solos]) for (const r of rs(t.id))
    runnerRows.push([t.team_no != null ? (t.is_solo ? `S${t.team_no}` : t.team_no) : '', t.is_solo ? 'SOLO' : t.name, r.bib ?? '', r.first_name, r.last_name, r.email, r.phone || '', r.gender || '', r.shirt_size || '', r.birth_date || '', r.emergency_name || '', r.emergency_phone || '',
      r.waiver_accepted_at ? 'Firmada' : 'PENDIENTE', d(r.waiver_accepted_at), r.payment_status === 'paid' ? 'Pagado' : 'Pendiente', d(r.created_at)]);
  const summary: unknown[][] = [[race.name], [`Exportado ${new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })}`], [],
    ['Equipos confirmados', teams.length], ['Equipos completos (corredores + exoneraciones)', stats.complete], ['Equipos incompletos', stats.incomplete],
    ['Corredores registrados (equipos)', `${stats.runners} de ${stats.slots} lugares`], ['Lugares sin corredor', stats.missing], ['Exoneraciones firmadas', stats.waivers], ['Exoneraciones pendientes', stats.noWaiver],
    [], ['Solo runners', solos.length], ['Solos completos', solos.filter((t) => status(t).complete).length]];

  const wb = XLSX.utils.book_new();
  const add = (name: string, rows: unknown[][], widths: number[], filter = true) => {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = widths.map((w) => ({ wch: w }));
    if (filter && rows.length > 1) ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length - 1, c: rows[0].length - 1 } }) };
    XLSX.utils.book_append_sheet(wb, ws, name);
  };
  add('Resumen', summary, [46, 24], false);
  add('Equipos', teamRows, [6, 28, 22, 11, 10, 9, 12, 26, 30, 15, 14, 16, 12, 10, 12, 10, 13, 50, 16, 12, 12, 7, 30]);
  add('Solos', soloRows, [6, 28, 30, 15, 14, 9, 18, 12, 16, 30]);
  add('Corredores', runnerRows, [9, 26, 9, 18, 22, 30, 15, 9, 7, 13, 24, 16, 12, 13, 13, 12]);
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const name = race.name.replace(/[^\w-]+/g, '_') + '_equipos.xlsx';
  return new NextResponse(new Uint8Array(buf), {
    headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="${name}"` },
  });
}
