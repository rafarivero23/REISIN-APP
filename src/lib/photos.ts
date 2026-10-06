// Photo library shipped in /public/photos (2000px + 800px "-sm" versions).
// pos = focal point for cropped heroes (CSS object-position).
export type Photo = { id: string; label: string; pos: string; wide: boolean; w: number; h: number };
export const PHOTOS: Photo[] = [
  { id: 'aerial-duo', label: 'Costa al atardecer', pos: '60% 60%', wide: true, w: 800, h: 571 },
  { id: 'golden-runner', label: 'Corredor dorado', pos: '50% 55%', wide: false, w: 600, h: 800 },
  { id: 'sunset-road', label: 'Carretera al amanecer', pos: '50% 48%', wide: false, w: 600, h: 800 },
  { id: 'beach-duo', label: 'Playa y acantilado', pos: '50% 50%', wide: false, w: 600, h: 800 },
  { id: 'coast-runner', label: 'Camino a la costa', pos: '50% 60%', wide: false, w: 450, h: 800 },
  { id: 'road-crew', label: 'Relevo en carretera', pos: '50% 45%', wide: false, w: 571, h: 800 },
  { id: 'handoff', label: 'Relevo', pos: '50% 55%', wide: true, w: 800, h: 533 },
  { id: 'car-13', label: 'Equipo 13', pos: '50% 50%', wide: true, w: 800, h: 533 },
  { id: 'desert-runner', label: 'Desierto', pos: '35% 55%', wide: true, w: 800, h: 533 },
  { id: 'shades', label: 'Corredor', pos: '50% 35%', wide: false, w: 533, h: 800 },
  { id: 'canyon-crowd', label: 'Runners meeting', pos: '50% 55%', wide: false, w: 533, h: 800 },
  { id: 'crowd-rocks', label: 'Público', pos: '50% 40%', wide: false, w: 533, h: 800 },
];
const byId = new Map(PHOTOS.map((p) => [p.id, p]));
export const getPhoto = (id: string | null | undefined) => (id ? byId.get(id) : undefined);
export const photoSrc = (id: string, small = false) => `/photos/${id}${small ? '-sm' : ''}.jpg`;
export const isPhoto = (id: unknown): id is string => typeof id === 'string' && byId.has(id);
// Default cover when a race hasn't picked one.
export const defaultCover = (brand: string) => (/baja/i.test(brand) ? 'aerial-duo' : 'sunset-road');
export const HOME_COVER = 'sunset-road';
export const LOGIN_PHOTO = 'golden-runner';
