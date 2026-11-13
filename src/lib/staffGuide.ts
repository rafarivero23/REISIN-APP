// Staff guide for a race: password-protected public page at /guia/[raceId],
// edited in the admin ("Guía staff" tab). Text fields use the RichText
// formatter: "- " bullets, **bold**, [text](url), blank line = paragraph.

export type GuideSection = { title: string; body: string };
export type GuidePerson = { name: string; tag: string; flights: string; stay: string; car: string; basecamp: string; race: string };
export type GuideData = { intro: string; sections: GuideSection[]; people: GuidePerson[] };

export const EMPTY_GUIDE: GuideData = { intro: '', sections: [], people: [] };
export const EMPTY_PERSON: GuidePerson = { name: '', tag: '', flights: '', stay: '', car: '', basecamp: '', race: '' };

const str = (v: unknown, max: number) => String(v ?? '').replace(/\r/g, '').slice(0, max);

export function cleanGuide(v: unknown): GuideData {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const arr = (x: unknown) => (Array.isArray(x) ? x : []);
  return {
    intro: str(o.intro, 4000),
    sections: arr(o.sections).slice(0, 40).map((s: any) => ({ title: str(s?.title, 120).trim(), body: str(s?.body, 20000) })).filter((s) => s.title || s.body.trim()),
    people: arr(o.people).slice(0, 80).map((p: any) => ({
      name: str(p?.name, 80).trim(), tag: str(p?.tag, 40).trim(),
      flights: str(p?.flights, 3000), stay: str(p?.stay, 3000), car: str(p?.car, 2000), basecamp: str(p?.basecamp, 2000), race: str(p?.race, 3000),
    })).filter((p) => p.name),
  };
}

export function parseGuide(raw: string | null | undefined): GuideData {
  if (!raw) return EMPTY_GUIDE;
  try { return cleanGuide(JSON.parse(raw)); } catch { return EMPTY_GUIDE; }
}

// ---------- Baja Crossing 2026 starting point (route V2, Teams start Sat 14:00) ----------
const P = (name: string, tag: string, flights: string, stay: string, car: string, basecamp: string, race: string): GuidePerson => ({ name, tag, flights, stay, car, basecamp, race });
const F_CABO = '- **Mié 11** · TLC 15:00 → SJD 16:06 · Y4 550 · **TKUP9X**\n- **Lun 16** · SJD 11:29 → TLC 14:25 · Y4 551 · **TKUP9X**';
const F_LAP = '- **Jue 12** · AIFA 15:22 → LAP 16:39 · Y4 7170 · **AHCT8A**\n- **Mar 17** · SJD 11:29 → TLC 14:25 · Y4 551 · **QLJ73U**';
const SETUP = 'Vie 13 · montaje 06:00 con Vicente y equipo';
const NIKE_AM = 'Vie 13 · con Nike en la mañana; llega a basecamp 14:30';

