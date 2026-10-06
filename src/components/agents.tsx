'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useT } from './I18n';
import { Field, useToast, useCopy } from './ui';
import { saveListing, claimListing, closeListing, answerInvite, inviteAgent } from '@/app/actions/agents';
import { fmtHalf } from '@/lib/groups';

export type PublicAgent = {
  id: string; name: string; gender: string | null; half_avg_min: number | null; city: string | null; message: string | null;
  paid_claim: boolean; created_at: string;
};
export type MyAgent = PublicAgent & { email: string; phone: string | null; status: string; team_name: string | null };
export type MyInvite = { id: string; team_name: string; status: string };

const genderTxt = (g: string | null, t: (k: string) => string) => (g === 'F' ? t('female') : g === 'M' ? t('male') : g === 'X' ? t('nonbinary') : '');

function AgentCard({ a, children }: { a: PublicAgent; children?: React.ReactNode }) {
  const { t } = useT();
  return (
    <div className="card stack" style={{ gap: 8, padding: 16 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <b style={{ fontSize: 16 }}>{a.name}</b>
        {a.paid_claim && <span className="chip ok">{t('fa_paid')}</span>}
      </div>
      <div className="row" style={{ gap: 6 }}>
        {a.gender && <span className="chip plain">{genderTxt(a.gender, t)}</span>}
        {a.half_avg_min && <span className="chip plain num">21K · {fmtHalf(a.half_avg_min)}</span>}
        {a.city && <span className="chip plain">{a.city}</span>}
      </div>
      {a.message && <p className="muted" style={{ fontSize: 14, whiteSpace: 'pre-wrap' }}>{a.message}</p>}
      {children}
    </div>
  );
}

/* ---------- public board + my listing ---------- */
export function AgentsBoard({ raceId, agents, me, invites, link }: { raceId: string; agents: PublicAgent[]; me: MyAgent | null; invites: MyInvite[]; link: string | null }) {
  const { t } = useT();
  const router = useRouter();
  const toast = useToast();
  const copy = useCopy();
  const q = useSearchParams();
  const [editing, setEditing] = useState(!me);
  const [origin, setOrigin] = useState('');
  useEffect(() => setOrigin(window.location.origin), []);
  useEffect(() => {
    const k = q.get('k');
    if (k) claimListing(k).then(() => router.replace(`/r/${raceId}/agents`));
  }, [q, raceId, router]);
  const others = agents.filter((a) => a.id !== me?.id);
  const pending = invites.filter((i) => i.status === 'pending');
  const answer = async (id: string, accept: boolean) => {
    const r = await answerInvite(id, accept);
    if ('error' in r) return toast(t(r.error));
    if (accept) router.push(`/r/${raceId}/register`);
    else router.refresh();
  };
  return (
    <div className="stack">
      {me && !editing && (
        <div className="card stack">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h3 style={{ textTransform: 'uppercase' }}>{t('fa_mine')}</h3>
            <span className={'chip ' + (me.status === 'open' ? 'ok' : me.status === 'matched' ? 'info' : '')}>{t('fa_st_' + me.status)}</span>
          </div>
          {me.status === 'matched' && me.team_name && <p>{t('fa_joined')} <b>{me.team_name}</b>.</p>}
          {pending.length > 0 && (
            <div className="stack" style={{ gap: 8 }}>
              {pending.map((i) => (
                <div key={i.id} className="note row" style={{ justifyContent: 'space-between', background: 'var(--accent-soft)', color: 'var(--ink)' }}>
                  <span>{t('fa_invitedBy')} <b>{i.team_name}</b></span>
                  <span className="row">
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => answer(i.id, true)}>{t('fa_accept')}</button>
                    <button type="button" className="btn btn-sm" onClick={() => answer(i.id, false)}>{t('fa_decline')}</button>
                  </span>
                </div>
              ))}
            </div>
          )}
          {me.status === 'open' && !pending.length && <p className="muted" style={{ fontSize: 14 }}>{t('fa_waiting')}</p>}
          {link && (
            <div>
              <div className="label">{t('fa_privateLink')}</div>
              <div className="row" style={{ marginTop: 4 }}><span className="code" style={{ overflowWrap: 'anywhere', fontSize: 12 }}>{origin + link}</span>
                <button type="button" className="btn btn-sm" onClick={() => copy(window.location.origin + link)}>{t('copy')}</button></div>
              <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>{t('fa_privateLinkSub')}</p>
            </div>
          )}
          <div className="row">
            <button type="button" className="btn btn-sm" onClick={() => setEditing(true)}>{t('edit')}</button>
            {me.status === 'open' && <button type="button" className="btn btn-ghost btn-sm" onClick={async () => { await closeListing(); router.refresh(); }}>{t('fa_close')}</button>}
          </div>
        </div>
      )}
      {editing && <AgentForm raceId={raceId} me={me} onDone={() => { setEditing(false); router.refresh(); }} onCancel={me ? () => setEditing(false) : undefined} />}
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2>{t('fa_board')}</h2><span className="muted num">{others.length}</span>
      </div>
      <p className="muted" style={{ fontSize: 14, marginTop: -8 }}>{t('fa_boardSub')}</p>
      {others.length ? <div className="race-grid">{others.map((a) => <AgentCard key={a.id} a={a} />)}</div> : <div className="card empty">{t('fa_empty')}</div>}
    </div>
  );
}

function AgentForm({ raceId, me, onDone, onCancel }: { raceId: string; me: MyAgent | null; onDone: () => void; onCancel?: () => void }) {
  const { t } = useT();
  const toast = useToast();
  const [f, setF] = useState({
    name: me?.name || '', email: me?.email || '', phone: me?.phone || '', gender: me?.gender || '', half: me?.half_avg_min ? fmtHalf(me.half_avg_min) : '',
    city: me?.city || '', message: me?.message || '', paid_claim: !!me?.paid_claim,
  });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    const r = await saveListing(raceId, f);
    setBusy(false);
    if ('error' in r) return setErr(r.error);
    toast(t('saved'));
    onDone();
  };
  return (
    <div className="card">
      <h2 style={{ marginBottom: 6 }}>{t('fa_announce')}</h2>
      <p className="muted" style={{ fontSize: 14, marginBottom: 14 }}>{t('fa_announceSub')}</p>
      <form className="form" onSubmit={submit}>
        <Field id="fa-name" label={t('name')} value={f.name} onChange={set('name')} req />
        <Field id="fa-gender" label={t('gender')} value={f.gender} onChange={set('gender')} options={[['', '—'], ['F', t('female')], ['M', t('male')], ['X', t('nonbinary')]]} />
        <Field id="fa-email" label={t('email')} type="email" value={f.email} onChange={set('email')} req />
        <Field id="fa-phone" label={t('phone')} type="tel" value={f.phone} onChange={set('phone')} req />
        <Field id="fa-half" label={t('fa_half')} value={f.half} onChange={set('half')} placeholder="1:45" hint={t('fa_halfHint')} />
        <Field id="fa-city" label={t('fa_city')} value={f.city} onChange={set('city')} />
        <Field id="fa-msg" label={t('fa_message')} type="textarea" value={f.message} onChange={set('message')} full />
        <label className="check full"><input type="checkbox" checked={f.paid_claim} onChange={(e) => setF((x) => ({ ...x, paid_claim: e.target.checked }))} /> <span>{t('fa_paidClaim')}</span></label>
        <p className="muted full" style={{ fontSize: 12 }}>{t('fa_privacy')}</p>
        {err && <p className="err full">{t(err)}</p>}
        <div className="full row" style={{ justifyContent: 'flex-end' }}>
          {onCancel && <button type="button" className="btn" onClick={onCancel}>{t('cancel')}</button>}
          <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? <span className="spin" /> : me ? t('save') : t('fa_publish')}</button>
        </div>
      </form>
    </div>
  );
}

