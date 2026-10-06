// Race landing page content, edited by staff in admin → Página.
export type PageLink = { label: string; url: string };
export type PageAgendaItem = { day: string; time: string; title: string; note: string };
export type PageSection = { title: string; body: string };
export type PageData = { intro: string; links: PageLink[]; agenda: PageAgendaItem[]; sections: PageSection[]; cover: string; photos: string[] };

export const emptyPage = (): PageData => ({ intro: '', links: [], agenda: [], sections: [], cover: '', photos: [] });

import { isPhoto } from './photos';

const s = (v: unknown, max: number) => (v == null ? '' : String(v)).slice(0, max);
const arr = (v: unknown) => (Array.isArray(v) ? v : []);

export function parsePage(json: string | null | undefined): PageData {
  if (!json) return emptyPage();
  try {
    return cleanPage(JSON.parse(json));
  } catch {
    return emptyPage();
  }
}

// Trims, caps sizes and drops empty rows. Used on save and on read.
export function cleanPage(p: any): PageData {
  return {
    intro: s(p?.intro, 2000).trim(),
    links: arr(p?.links).slice(0, 12).map((l: any) => ({ label: s(l?.label, 60).trim(), url: safeUrl(s(l?.url, 500).trim()) })).filter((l) => l.label && l.url),
    agenda: arr(p?.agenda).slice(0, 40).map((a: any) => ({ day: s(a?.day, 40).trim(), time: s(a?.time, 20).trim(), title: s(a?.title, 140).trim(), note: s(a?.note, 300).trim() })).filter((a) => a.title),
    cover: isPhoto(p?.cover) ? p.cover : '',
    photos: Array.from(new Set(arr(p?.photos).filter(isPhoto))).slice(0, 24),
    sections: arr(p?.sections).slice(0, 20).map((x: any) => ({ title: s(x?.title, 100).trim(), body: s(x?.body, 6000).trim() })).filter((x) => x.title || x.body),
  };
}

// Only http(s) and mailto links; "bajaxing.mx/faq" becomes https://…
export function safeUrl(u: string): string {
  if (!u) return '';
  if (/^mailto:[^\s]+@[^\s]+$/i.test(u)) return u;
  if (/^https?:\/\/[^\s]+$/i.test(u)) return u;
  if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(u)) return 'https://' + u;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u)) return 'mailto:' + u;
  return '';
}

export const RESERVED_SLUGS = ['admin', 'login', 'api', 'captain', 'done', 'team-created', 'r', 'icon', 'apple-icon', 'favicon.ico', '_next'];
export function cleanSlug(v: unknown): string {
  return String(v ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

// Starting point copied from bajaxing.mx/registered — staff edit from here.
export const BAJA_TEMPLATE: PageData = {
  cover: 'aerial-duo',
  photos: ['golden-runner', 'handoff', 'beach-duo', 'car-13', 'sunset-road', 'canyon-crowd', 'coast-runner', 'shades', 'desert-runner', 'road-crew', 'crowd-rocks'],
  intro: 'Bienvenido a Baja Crossing, el relevo de La Paz a Los Cabos. Aquí está todo lo que tu equipo necesita antes de la carrera.',
  links: [
    { label: 'Preguntas frecuentes', url: 'https://bajaxing.mx/faq/' },
    { label: 'Ruta en Strava', url: 'https://www.strava.com/routes/3340381814278338766' },
    { label: 'Instagram', url: 'https://www.instagram.com/bajaxing' },
    { label: 'x@bajaxing.mx', url: 'mailto:x@bajaxing.mx' },
  ],
  agenda: [
    { day: 'Jueves 12 nov', time: '6:00 pm', title: 'Sunset Hike en Balandra (opcional)', note: 'Punto de encuentro: 24.23434, -110.30479' },
    { day: 'Viernes 13 nov', time: '4:00 pm', title: 'Entrega de race kits y runners meeting', note: '' },
    { day: 'Viernes 13 nov', time: '4:30 pm', title: 'Salida Solo runners', note: '' },
    { day: 'Viernes 13 nov', time: '12:00 am', title: 'Salida equipos', note: 'Medianoche del viernes al sábado' },
    { day: 'Domingo 15 nov', time: '11:00 am', title: 'Beach party y entrega de medallas', note: 'Veleros Beach Club, East Cape' },
  ],
  sections: [
    {
      title: 'Siguientes pasos',
      body: [
        '- **Paga el restante de tu inscripción.** El total es $6,500 por corredor; el apartado cubrió 2 corredores. Fecha límite: 1 de agosto.',
        '- Revisa las [preguntas frecuentes](https://bajaxing.mx/faq/).',
        '- Registra a tus corredores: el capitán entra con su código y comparte la contraseña del equipo.',
        '- Estudia la [ruta](https://www.strava.com/routes/3340381814278338766).',
      ].join('\n'),
    },
    {
      title: 'Renta de autos',
      body: [
        '- **Enterprise** 30% de descuento. Código: por confirmar. [Ver promoción](https://enterprise.mx/ofertas-y-promociones/promocion/baja-crossing-2025)',
        '- **Sampa Explore** 15% de descuento. Código: **BAJAX**',
      ].join('\n'),
    },
    {
      title: 'Hoteles en La Paz',
      body: [
        '- **[Baja Club](https://bajaclubhotel.com/es/)** (frente a la salida). Tarifas especiales por confirmar.',
        '- **Courtyard Marriott** habitaciones desde $120 USD la noche. [Reserva aquí](https://www.marriott.com/event-reservations/reservation-link.mi?id=1757456105290&key=GRP&app=resvlink)',
      ].join('\n'),
    },
    { title: 'Hoteles en Los Cabos', body: 'Por confirmar.' },
  ],
};
