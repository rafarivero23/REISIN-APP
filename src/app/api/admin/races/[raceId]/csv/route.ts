import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-guard';
import { getRace, teamsOfRace, runnersOfRace } from '@/lib/repo';
import { parseGroups, groupFor, categoryOf, fmtHalf } from '@/lib/groups';

export const dynamic = 'force-dynamic';

// Runner list for a race, opens in Excel (UTF-8 with BOM so accents survive).
export async function GET(_req: Request, { params }: { params: { raceId: string } }) {
  if (!(await getCurrentUser())) return new NextResponse('Unauthorized', { status: 401 });
  const race = await getRace(params.raceId);
  if (!race) return new NextResponse('Not found', { status: 404 });
  const teams = await teamsOfRace(race.id);
  const runners = await runnersOfRace(race.id);
  const rows: unknown[][] = [[
    'numero', 'nombre', 'apellidos', 'correo', 'telefono', 'fecha_nacimiento', 'genero', 'talla', 'equipo', 'categoria', 'grupo', 'hora_salida', 'promedio_medio', 'capitan',
    'contacto_emergencia', 'telefono_emergencia', 'exoneracion', 'cuota', 'pago', 'registrado',
  ]];
  const groups = parseGroups(race.start_groups);
  const cat = (teamId: string) => categoryOf(runners.filter((r) => r.team_id === teamId).map((r) => r.gender));
  for (const x of runners) {
    const tm = teams.find((t) => t.id === x.team_id);
    const g = groupFor(tm?.half_avg_min, groups);
    rows.push([x.bib, x.first_name, x.last_name, x.email, x.phone, x.birth_date, x.gender, x.shirt_size, tm?.is_solo ? 'SOLO' : tm?.name, tm ? cat(tm.id) : '', g?.label, g?.start, fmtHalf(tm?.half_avg_min), tm?.captain_name,
      x.emergency_name, x.emergency_phone, x.waiver_accepted_at, x.fee, x.payment_status, x.created_at]);
  }
  const csv = rows.map((r) => r.map((c) => { const s = c == null ? '' : String(c); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',')).join('\n');
  const name = race.name.replace(/[^\w-]+/g, '_') + '_corredores.csv';
  return new NextResponse('﻿' + csv, {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}"` },
  });
}
