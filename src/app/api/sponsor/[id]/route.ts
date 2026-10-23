import { NextResponse } from 'next/server';
import { one } from '@/lib/db';

// Serves a sponsor logo (PNG). A new upload gets a new id, so cache hard.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const row = await one<{ img: Buffer }>('SELECT img FROM race_sponsors WHERE id = ?', [params.id]);
  if (!row) return new NextResponse('Not found', { status: 404 });
  return new NextResponse(new Uint8Array(row.img), {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
}
