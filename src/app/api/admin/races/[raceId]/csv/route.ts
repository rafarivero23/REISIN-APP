import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-guard';
import { getRace, teamsOfRace, runnersOfRace } from '@/lib/repo';

export const dynamic = 'force-dynamic';

// Runner list for a race, opens in Excel (UTF-8 with BOM so accents survive).
export async function GET(_req: Request, { params }: { params: { raceId: string } }) {
  if (!(await getCurrentUser())) return new NextResponse('Unauthorized', { status: 401 });
  const race = await getRace(params.raceId);
  if (!race) return new NextResponse('Not found', { status: 404 });
  const teams = await teamsOfRace(race.id);
  const runners = await runnersOfRace(race.id);
  const rows: unknown[][] = [[
    'numero', 'nombre', 'apellidos', 'correo', 'telefono', 'fecha_nacimiento', 'genero', 'talla', 'equipo', 'categoria', 'capitan',
    'contacto_emergencia', 'telefono_emergencia', 'exoneracion', 'cuota', 'pago', 'registrado',
  ]];
  for (const x of runners) {
    const tm = teams.find((t) => t.id === x.team_id);
    rows.push([x.bib, x.first_name, x.last_name, x.email, x.phone, x.birth_date, x.gender, x.shirt_size, tm?.name, tm?.category, tm?.captain_name,
      x.emergency_name, x.emergency_phone, x.waiver_accepted_at, x.fee, x.payment_status, x.created_at]);
  }
  const csv = rows.map((r) => r.map((c) => { const s = c == null ? '' : String(c); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',')).join('\n');
  const name = race.name.replace(/[^\w-]+/g, '_') + '_corredores.csv';
  return new NextResponse('﻿' + csv, {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}"` },
  });
}
