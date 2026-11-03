'use client';
import { useEffect } from 'react';

// Empties the saved cart once an order is paid.
export function ClearCart({ raceId }: { raceId: string }) {
  useEffect(() => { try { localStorage.removeItem(`reisin-cart-${raceId}`); } catch { /* ignore */ } }, [raceId]);
  return null;
}