/* ---------- captain section ---------- */
export type CaptainAgent = PublicAgent & { email: string; phone: string | null; invited: boolean };
export function CaptainAgents({ agents, spotsLeft }: { agents: CaptainAgent[]; spotsLeft: number }) {
  const { t } = useT();
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  if (!agents.length) return null;
  const go = async (id: string) => {
    const r = await inviteAgent(id);
    if ('error' in r) return toast(t(r.error));
    toast(t('fa_invited')); router.refresh();
  };
  return (
    <div className="card stack">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div><h3 style={{ textTransform: 'uppercase' }}>{t('fa_title')} · {agents.length}</h3><p className="muted" style={{ fontSize: 14, marginTop: 4 }}>{t('fa_captainSub')}</p></div>
        <button type="button" className="btn btn-sm" onClick={() => setOpen(!open)}>{open ? t('cancel') : t('fa_see')}</button>
      </div>
      {open && (
        <div className="race-grid">
          {agents.map((a) => (
            <AgentCard key={a.id} a={a}>
              <div className="muted" style={{ fontSize: 13, overflowWrap: 'anywhere' }}>{a.email} · {a.phone}</div>
              {a.invited ? <span className="chip info" style={{ alignSelf: 'flex-start' }}>{t('fa_invitedChip')}</span>
                : <button type="button" className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-start' }} disabled={spotsLeft <= 0} onClick={() => go(a.id)}>{t('fa_invite')}</button>}
            </AgentCard>
          ))}
        </div>
      )}
    </div>
  );
}
