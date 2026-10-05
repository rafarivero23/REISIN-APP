export type Lang = 'es' | 'en';

export const money = (n: number | null | undefined, lang: Lang = 'es') =>
  new Intl.NumberFormat(lang === 'es' ? 'es-MX' : 'en-US', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(Number(n) || 0);

export const fmtDate = (d: string | null | undefined, lang: Lang = 'es') => {
  if (!d) return '—';
  const x = new Date(String(d).length === 10 ? d + 'T12:00:00' : d);
  return isNaN(+x) ? d : x.toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Mexico_City' });
};

export const fmtDT = (d: string | null | undefined, lang: Lang = 'es') =>
  d
    ? new Date(d).toLocaleString(lang === 'es' ? 'es-MX' : 'en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City' })
    : '—';

export const brandKey = (b: string) => (b === 'Sal a Valle' ? 'sav' : b === 'Baja Crossing' ? 'baja' : 'other');
export const brandPrefix = (b: string) => (b === 'Sal a Valle' ? 'SAV' : b === 'Baja Crossing' ? 'BJC' : 'RSN');
export const splitCats = (s: string | null | undefined) => (s || '').split(',').map((x) => x.trim()).filter(Boolean);
export const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
export const BRANDS = ['Sal a Valle', 'Baja Crossing', 'Reisin'];
