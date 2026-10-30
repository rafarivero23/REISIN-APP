// Race landing page content, edited by staff in admin → Página.
export type PageLink = { label: string; url: string };
export type PageAgendaItem = { day: string; time: string; title: string; note: string };
export type PageSection = { title: string; body: string };
export type PageFaq = { q: string; a: string };
export type PageStat = { value: string; unit: string; label: string };
export type PageData = { intro: string; links: PageLink[]; agenda: PageAgendaItem[]; sections: PageSection[]; cover: string; photos: string[]; faq: PageFaq[]; stats: PageStat[]; video: string };

export const emptyPage = (): PageData => ({ intro: '', links: [], agenda: [], sections: [], cover: '', photos: [], faq: [], stats: [], video: '' });

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
    video: videoEmbed(s(p?.video, 300).trim()) ? s(p?.video, 300).trim() : '',
    stats: arr(p?.stats).slice(0, 6).map((x: any) => ({ value: s(x?.value, 12).trim(), unit: s(x?.unit, 30).trim(), label: s(x?.label, 40).trim() })).filter((x) => x.value),
    faq: arr(p?.faq).slice(0, 40).map((x: any) => ({ q: s(x?.q, 200).trim(), a: s(x?.a, 3000).trim() })).filter((x) => x.q),
    sections: arr(p?.sections).slice(0, 20).map((x: any) => ({ title: s(x?.title, 100).trim(), body: s(x?.body, 6000).trim() })).filter((x) => x.title || x.body),
  };
}