export const BAJA_GUIDE_TEMPLATE: GuideData = {
  intro: 'Todas las horas son hora de Baja California Sur, **1 hora menos que CDMX**. Las salidas de Toluca y AIFA están en hora de CDMX.\n\nPlan de carrera: Solo Runners salen vie 13 a las 16:30 desde basecamp. Teams salen sáb 14 a las 14:00 desde el Malecón de La Paz (pendiente de Protección Civil).',
  people: [
    P('Rafa', '', 'Por confirmar', '- Airbnb La Paz · Hab. 1 · mié 11 → dom 15\n- Cabo: por confirmar', '', `**Brief de carrera (17:00)**\n${SETUP}`, 'Por confirmar'),
    P('Chris', '', F_CABO, '- Airbnb La Paz · Hab. 2 · mié 11 → dom 15\n- Cabo dom 15: por confirmar', 'Conductor · confirmación **#768318** · devolver lun 16 en SJD antes de 09:30', `**Catering**\n${SETUP}`, '- **CP4 · La Fortuna** · sáb 23:00 → dom 11:00, con Choco'),
    P('Eren', '', F_CABO, '- Courtyard La Paz · Hab. 1 · mié 11 → sáb 14\n- Laiva Cabo · King 2 · sáb 14 → lun 16', 'Conductor · confirmación **#768331** · devolver lun 16 en SJD antes de 09:30', `**Producción general**\n${SETUP}`, '- **Meta · Puerto Los Cabos** · dom 01:00 → 14:00 (+1 por confirmar)'),
    P('Pablo', '', F_CABO, '- Airbnb La Paz · Hab. 3 · mié 11 → dom 15\n- Cabo dom 15: por confirmar', 'Conductor · confirmación **#768323** · devolver lun 16 en SJD antes de 09:30', `**Música / DJ**\n${SETUP}`, '- **CP2 · San Bartolo** · sáb 18:00 → dom 00:00 (+1 por confirmar)'),
    P('José', '', F_CABO, '- Airbnb La Paz · Hab. 3 · mié 11 → dom 15\n- Cabo dom 15: por confirmar', '', `**Catering**\n${SETUP}`, '- **CP1 · Los Planes** · sáb 15:00 → 19:00\n- **CP3 · Cabo Pulmo** · sáb 21:00 → dom 07:00\n\nDos turnos con 2 h entre ellos: descansa antes y no manejes solo.'),
    P('Zari', '', F_LAP, '- Courtyard La Paz · Hab. 1 · jue 12 → sáb 14\n- Laiva Cabo · Sofá · sáb 14 → mar 17', '', `**Merch shop**\n${SETUP}`, '- **CP1 · Los Planes** · sáb 15:00 → 19:00\n- **CP3 · Cabo Pulmo** · sáb 21:00 → dom 07:00\n\nDos turnos con 2 h entre ellos: descansa antes y no manejes solo.'),
    P('Arturo', '', F_LAP, '- La Paz: por confirmar\n- Cabo: por confirmar', '', `**Música / DJ**\n${SETUP}`, 'Por confirmar'),
    P('Pam', 'Nike', F_LAP, '- Courtyard La Paz · Hab. 2 · jue 12 → sáb 14\n- Cabo: por confirmar', '', `**Con Nike**\n${NIKE_AM}`, '- Auto Nike de persecución, con Ale'),
    P('Nitza', '', F_LAP, '- Courtyard La Paz · Hab. 2 · jue 12 → sáb 14\n- Laiva Cabo · King 2 · sáb 14 → mar 17', '', `**Producción general**\n${SETUP}`, 'Por confirmar'),
    P('Choco', '', F_LAP, '- Airbnb La Paz · Hab. 2 · jue 12 → dom 15\n- Cabo dom 15 y lun 16: por confirmar', '', `**Check-in equipos**\n${SETUP}`, '- **CP4 · La Fortuna** · sáb 23:00 → dom 11:00, con Chris'),
    P('Ale', 'Nike', 'Jue 12 → La Paz · Lun 16 regreso (Nike, por confirmar)', '- Courtyard La Paz · Hab. 3 · jue 12 → sáb 14\n- Laiva Cabo · King 1 · sáb 14 → lun 16', '', `**Merch shop**\n${NIKE_AM}`, '- Auto Nike de persecución, con Pam'),
    P('Ren', 'Nike', 'Jue 12 → La Paz · Lun 16 regreso (Nike, por confirmar)', '- Courtyard La Paz · Hab. 3 · jue 12 → sáb 14\n- Laiva Cabo · King 1 · sáb 14 → lun 16', '', `**Check-in equipos**\n${NIKE_AM}`, '- Auto de Abe (corredor solo Nike)'),
    P('Oscar', '', 'Regreso mar 17 / mié 18 (por confirmar)', '- Airbnb La Paz · Inflable · mié 11 → dom 15\n- Cabo: por confirmar', '', `**Check-in equipos**\n${SETUP}`, '- **Salida · Malecón de La Paz** · sáb 12:00 → 14:30, con Benítez'),
    P('Benítez', '', 'Regreso mar 17 / mié 18 (por confirmar)', '- Airbnb La Paz · Sillón · mié 11 → dom 15\n- Cabo: por confirmar', '', `**Catering**\n${SETUP}`, '- **Salida · Malecón de La Paz** · sáb 12:00 → 14:30, con Oscar'),
  ],
  sections: [
    { title: 'Agenda', body: [
      '**Miércoles 11**',
      '- 15:00 · Chris, Eren, Pablo y José vuelan TLC → SJD (hora CDMX)',
      '- 16:06 · Llegada a SJD, recoger los 3 autos y manejar a La Paz (unas 2 h)',
      '- Noche · Check-in Airbnb La Paz; Eren al Courtyard',
      '',
      '**Jueves 12**',
      '- 15:22 · Zari, Arturo, Pam, Nitza y Choco vuelan AIFA → LAP (hora CDMX)',
      '- 16:39 · Llegada a La Paz · Ale y Ren (Nike) llegan a La Paz',
      '- 17:00 · Hike Balandra para corredores (opcional)',
      '',
      '**Viernes 13 · Basecamp**',
      '- 05:30 · Salida de La Paz al basecamp',
      '- 06:00 · Montaje · 15:00 abren puertas · 15:30 entrega de kits',
      '- 16:30 · **Salida Solo Runners**',
      '- 17:00 · Junta de corredores · 18:30 cierre',
      '',
      '**Sábado 14 · Carrera**',
      '- Mañana · Check-out Courtyard · check-in Laiva (Cabo)',
      '- 12:00 · Staff de salida en el Malecón de La Paz',
      '- 14:00 · **Salida Teams**',
      '- Noche · Checkpoints en ruta',
      '',
      '**Domingo 15 · Meta**',
      '- 04:33 · Primeros Teams a meta (aprox., 4:00 min/km)',
      '- Check-out Airbnb La Paz',
      '- 11:00 · Ceremonia de medallas, Veleros Beach Club (por confirmar: la meta sigue abierta)',
      '',
      '**Lunes 16**',
      '- 09:30 · Devolver autos en SJD',
      '- 11:29 · Chris, Eren, Pablo y José vuelan SJD → TLC · Ale y Ren regresan',
      '',
      '**Martes 17**',
      '- 11:29 · Zari, Arturo, Pam, Nitza y Choco vuelan SJD → TLC',
    ].join('\n') },
    { title: 'Basecamp', body: [
      '**Viernes 13 · 06:00 – 18:30** · [Abrir ubicación en Maps](https://maps.app.goo.gl/Um2x28p3WxwdDtCRA) (24.233066, -110.204466)',
      'Ubicación secreta: a los corredores se les manda por WhatsApp. No la compartas.',
      '',
      '- 06:00 · Montaje con Vicente y su equipo: carpas, música, activación ACG',
      '- 14:00 · Fin de montaje · Pam, Ale y Ren llegan de Nike (14:30)',
      '- 15:00 · Abren puertas · 15:30 llegada de corredores y entrega de kits',
      '- 16:30 · Salida Solo Runners',
      '- 17:00 · Junta de corredores (brief: Rafa)',
      '- 18:30 · Cierre y desmontaje',
      '',
      '**Montaje 06:00:** Rafa, Chris, Eren, Pablo, José, Zari, Arturo, Nitza, Choco, Oscar, Benítez',
      '',
      '**Roles**',
      '- Producción general · Eren, Nitza',
      '- Check-in equipos · Ren, Oscar, Choco',
      '- Música / DJ · Pablo, Arturo',
      '- Catering · Chris, Benítez, José',
      '- Merch shop · Ale, Zari',
      '- Brief de carrera · Rafa',
    ].join('\n') },
    { title: 'Carrera', body: [
      'Ruta 2026 V2 · 218.2 km · [Ver en Strava](https://www.strava.com/routes/3555288480705899176)',
      '',
      '**Turnos del staff (Teams salen sáb 14:00)** · entre paréntesis, cuándo pasan los Teams de 4:00 a 7:00 min/km',
      '- Salida · Malecón de La Paz · sáb 12:00 → 14:30 · Oscar, Benítez',
      '- CP1 · Los Planes · km 38.7 · sáb 15:00 → 19:00 · José, Zari (16:35 → 18:31)',
      '- CP2 · San Bartolo · km 88.7 · sáb 18:00 → dom 00:00 · Pablo + 1 por confirmar (19:55 → 00:21)',
      '- CP3 · Cabo Pulmo · km 152.4 · sáb 21:00 → dom 07:00 · José, Zari (00:09 → 07:47)',
      '- CP4 · La Fortuna · km 191.4 · sáb 23:00 → dom 11:00 · Chris, Choco (02:46 → 12:20)',
      '- Meta · Puerto Los Cabos · km 218.2 · dom 01:00 → 14:00 · Eren + 1 por confirmar (04:33 → 15:27)',
      '',
      'Ojo: con los ritmos de 7:00 min/km, los últimos Teams pasan CP2, CP3, CP4 y Meta después de que termina el turno. Turnos por ajustar.',
      '',
      '**Solo Runners (salen vie 16:30)** · pasan de 6:00 a 9:00 min/km',
      '- CP1 · vie 20:22 → 22:18',
      '- CP2 · sáb 01:22 → 05:48',
      '- CP3 · sáb 07:44 → 15:21',
      '- CP4 · sáb 11:38 → 21:13',
      '- Meta · sáb 14:19 → dom 01:14',
      '',
      '**Autos en ruta**',
      '- Auto Nike de persecución · Pam, Ale',
      '- Auto de Abe (corredor solo Nike) · Ren',
      '',
      '**Brecha km 152–191 (Cabo Pulmo → La Fortuna): sin ambulancia, va la unidad de respuesta rápida**',
      '- Turno Solos · sáb 06:59 → 21:43',
      '- Turno Teams · sáb 23:24 → dom 12:50',
    ].join('\n') },
    { title: 'Vuelos', body: [
      'Todos con Volaris. Documenta con tu código de reservación.',
      '',
      '- **Mié 11** · TLC 15:00 → SJD 16:06 · Y4 550 · **TKUP9X** · Chris, Eren, Pablo, José',
      '- **Jue 12** · AIFA (NLU) 15:22 → LAP 16:39 · Y4 7170 · **AHCT8A** · Zari, Arturo, Pam, Nitza, Choco. Sale de AIFA, no de Toluca.',
      '- **Lun 16** · SJD 11:29 → TLC 14:25 · Y4 551 · **TKUP9X** · Chris, Eren, Pablo, José',
      '- **Mar 17** · SJD 11:29 → TLC 14:25 · Y4 551 · **QLJ73U** · Zari, Arturo, Pam, Nitza, Choco',
      '',
      'Por confirmar: Ale y Ren (Nike), Oscar y Benítez.',
    ].join('\n') },
    { title: 'Hospedaje', body: [
      '**Casa La Paz · Airbnb** · mié 11 → dom 15 · dirección y check-in por confirmar',
      '- Hab. 1 · Rafa',
      '- Hab. 2 · Chris, Choco',
      '- Hab. 3 · Pablo, José',
      '- Inflable · Oscar · Sillón · Benítez',
      '',
      '**Courtyard La Paz** · check-out sáb 14',
      '- Hab. 1 · Eren, Zari · 11–14',
      '- Hab. 2 · Pam, Nitza · 12–14',
      '- Hab. 3 · Ale, Ren · 12–14',
      '',
      '**Laiva Artwalk by Tasman · Cabo** · sáb 14 → mar 17 · confirmación **5859853759** · depto de 2 recámaras con balcón',
      '- King 1 · Ale, Ren',
      '- King 2 · Nitza, Eren',
      '- Sofá · Zari · Inflable · por confirmar',
      '',
      'Camas en Cabo por confirmar: Pam, Arturo, Chris, Pablo, José, Choco, Rafa, Oscar, Benítez.',
    ].join('\n') },
    { title: 'Autos', body: [
      'SUV grande · Chevrolet Captiva o similar · kilometraje ilimitado · 11 → 16 nov',
      '',
      '- Chris · **#768318**',
      '- Pablo · **#768323**',
      '- Eren · **#768331**',
      '',
      '- Recoger · mié 11, aeropuerto SJD, al aterrizar',
      '- Devolver · lun 16, SJD, **antes de las 09:30**',
      '- Las 3 reservas están a nombre de Rafael Rivero. Lleva tu licencia; los conductores adicionales se agregan en mostrador.',
    ].join('\n') },
    { title: 'Seguridad', body: [
      '**Emergencias: 911** · Director de Carrera: +52 55 4485 3425 · Director de Ruta: +52 55 3019 0790',
      '',
      '- Tanque lleno y baterías externas: en varios tramos no hay gasolineras ni señal.',
      '- Chaleco reflejante de noche, fuera del auto.',
      '- Buff o cubrebocas en las brechas por el polvo.',
      '- Agua, hielo y comida para tu turno completo.',
      '- Los relevos se hacen del lado derecho del camino. Rebasa con cuidado.',
      '- En la salida no hay baños ni estacionamiento dedicado.',
    ].join('\n') },
    { title: 'Pendientes', body: [
      '- Autorización de Protección Civil para la salida de Teams a las 14:00 del sábado.',
      '- Ceremonia de medallas (dom 11:00): la meta sigue abierta hasta las 15:27 con ritmos de 7:00.',
      '- Camas en Cabo y hospedaje de Arturo en La Paz.',
      '- Segunda persona en CP2 y en Meta.',
      '- Rol en carrera para Rafa, Arturo y Nitza.',
      '- Vuelos de Ale, Ren, Oscar y Benítez.',
      '- Ampliar turnos de checkpoint para los Teams de 7:00 min/km.',
    ].join('\n') },
  ],
};
