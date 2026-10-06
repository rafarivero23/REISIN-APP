import { notFound, redirect } from 'next/navigation';
import { one } from '@/lib/db';

// Short shareable link: /baja-crossing-2026 → the race page.
export default async function SlugPage({ params }: { params: { slug: string } }) {
  const r = await one<{ id: string }>('SELECT id FROM races WHERE lower(slug) = lower(?)', [decodeURIComponent(params.slug)]);
  if (!r) notFound();
  redirect(`/r/${r.id}`);
}
