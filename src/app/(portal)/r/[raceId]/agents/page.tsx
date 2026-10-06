import { Suspense } from 'react';
import { getT } from '@/lib/lang';
import { openAgents, getAgent, invitesOfAgent, type Agent } from '@/lib/agents';
import { getTeam } from '@/lib/repo';
import { getAgentId } from '@/lib/team-session';
import { myListingLink } from '@/app/actions/agents';
import { AgentsBoard, type PublicAgent } from '@/components/agents';
import { RaceHeader, Back, loadOpenRace, Closed } from '../../../shared';

// Public view: first name + last initial only; no email or phone.
const publicName = (n: string) => { const w = n.trim().split(/\s+/); return w.length > 1 ? `${w[0]} ${w[w.length - 1][0]}.` : w[0]; };
const toPublic = (a: Agent): PublicAgent => ({
  id: a.id, name: publicName(a.name), gender: a.gender, half_avg_min: a.half_avg_min, city: a.city, message: a.message, paid_claim: a.paid_claim, created_at: a.created_at,
});

export default async function AgentsPage({ params }: { params: { raceId: string } }) {
  const { t, lang } = getT();
  const res = await loadOpenRace(params.raceId);
  if ('closed' in res) return <Closed name={res.closed} />;
  const agents = (await openAgents(res.race.id)).map(toPublic);
  const myId = await getAgentId();
  const mine = myId ? await getAgent(myId) : null;
  const me = mine && mine.race_id === res.race.id ? mine : null;
  const invites = me ? (await invitesOfAgent(me.id)).map((i) => ({ id: i.id, team_name: i.team_name, status: i.status })) : [];
  const team = me?.team_id ? await getTeam(me.team_id) : null;
  return (
    <>
      <Back href={`/r/${params.raceId}`} />
      <RaceHeader race={res.race} lang={lang} />
      <div className="p-hero" style={{ marginTop: -8 }}>
        <h2>{t('fa_title')}</h2>
        <p className="muted" style={{ maxWidth: '60ch' }}>{t('fa_sub')}</p>
      </div>
      <Suspense>
        <AgentsBoard raceId={res.race.id} agents={agents}
          me={me ? { ...toPublic(me), name: me.name, email: me.email, phone: me.phone, status: me.status, team_name: team?.name || null } : null}
          invites={invites} link={me ? await myListingLink(res.race.id) : null} />
      </Suspense>
    </>
  );
}
