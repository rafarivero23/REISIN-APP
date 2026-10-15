import { NextResponse } from 'next/server';
import { one } from '@/lib/db';

// Serves an uploaded race photo. ?s=sm → 800px version. Never changes, so cache hard.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const small = new URL(req.url).searchParams.get('s') === 'sm';
  const row = await one<{ img: Buffer }>(`SELECT ${small ? 'sm' : 'lg'} AS img FROM race_photos WHERE id = ?`, [params.id]);
  if (!row) return new NextResponse('Not found', { status: 404 });
  return new NextResponse(new Uint8Array(row.img), {
    headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
}
