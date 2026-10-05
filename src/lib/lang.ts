import { cookies } from 'next/headers';
import { translate } from './dict';
import type { Lang } from './format';

export function getLang(): Lang {
  return cookies().get('reisin_lang')?.value === 'en' ? 'en' : 'es';
}
export function getT() {
  const lang = getLang();
  return { lang, t: (k: string) => translate(lang, k) };
}