// Background video for the hero: Vimeo or YouTube link → muted looping embed URL.
export function videoEmbed(u: string): string | null {
  const v = /vimeo\.com\/(?:video\/)?(\d+)/.exec(u || '');
  if (v) return `https://player.vimeo.com/video/${v[1]}?background=1&autoplay=1&loop=1&muted=1&dnt=1`;
  const y = /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/.exec(u || '');
  if (y) return `https://www.youtube-nocookie.com/embed/${y[1]}?autoplay=1&mute=1&loop=1&playlist=${y[1]}&controls=0&playsinline=1&modestbranding=1`;
  return null;
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
  faq: [],
  stats: [],
  video: '',
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

// Starting point copied from reisin.mx/sav (Sal a Valle 2027), cleaned up so
// it matches what captains were told (liquidación before Dec 1).
export const SAV_TEMPLATE: Omit<PageData, 'cover' | 'photos'> = {
  intro: 'Bienvenidos a SAV27, la novena edición de Sal a Valle, presentada por Nike Running: 120 km en relevos de Ixtapan de la Sal a Valle de Bravo, cruzando montañas pobladas de pinos, carreteras calientes y volcanes helados.\n\nEn esta página registras a tu equipo y a tus corredores, haces cambios y pagas la liquidación de tu equipo. La iremos actualizando con toda la información.',
  links: [
    { label: 'Ruta en Strava', url: 'https://www.strava.com/routes/3443436604377812702' },
    { label: 'reisin.mx/sav', url: 'https://reisin.mx/sav/' },
    { label: 'Instagram', url: 'https://www.instagram.com/reisin_reisin' },
  ],
  video: 'https://vimeo.com/1107471888',
  stats: [
    { value: '120', unit: 'km', label: 'Distancia' },
    { value: '5', unit: '+1 camioneta', label: 'Formato' },
    { value: '1–5', unit: 'km por relevo', label: 'Relevos' },
  ],
  agenda: [
    { day: 'Viernes 19 de febrero', time: '12:00 pm', title: 'Check-in en Fiesta Americana Ixtapan de la Sal', note: 'Llega a partir de las 12:00 pm y no después de las 5:30 pm.' },
    { day: 'Viernes 19 de febrero', time: '6:00 pm', title: 'Runners meeting', note: 'Instrucciones de carrera y dudas. Obligatoria para todo el equipo.' },
    { day: 'Viernes 19 de febrero', time: '7:00 pm', title: 'Cena de competidores', note: 'Incluida para los 5 corredores del equipo.' },
    { day: 'Sábado 20 de febrero', time: '3:00 am', title: 'Salida Solo Runners', note: '120 km · tiempo límite 19 horas.' },
    { day: 'Sábado 20 de febrero', time: '5:00 am', title: 'Salida equipos', note: 'Antes de arrancar: coffee break y snacks para desayunar.' },
    { day: 'Sábado 20 de febrero', time: '11:00 am', title: 'SAV Fest en Valle de Bravo', note: 'Fiesta de llegada con música, comida y chelas Reina.' },
  ],
  sections: [
    {
      title: 'La ruta',
      body: 'De Ixtapan de la Sal a Valle de Bravo: montañas pobladas de pinos, carreteras calientes y volcanes helados. Relevos de 1 a 5 km; cada corredor corre entre 20 y 25 km, según la estrategia de su equipo.',
    },
    {
      title: 'Incluye',
      body: [
        '- Inscripción para 5 corredores.',
        '- Hospedaje en el Hotel Fiesta Americana Ixtapan de la Sal la noche del viernes 19: 2 habitaciones con dos camas queen por equipo (no incluido para Solo Runners).',
        '- Race kit, mapas detallados de la ruta, bandera, viniles para la camioneta y muchas sorpresas más (not your average race pack).',
        '- Cena de bienvenida para los 5 corredores en Ixtapan de la Sal.',
        '- Fiesta de llegada en Valle de Bravo con comida y chelas Reina.',
      ].join('\n'),
    },
    {
      title: 'Responsabilidad del equipo',
      body: [
        '- Juntar 5 corredores capaces de cruzar de Ixtapan de la Sal a Valle de Bravo.',
        '- Diseñar un logo de equipo y subirlo en tu panel de capitán.',
        '- Camioneta de máximo 6 m de largo y 2 m de ancho.',
        '- Llevar sus comidas, snacks, hidratación y kit de primeros auxilios.',
        '- Usar ropa reflejante, poner un letrero de **"Cuidado: corredores"**, pintar la camioneta, armar una buena playlist y no olvidar el papel de baño.',
      ].join('\n'),
    },
    {
      title: 'Seguridad',
      body: 'El Gobierno del Estado de México proporcionará seguridad federal y estatal durante la ruta y controlará carreteras y tráfico. Habrá checkpoints con staff de SAV cada 30 km y cuatro estaciones de primeros auxilios. Unos días antes de la carrera te mandamos el teléfono de emergencia.',
    },
    {
      title: 'Pagos',
      body: [
        '- El apartado del equipo no es reembolsable, pero sí transferible.',
        '- La liquidación del equipo se paga desde tu panel de capitán antes del **1 de diciembre**.',
      ].join('\n'),
    },
  ],
  faq: [
    { q: '¿Tenemos hospedaje incluido?', a: 'Equipos: sí, en Ixtapan de la Sal la noche del viernes 19: 2 habitaciones con dos camas queen por equipo.\n\nSolo Runners: la inscripción no incluye hospedaje.\n\nNo hay hospedaje incluido en Valle de Bravo.' },
    { q: '¿Habrá algún servicio para dejar nuestras maletas?', a: 'Sí, habrá bag check: una maleta por corredor. La dejas en Ixtapan de la Sal y la recoges al llegar a Valle de Bravo.' },
    { q: '¿Habrá puntos de hidratación y comida?', a: 'No habrá estaciones de hidratación en la ruta; cada equipo lleva la comida y snacks que va a consumir durante la carrera.\n\nEl viernes en la noche hay cena de competidores y el sábado, antes de arrancar, una barra de coffee break y snacks para desayunar.' },
    { q: '¿A qué hora tenemos que llegar el viernes a Ixtapan de la Sal?', a: 'A partir de las 12:00 pm. Te recomendamos no llegar después de las 5:30 pm: a las 6:00 pm es la plática con instrucciones y dudas antes de la carrera.' },
    { q: '¿Qué equipo y ropa tenemos que llevar?', a: 'Durante la carrera hay cambios de clima drásticos, así que lleva ropa para calor y para frío. No necesitas tenis de trail.\n\nBásicos:\n- Ropa reflejante\n- Bloqueador solar\n- Guantes\n- Gorra\n- Repelente\n- Lentes de sol' },
    { q: '¿Cuál es la distancia total y cuántos km corre cada integrante?', a: 'Son 120 km en total. Cada corredor corre entre 20 y 25 km en relevos de 1 a 5 km, según la estrategia de su equipo. Revisa la [ruta en Strava](https://www.strava.com/routes/3443436604377812702).' },
    { q: '¿Es obligatorio seguir el manual de ruta?', a: 'Es obligatorio seguir la ruta marcada. Cómo y dónde hacen los relevos lo decide cada equipo. El manual de ruta se compartirá antes de la carrera.' },
    { q: '¿Habrá seguridad y primeros auxilios?', a: 'Sí. La carrera cuenta con el apoyo de la Secretaría de Seguridad del Estado. Habrá checkpoints con staff de SAV cada 30 km y cuatro estaciones de primeros auxilios (vienen en el manual de ruta, que se compartirá antes de la carrera). Unos días antes te mandamos el teléfono de emergencia.' },
    { q: '¿La camioneta acompaña al corredor toda la carrera?', a: 'En cerca del 80% de la ruta la camioneta puede ir detrás del corredor. En el manual de ruta, que se compartirá antes de la carrera, vienen las indicaciones de cada tramo para el corredor y para la camioneta.' },
    { q: '¿Tenemos que llevar un conductor?', a: 'Pueden llevar un conductor extra, pero te recomendamos que los 5 corredores se turnen el volante: van más cómodos y es parte de la experiencia.' },
    { q: '¿Podemos tener porras y acompañantes?', a: 'Las porras solo pueden estar en el km 100 o en la meta en Valle de Bravo. No se permiten porras en la ruta ni acompañantes en las camionetas (salvo el conductor extra, si llevan uno).' },
    { q: '¿Podemos invitar a familiares y amigos al evento de llegada?', a: 'Sí. En Valle de Bravo habrá un evento de llegada con música, comida y bebidas para los corredores. Tus invitados pueden entrar con un costo adicional por persona.' },
  ],
};
