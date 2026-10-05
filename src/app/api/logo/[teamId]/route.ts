import { NextResponse } from 'next/server';
import { one } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Serves a team logo stored as a data: URL. Public on purpose (logos show
// on the portal and in exports).
export async function GET(_req: Request, { params }: { params: { teamId: string } }) {
  const row = await one<{ logo: string | null }>('SELECT logo FROM teams WHERE id = ?', [params.teamId]);
  const m = row?.logo && /^data:(image\/[a-z]+);base64,(.+)$/.exec(row.logo);
  if (!m) return new NextResponse('Not found', { status: 404 });
  return new NextResponse(Buffer.from(m[2], 'base64'), { headers: { 'Content-Type': m[1], 'Cache-Control': 'public, max-age=300' } });
}
