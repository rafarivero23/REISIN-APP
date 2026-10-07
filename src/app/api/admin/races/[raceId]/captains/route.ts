import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-guard';
import { getRace, teamsOfRace, isListedTeam } from '@/lib/repo';
import { translate } from '@/lib/dict';
import { captainMessage } from '@/lib/capmsg';

export const dynamic = 'force-dynamic';

// One row per captain with a ready-to-send subject and message — for mail
// merge (Gmail/Outlook) or to hand to Claude to create the drafts.
export async function GET(req: Request, { params }: { params: { raceId: string } }) {
  if (!(await getCurrentUser())) return new NextResponse('Unauthorized', { status: 401 });
  const race = await getRace(params.raceId);
  if (!race) return new NextResponse('Not found', { status: 404 });
  const origin = new URL(req.url).origin;
  const tr = (k: string) => translate('es', k);
  const teams = (await teamsOfRace(race.id)).filter((x) => isListedTeam(x) && !x.is_solo).sort((a, b) => a.name.localeCompare(b.name));
  const rows: unknown[][] = [['equipo', 'capitan', 'nombre', 'correo', 'telefono', 'codigo', 'enlace', 'contrasena_pagina', 'enviado', 'asunto', 'mensaje']];
  for (const x of teams) {
    const m = captainMessage(tr, x, race, origin, true);
    rows.push([x.name, x.captain_name, (x.captain_name || '').split(/\s+/)[0], x.captain_email, x.captain_phone, x.claim_code, m.url, race.access_code || '', x.code_sent_at || '', m.subject, m.body]);
  }
  const csv = rows.map((r) => r.map((c) => { const s = c == null ? '' : String(c); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',')).join('\n');
  const name = race.name.replace(/[^\w-]+/g, '_') + '_capitanes.csv';
  return new NextResponse('﻿' + csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}"` } });
}
