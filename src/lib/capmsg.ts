// Message that gives a captain their code: shared by the team drawer, the
// "Capitanes" tab and the CSV export so every channel says the same thing.
type Tr = (k: string) => string;
export function captainMessage(
  tr: Tr,
  team: { captain_name: string; name: string; claim_code: string },
  race: { id: string; name: string; slug: string | null; access_code: string | null },
  origin: string,
  forEmail = false,
) {
  const url = `${origin}/${race.slug || 'r/' + race.id}`;
  const first = (team.captain_name || '').trim().split(/\s+/)[0] || '';
  let body = tr('capMsg')
    .replace('{name}', first).replace('{race}', race.name).replace('{team}', team.name).replace('{url}', url)
    .replace('{pass}', race.access_code ? `\n${tr('capMsgPass')}: ${race.access_code}` : '').replace('{code}', team.claim_code);
  if (forEmail) body += '\n\n' + tr('capMsgSign');
  return { subject: `${race.name} · ${tr('captainCode')}: ${team.claim_code}`, body, url };
}
export const waLink = (phone: string | null | undefined, text: string) => {
  const d = (phone || '').replace(/\D/g, '');
  return d ? `https://wa.me/${d.length === 10 ? '52' + d : d}?text=${encodeURIComponent(text)}` : null;
};
export const mailLink = (email: string | null | undefined, subject: string, body: string) =>
  email ? `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}` : null;
