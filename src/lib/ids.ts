import { randomUUID, randomInt } from 'crypto';

export function newId(): string {
  return randomUUID();
}

export const now = () => new Date().toISOString();

const ALPH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function brandPrefix(brand: string) {
  return brand === 'Sal a Valle' ? 'SAV' : brand === 'Baja Crossing' ? 'BJC' : 'RSN';
}
// Captain code, e.g. SAV-7K2QX. No 0/O/1/I so it reads cleanly aloud.
export function newClaimCode(brand: string) {
  let s = '';
  for (let i = 0; i < 5; i++) s += ALPH[randomInt(ALPH.length)];
  return brandPrefix(brand) + '-' + s;
}
