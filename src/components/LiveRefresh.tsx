'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Public status page: reloads the data every 60 s (and when the tab comes back).
export function LiveRefresh() {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 60_000);
    const vis = () => { if (document.visibilityState === 'visible') router.refresh(); };
    document.addEventListener('visibilitychange', vis);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', vis); };
  }, [router]);
  return null;
}
