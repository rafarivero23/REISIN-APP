'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useT } from './I18n';
import { Field, PayChip, Bib, TestCheckout, useToast, useCopy } from './ui';
import { money, splitCats, brandPrefix, SIZES } from '@/lib/format';
import { fmtHalf } from '@/lib/groups';
import { LogoInput } from './LogoInput';
import {
  buyTeam, confirmTeam, captainLogin, captainLogout, setTeamPassword, captainPayRunner, captainPaySlots, confirmSlots, setTeamDetails, joinTeam, registerRunner,
  confirmRunner, retryRunnerPayment, captainRunnerDetails, captainUpdateRunner, captainRemoveRunner, captainStartRegister, captainUpdateContact, soloAcceptWaiver,
} from '@/app/actions/portal';

export type PublicRace = {
  id: string; name: string; brand: string; race_date: string | null; location: string | null; team_price: number;
  runner_fee: number; team_size: number; categories: string; waiver: string | null; teams_left: number; hold_slots: number; sizes: number[];
};
const Err = ({ k }: { k: string | null }) => { const { t } = useT(); return k ? <p className="err full">{t(k)}</p> : null; };

/* ---------------- buy a team ---------------- */
export function BuyForm({ race }: { race: PublicRace }) {
  const { t, lang } = useT();
  const router = useRouter();
  const cs = splitCats(race.categories);
  const hold = race.hold_slots > 0;
  const [f, setF] = useState({ name: '', category: cs[0] || '', captainName: '', captainEmail: '', captainPhone: '', teamSize: String(race.sizes[race.sizes.length - 1]), half: '' });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sim, setSim] = useState<{ teamId: string; payToken: string } | null>(null);
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!f.name || !f.captainName || !f.captainEmail || !f.captainPhone) return setErr('required');
    setBusy(true);
    const r = await buyTeam({ raceId: race.id, ...f, teamSize: Number(f.teamSize) });
    if ('error' in r) { setErr(r.error); setBusy(false); return; }
    if ('url' in r) { window.location.href = r.url; return; }
    if ('free' in r) { router.push(`/team-created?team=${r.teamId}`); return; }
    setSim({ teamId: r.teamId, payToken: r.payToken });
    setBusy(false);
  };
  return (
    <div className="card">
      <h2 style={{ marginBottom: 16 }}>{t('p_buy')}</h2>
      <form className="form" onSubmit={submit}>
        <Field id="b-name" label={t('p_teamName')} value={f.name} onChange={set('name')} req full />
        <Field id="b-cat" label={t('category')} value={f.category} onChange={set('category')} options={cs.length ? cs : ['—']} />
        <Field id="b-cname" label={t('p_captainName')} value={f.captainName} onChange={set('captainName')} req />
        <Field id="b-cemail" label={t('email')} type="email" value={f.captainEmail} onChange={set('captainEmail')} req />
        <Field id="b-cphone" label={t('phone')} type="tel" value={f.captainPhone} onChange={set('captainPhone')} req />
        <Field id="b-half" label={t('halfAvg')} value={f.half} onChange={set('half')} placeholder="1:45" hint={t('halfHint')} />
        {race.sizes.length > 1 && <Field id="b-size" label={t('p_sizePick')} value={f.teamSize} onChange={set('teamSize')} options={race.sizes.map((n) => [String(n), `${n} ${t('runners').toLowerCase()}`])} />}
        <div className="full note">
          {hold
            ? t('p_holdNote').replace('{n}', String(race.hold_slots)).replace('{m}', String(Math.max(0, Number(f.teamSize) - race.hold_slots)))
                .replace('{x}', `${money(race.runner_fee, lang)} c/u`)
            : <>{t('teamSize')}: <b className="num">{race.team_size}</b> · {t('runnerFee')}: <b className="num">{race.runner_fee > 0 ? money(race.runner_fee, lang) : t('p_included')}</b></>}
        </div>
        <Err k={err} />
        <div className="full row" style={{ justifyContent: 'space-between' }}>
          <b className="num" style={{ fontFamily: 'var(--f-display)', fontSize: 28 }}>{money(race.team_price, lang)}</b>
          <button className="btn btn-primary btn-lg" type="submit" disabled={busy || race.teams_left <= 0}>
            {busy ? <><span className="spin" /> {t('p_redirect')}</> : `${t('p_continuePay')} →`}
          </button>
        </div>
      </form>
      {sim && (
        <TestCheckout amount={race.team_price} concept={`${t('team')} · ${f.name} · ${race.name}`} email={f.captainEmail}
          onClose={() => setSim(null)}
          onPay={async () => {
            const r = await confirmTeam({ teamId: sim.teamId, payToken: sim.payToken });
            if ('error' in r) throw new Error(t(r.error));
            router.push(`/team-created?team=${sim.teamId}`);
          }} />
      )}
    </div>
  );
}

/* ---------------- team created: code + password ---------------- */
export function TeamCreated() {
  const { t } = useT();
  const router = useRouter();
  const copy = useCopy();
  const q = useSearchParams();
  const teamId = q.get('team') || '', sessionId = q.get('session_id') || undefined;
  const [s, setS] = useState<{ loading?: boolean; error?: string; code?: string }>({ loading: true });
  const [pw, setPw] = useState('');
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    confirmTeam({ teamId, sessionId }).then((r) => setS('error' in r ? { error: r.error } : { code: r.claimCode }));
  }, [teamId, sessionId]);
  if (s.loading) return <p className="muted">{t('p_confirming')}</p>;
  if (s.error) return <div className="banner">{t(s.error)}</div>;
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 4) return setErr('p_passMin');
    const r = await setTeamPassword(pw);
    if ('error' in r) return setErr(r.error);
    router.push('/captain');
  };
  return (
    <div className="card stack">
      <div className="chip ok" style={{ alignSelf: 'flex-start' }}>{t('p_paidOk')}</div>
      <div>
        <div className="label">{t('p_codeIs')}</div>
        <div className="row" style={{ marginTop: 6 }}>
          <span className="code" style={{ fontSize: 22 }}>{s.code}</span>
          <button type="button" className="btn btn-sm" onClick={() => copy(s.code!)}>{t('copy')}</button>
        </div>
        <p className="muted" style={{ fontSize: 14, marginTop: 6 }}>{t('p_codeKeep')}</p>
      </div>
      <form className="stack" style={{ gap: 12 }} onSubmit={save}>
        <h2>{t('p_setPass')}</h2>
        <p className="muted">{t('p_setPassSub')}</p>
        <Field id="sp-pass" label={t('p_password')} value={pw} onChange={setPw} req autoComplete="off" minLength={4} />
        <Err k={err} />
        <div><button className="btn btn-primary btn-lg" type="submit">{t('p_saveContinue')}</button></div>
      </form>
    </div>
  );
}

/* ---------------- captain sign-in ---------------- */
export function CaptainLoginForm({ raceId, brand, solo }: { raceId: string; brand: string; solo?: boolean }) {
  const { t } = useT();
  const router = useRouter();
  const [code, setCode] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await captainLogin({ raceId, code });
    if ('error' in r) return setErr(r.error);
    router.push('/captain');
  };
  return (
    <div className="card">
      <form className="stack" style={{ gap: 12 }} onSubmit={submit}>
        <h2>{t(solo ? 'so_enterCode' : 'p_enterCode')}</h2>
        {solo && <p className="muted" style={{ fontSize: 14, marginTop: -4 }}>{t('so_enterSub')}</p>}
        <Field id="cl-code" label={t(solo ? 'so_code' : 'captainCode')} value={code} onChange={setCode} req autoComplete="off" placeholder={brandPrefix(brand) + '-XXXXX'} style={{ textTransform: 'uppercase' }} />
        <Err k={err} />
        <div><button className="btn btn-primary btn-lg" type="submit">{t('p_enter')}</button></div>
      </form>
      <p className="muted" style={{ fontSize: 13, marginTop: 12 }}>{t('p_noCode')}</p>
    </div>
  );
}

/* ---------------- solo runner dashboard ---------------- */
export function SoloDash({ name, raceName, raceId, code, runner, waiverText }: {
  name: string; raceName: string; raceId: string; code: string; waiverText: string;
  runner: { id: string; bib: number | null; first_name: string; last_name: string; shirt_size: string | null; waiver: boolean } | null;
}) {
  const { t } = useT();
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const start = async () => {
    const r = await captainStartRegister();
    if ('error' in r) return toast(t(r.error));
    router.push(`/r/${r.raceId}/register`);
  };
  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <Link className="p-back" href={`/r/${raceId}`}>← {raceName}</Link>
        <button type="button" className="p-back" onClick={async () => { await captainLogout(); router.push(`/r/${raceId}`); }}>{t('p_exit')}</button>
      </div>
      <div className="p-hero">
        <div className="label">{t('so_title')} · {raceName}</div>
        <h1>{name}</h1>
        <div className="row"><span className="chip ok">{t('paid')}</span><span className="code">{code}</span></div>
      </div>
      {!runner ? (
        <div className="card stack">
          <h3>{t('so_finish')}</h3>
          <p className="muted" style={{ fontSize: 14 }}>{t('so_finishSub')}</p>
          <div><button type="button" className="btn btn-primary btn-lg" onClick={start}>{t('so_finishBtn')} →</button></div>
        </div>
      ) : (
        <div className="card stack">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="row"><Bib n={runner.bib} big /><div><b style={{ fontSize: 18 }}>{runner.first_name} {runner.last_name}</b>
              <div className="muted" style={{ fontSize: 14 }}>{t('shirt')}: {runner.shirt_size || '—'}</div></div></div>
            <div className="row" style={{ gap: 6 }}>
              {runner.waiver ? <span className="chip ok">{t('regComplete')}</span> : <span className="chip warn">{t('reg_waiverMissing')}</span>}
              <button type="button" className="btn btn-sm" aria-expanded={editing} onClick={() => setEditing(!editing)}>{editing ? t('cancel') : t('p_editRunner')}</button>
            </div>
          </div>
          {editing && <RunnerEditor runnerId={runner.id} name={runner.first_name} noRemove onDone={() => { setEditing(false); router.refresh(); }} />}
          {!runner.waiver && <SoloWaiver runnerId={runner.id} text={waiverText} />}
        </div>
      )}
    </>
  );
}

function SoloWaiver({ runnerId, text }: { runnerId: string; text: string }) {
  const { t } = useT();
  const router = useRouter();
  const toast = useToast();
  const [ok, setOk] = useState(false);
  return (
    <div className="stack" style={{ gap: 10, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
      <b>{t('waiver')}</b>
      <div className="note" style={{ whiteSpace: 'pre-wrap', maxHeight: 220, overflow: 'auto', color: 'var(--ink)' }}>{text}</div>
      <label className="check"><input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} /> <span>{t('p_waiverAccept')}</span></label>
      <div><button type="button" className="btn btn-primary" disabled={!ok} onClick={async () => { const r = await soloAcceptWaiver(runnerId); if ('error' in r) return toast(t(r.error)); toast(t('saved')); router.refresh(); }}>{t('save')}</button></div>
    </div>
  );
}

/* ---------------- captain dashboard ---------------- */
type DashRunner = { id: string; bib: number | null; first_name: string; last_name: string; shirt_size: string | null; fee: number; payment_status: string };
export function CaptainDash({ team, race, runners, slots }: {
  team: { name: string; category: string | null; payment_status: string; claim_code: string; has_password: boolean; half_avg_min: number | null; logo: string | null;
    captain_name: string; captain_email: string; captain_phone: string | null };
  race: { id: string; name: string; team_size: number; runner_fee: number; sizes: number[] }; runners: DashRunner[];
  slots: { hold: boolean; size: number; paid: number };
}) {
  const { t, lang } = useT();
  const router = useRouter();
  const toast = useToast();
  const copy = useCopy();
  const q = useSearchParams();
  const [pw, setPw] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [sim, setSim] = useState<{ runner: DashRunner; payToken: string } | null>(null);
  const [link, setLink] = useState(`/r/${race.id}/join`);
  useEffect(() => setLink(`${window.location.origin}/r/${race.id}/join`), [race.id]);
  const left = Math.max(0, slots.size - slots.paid);
  const [qty, setQty] = useState(String(left || 1));
  useEffect(() => setQty(String(left || 1)), [left]);
  useEffect(() => {
    const paid = q.get('paid'), sid = q.get('session_id'), sl = q.get('slots');
    if (paid && sid) confirmRunner({ runnerId: paid, sessionId: sid }).then(() => router.replace('/captain'));
    if (sl && sid) confirmSlots({ sessionId: sid }).then(() => router.replace('/captain'));
  }, [q, router]);
  const paySlots = async () => {
    const res = await captainPaySlots(Number(qty));
    if ('error' in res) return toast(t(res.error));
    if ('url' in res) { window.location.href = res.url; return; }
    setSimSlots(res.payToken);
  };
  const [simSlots, setSimSlots] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const addRunner = async () => {
    const r = await captainStartRegister();
    if ('error' in r) return toast(t(r.error));
    router.push(`/r/${r.raceId}/register`);
  };
  const [half, setHalf] = useState(team.half_avg_min ? fmtHalf(team.half_avg_min) : '');
  const [nm, setNm] = useState({ name: team.name, size: String(slots.size) });
  const minSize = Math.max(runners.length, slots.paid);
  const saveName = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await setTeamDetails({ name: nm.name, size: Number(nm.size) });
    if ('error' in r) return toast(t(r.error));
    toast(t('saved')); router.refresh();
  };
  const saveHalf = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await setTeamDetails({ half });
    if ('error' in r) return toast(t(r.error));
    toast(t('saved')); router.refresh();
  };

  const savePw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 4) return setErr('p_passMin');
    const r = await setTeamPassword(pw);
    if ('error' in r) return setErr(r.error);
    setPw(''); setErr(null); toast(t('saved')); router.refresh();
  };
  const payFor = async (r: DashRunner) => {
    const res = await captainPayRunner(r.id);
    if ('error' in res) return toast(t(res.error));
    if ('url' in res) { window.location.href = res.url; return; }
    setSim({ runner: r, payToken: res.payToken });
  };
  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <Link className="p-back" href={`/r/${race.id}`}>← {race.name}</Link>
        <button type="button" className="btn btn-ghost btn-sm" onClick={async () => { await captainLogout(); router.push('/'); }}>{t('p_exit')}</button>
      </div>
      <div className="p-hero">
        <div className="label">{t('p_teamDash')} · {race.name}</div>
        <h1>{team.name}</h1>
        <div className="row"><PayChip status={team.payment_status} />{team.category && <span className="chip plain">{team.category}</span>}<span className="chip plain num">{runners.length}/{slots.size}</span></div>
      </div>
      <div className="slots" aria-label={`${runners.length}/${slots.size}`}>
        {Array.from({ length: slots.size }, (_, i) => <span key={i} className={'slot' + (i < runners.length ? ' f' : '')} style={slots.hold && i >= slots.paid ? { opacity: 0.45 } : undefined} />)}
      </div>
      {slots.hold && team.payment_status === 'paid' && (
        <div className="card row" style={{ justifyContent: 'space-between' }}>
          <div>
            <div className="label">{t('p_slotsPaid')}</div>
            <b className="num" style={{ fontFamily: 'var(--f-display)', fontSize: 26 }}>{slots.paid}/{slots.size}</b>
            {left > 0 && <div className="muted num" style={{ fontSize: 14 }}>{t('p_balanceDue')}: {money(left * race.runner_fee, lang)}</div>}
          </div>
          {left > 0 && (
            <div className="row" style={{ alignItems: 'flex-end' }}>
              <Field id="ps-qty" label={t('slotsWord')} value={qty} onChange={setQty} options={Array.from({ length: left }, (_, i) => String(i + 1))} />
              <button type="button" className="btn btn-primary" onClick={paySlots}>{t('p_paySlots')} · {money(Number(qty) * race.runner_fee, lang)}</button>
            </div>
          )}
        </div>
      )}
      <div className="card stack">
        <h3 style={{ textTransform: 'uppercase' }}>{t('p_shareTitle')}</h3>
        <p className="muted" style={{ fontSize: 14 }}>{t('p_shareText')}</p>
        <div className="row"><span className="code" style={{ overflowWrap: 'anywhere' }}>{link}</span><button type="button" className="btn btn-sm" onClick={() => copy(link)}>{t('copy')}</button></div>
        <dl className="kv">
          <dt>{t('captainCode')}</dt><dd><span className="code">{team.claim_code}</span></dd>
          <dt>{t('teamPassword')}</dt><dd>{team.has_password ? <span className="chip ok">{t('set')}</span> : <span className="chip warn">{t('notSet')}</span>}</dd>
        </dl>
        <form className="row" style={{ alignItems: 'flex-end' }} onSubmit={savePw}>
          <Field id="cp-pass" label={team.has_password ? t('p_changePass') : t('p_setPass')} value={pw} onChange={setPw} autoComplete="off" minLength={4} />
          <button className="btn btn-sm" type="submit">{t('save')}</button>
        </form>
        <Err k={err} />
      </div>
      <div className="card stack">
        <h3 style={{ textTransform: 'uppercase' }}>{t('p_teamDash')}</h3>
        <form className="stack" style={{ gap: 8 }} onSubmit={saveName}>
          <div className="row" style={{ alignItems: 'flex-end' }}>
            <Field id="cd-name" label={t('p_teamNameEdit')} value={nm.name} onChange={(v) => setNm((x) => ({ ...x, name: v }))} req maxLength={80} />
            {race.sizes.length > 1 && (
              <Field id="cd-size" label={t('p_teamSizeEdit')} value={nm.size} onChange={(v) => setNm((x) => ({ ...x, size: v }))}
                options={race.sizes.filter((n) => n >= minSize || String(n) === nm.size).map((n) => [String(n), `${n} ${t('runners').toLowerCase()}`])} />
            )}
            <button className="btn btn-sm btn-primary" type="submit" disabled={!nm.name.trim() || (nm.name === team.name && nm.size === String(slots.size))}>{t('save')}</button>
          </div>
          {race.sizes.length > 1 && (
            <p className="muted" style={{ fontSize: 13 }}>
              {t('p_sizeHelp').replace('{min}', String(minSize))}
              {slots.hold && Number(nm.size) > slots.paid && <> {t('p_sizeCost').replace('{n}', String(Number(nm.size) - slots.paid)).replace('{x}', money((Number(nm.size) - slots.paid) * race.runner_fee, lang))}</>}
            </p>
          )}
        </form>
        <LogoInput current={team.logo} onChange={async (d) => { const r = await setTeamDetails({ logo: d }); if ('error' in r) toast(t(r.error)); else { toast(t('saved')); router.refresh(); } }} />
        <form className="row" style={{ alignItems: 'flex-end' }} onSubmit={saveHalf}>
          <Field id="cd-half" label={t('halfAvg')} value={half} onChange={setHalf} placeholder="1:45" hint={t('halfHint')} />
          <button className="btn btn-sm" type="submit">{t('save')}</button>
        </form>
        <CaptainContact team={team} />
      </div>
      <div className="card stack" style={{ gap: 10 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h3 style={{ textTransform: 'uppercase' }}>{t('p_roster')} · <span className="num">{runners.length}/{slots.size}</span></h3>
          {runners.length < slots.size && <button type="button" className="btn btn-sm btn-primary" onClick={addRunner}>+ {t('p_addRunner')}</button>}
        </div>
        {runners.length < slots.size && <p className="muted" style={{ fontSize: 13 }}>{t('p_addRunnerSub')}</p>}
        {runners.length ? (
          <div className="list">
            {runners.map((y) => (
              <div key={y.id} style={{ borderBottom: '1px solid var(--line)', padding: '10px 0' }}>
                <div className="it" style={{ border: 0, padding: 0 }}>
                  <div className="row"><Bib n={y.bib} /><div><b>{y.first_name} {y.last_name}</b><div className="muted" style={{ fontSize: 13 }}>{t('shirt')}: {y.shirt_size || '—'}</div></div></div>
                  <div className="row" style={{ gap: 6 }}>
                    {!slots.hold && y.fee > 0 && y.payment_status !== 'paid'
                      ? <button type="button" className="btn btn-sm btn-primary" onClick={() => payFor(y)}>{t('p_payFor')} · {money(y.fee, lang)}</button>
                      : y.fee > 0 ? <PayChip status="paid" /> : null}
                    <button type="button" className="btn btn-sm" aria-expanded={editing === y.id} onClick={() => setEditing(editing === y.id ? null : y.id)}>{editing === y.id ? t('cancel') : t('edit')}</button>
                  </div>
                </div>
                {editing === y.id && <RunnerEditor runnerId={y.id} name={`${y.first_name} ${y.last_name}`} onDone={() => { setEditing(null); router.refresh(); }} />}
              </div>
            ))}
          </div>
        ) : <p className="muted">{t('p_rosterEmpty')}</p>}
      </div>
      {sim && (
        <TestCheckout amount={sim.runner.fee} concept={`${t('p_feeDue')} · ${sim.runner.first_name} ${sim.runner.last_name}`}
          onClose={() => setSim(null)}
          onPay={async () => { await confirmRunner({ runnerId: sim.runner.id, payToken: sim.payToken }); setSim(null); toast(t('p_paidOk')); router.refresh(); }} />
      )}
      {simSlots && (
        <TestCheckout amount={Number(qty) * race.runner_fee} concept={`${qty} ${t('slotsWord')} · ${team.name}`}
          onClose={() => setSimSlots(null)}
          onPay={async () => { await confirmSlots({ payToken: simSlots }); setSimSlots(null); toast(t('p_paidOk')); router.refresh(); }} />
      )}
    </>
  );
}

/* ---------------- runner: join ---------------- */
export function JoinForm({ raceId, teamSize, teams }: { raceId: string; teamSize: number; teams: { id: string; name: string; category: string | null; members: number }[] }) {
  const { t } = useT();
  const router = useRouter();
  const [teamId, setTeamId] = useState<string | null>(null);
  const [pw, setPw] = useState('');
  const [search, setSearch] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const shown = teams.filter((x) => !search || x.name.toLowerCase().includes(search.toLowerCase()));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamId || !pw) return setErr('required');
    const r = await joinTeam({ raceId, teamId, password: pw });
    if ('error' in r) return setErr(r.error);
    router.push(`/r/${raceId}/register`);
  };
  return (
    <div className="card">
      <form className="stack" style={{ gap: 14 }} onSubmit={submit}>
        <h2>{t('p_selectTeam')}</h2>
        {teams.length ? (
          <>
            <input className="search" type="search" placeholder={t('search')} value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: '100%' }} aria-label={t('search')} />
            <div className="team-pick" role="radiogroup">
              {shown.map((x) => (
                <label key={x.id}>
                  <input type="radio" name="team" value={x.id} checked={teamId === x.id} onChange={() => setTeamId(x.id)} />
                  <span style={{ flex: 1 }}><b>{x.name}</b><span className="muted" style={{ fontSize: 13, display: 'block' }}>{x.category}</span></span>
                  <span className="chip plain num">{x.members}/{teamSize}</span>
                </label>
              ))}
            </div>
          </>
        ) : <p className="muted">{t('noTeams')}</p>}
        <Field id="j-pass" label={t('p_password')} type="password" value={pw} onChange={setPw} req autoComplete="off" />
        <Err k={err} />
        <div><button className="btn btn-primary btn-lg" type="submit">{t('p_enter')}</button></div>
      </form>
    </div>
  );
}

/* ---------------- runner: registration form ---------------- */
export type RunnerForm = { first_name: string; last_name: string; email: string; phone: string; birth_date: string; gender: string; shirt_size: string; emergency_name: string; emergency_phone: string };
export const EMPTY_RUNNER: RunnerForm = { first_name: '', last_name: '', email: '', phone: '', birth_date: '', gender: '', shirt_size: '', emergency_name: '', emergency_phone: '' };

function RunnerEditor({ runnerId, name, onDone, noRemove }: { runnerId: string; name: string; onDone: () => void; noRemove?: boolean }) {
  const { t } = useT();
  const toast = useToast();
  const [f, setF] = useState<RunnerForm | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { captainRunnerDetails(runnerId).then((r) => ('error' in r ? setErr(r.error) : setF(r.runner as RunnerForm))); }, [runnerId]);
  const set = (k: keyof RunnerForm) => (v: string) => setF((x) => (x ? { ...x, [k]: v } : x));
  if (!f) return err ? <Err k={err} /> : <div style={{ padding: 12 }}><span className="spin" /></div>;
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    const r = await captainUpdateRunner(runnerId, f);
    setBusy(false);
    if ('error' in r) return setErr(r.error);
    toast(t('p_runnerSaved')); onDone();
  };
  const remove = async () => {
    if (!confirm(t('p_removeConfirm').replace('{n}', name))) return;
    const r = await captainRemoveRunner(runnerId);
    if ('error' in r) return setErr(r.error);
    toast(t('deleted')); onDone();
  };
  return (
    <form className="form" onSubmit={save} style={{ marginTop: 12, padding: 14, background: 'var(--surface-2)', borderRadius: 10 }}>
      <RunnerFields f={f} set={set} />
      <Err k={err} />
      <div className="full row" style={{ justifyContent: 'space-between' }}>
        {noRemove ? <span /> : <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--bad)' }} onClick={remove}>{t('p_removeRunner')}</button>}
        <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? <span className="spin" /> : t('save')}</button>
      </div>
    </form>
  );
}

function CaptainContact({ team }: { team: { captain_name: string; captain_email: string; captain_phone: string | null } }) {
  const { t } = useT();
  const toast = useToast();
  const router = useRouter();
  const init = { name: team.captain_name, email: team.captain_email, phone: team.captain_phone || '' };
  const [f, setF] = useState(init);
  const [err, setErr] = useState<string | null>(null);
  const dirty = JSON.stringify(f) !== JSON.stringify(init);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await captainUpdateContact(f);
    if ('error' in r) return setErr(r.error);
    setErr(null); toast(t('saved')); router.refresh();
  };
  return (
    <form className="form" onSubmit={save} style={{ borderTop: '1px solid var(--line)', paddingTop: 14 }}>
      <div className="section-t" style={{ borderTop: 0, paddingTop: 0, marginTop: 0 }}>{t('p_captainInfo')}</div>
      <Field id="cc-name" label={t('p_captainName')} value={f.name} onChange={(v) => setF((x) => ({ ...x, name: v }))} req />
      <Field id="cc-email" label={t('email')} type="email" value={f.email} onChange={(v) => setF((x) => ({ ...x, email: v }))} req />
      <Field id="cc-phone" label={t('phone')} type="tel" value={f.phone} onChange={(v) => setF((x) => ({ ...x, phone: v }))} />
      <Err k={err} />
      <div className="full row" style={{ justifyContent: 'flex-end' }}><button className="btn btn-sm" type="submit" disabled={!dirty}>{t('save')}</button></div>
    </form>
  );
}

export function RunnerFields({ f, set }: { f: RunnerForm; set: (k: keyof RunnerForm) => (v: string) => void }) {
  const { t } = useT();
  return (
    <>
      <Field id="u-first" label={t('firstName')} value={f.first_name} onChange={set('first_name')} req />
      <Field id="u-last" label={t('lastName')} value={f.last_name} onChange={set('last_name')} req />
      <Field id="u-email" label={t('email')} type="email" value={f.email} onChange={set('email')} req />
      <Field id="u-phone" label={t('phone')} type="tel" value={f.phone} onChange={set('phone')} req />
      <Field id="u-birth" label={t('birth')} type="date" value={f.birth_date} onChange={set('birth_date')} req />
      <Field id="u-gender" label={t('gender')} value={f.gender} onChange={set('gender')} req options={[['', '—'], ['F', t('female')], ['M', t('male')], ['X', t('nonbinary')]]} />
      <Field id="u-shirt" label={t('shirt')} value={f.shirt_size} onChange={set('shirt_size')} req options={[['', '—'], ...SIZES]} />
      <div />
      <div className="section-t">{t('emergency')}</div>
      <Field id="u-ename" label={t('emergencyName')} value={f.emergency_name} onChange={set('emergency_name')} req />
      <Field id="u-ephone" label={t('emergencyPhone')} type="tel" value={f.emergency_phone} onChange={set('emergency_phone')} req />
    </>
  );
}

export function RegisterForm({ race, teamName, feeDue, prefill }: { race: PublicRace; teamName: string; feeDue: number; prefill?: Partial<RunnerForm> }) {
  const { t, lang } = useT();
  const router = useRouter();
  const [f, setF] = useState<RunnerForm>({ ...EMPTY_RUNNER, ...prefill });
  const [waiver, setWaiver] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sim, setSim] = useState<{ runnerId: string; payToken: string } | null>(null);
  const set = (k: keyof RunnerForm) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const fee = feeDue;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (Object.values(f).some((v) => !v)) return setErr('required');
    if (!waiver) return setErr('p_waiverAccept');
    setBusy(true);
    const r = await registerRunner({ raceId: race.id, runner: f, waiverAccepted: true, lang });
    if ('error' in r) { setErr(r.error); setBusy(false); return; }
    if ('url' in r) { window.location.href = r.url; return; }
    if ('payToken' in r) { setSim({ runnerId: r.runnerId, payToken: r.payToken }); setBusy(false); return; }
    router.push(`/done?runner=${r.runnerId}`);
  };
  return (
    <>
      <div className="p-hero"><div className="label">{race.name}</div><h1>{teamName}</h1></div>
      <div className="card">
        <form className="form" onSubmit={submit}>
          <RunnerFields f={f} set={set} />
          <div className="section-t">{t('waiver')}</div>
          <div className="full note" style={{ maxHeight: 160, overflowY: 'auto', whiteSpace: 'pre-wrap' }}>{race.waiver || t('w_default')}</div>
          <label className="check full"><input type="checkbox" checked={waiver} onChange={(e) => setWaiver(e.target.checked)} /> <span>{t('p_waiverAccept')}</span></label>
          <Err k={err} />
          <div className="full row" style={{ justifyContent: 'space-between' }}>
            <div><div className="label">{t('p_feeDue')}</div><b className="num" style={{ fontFamily: 'var(--f-display)', fontSize: 26 }}>{fee > 0 ? money(fee, lang) : race.hold_slots > 0 ? t('p_coveredFee') : t('p_included')}</b></div>
            <button className="btn btn-primary btn-lg" type="submit" disabled={busy}>{busy ? <span className="spin" /> : fee > 0 ? `${t('p_continuePay')} →` : t('p_register')}</button>
          </div>
        </form>
      </div>
      {sim && (
        <TestCheckout amount={fee} concept={`${t('p_feeDue')} · ${race.name}`} email={f.email}
          onClose={() => router.push(`/done?runner=${sim.runnerId}&canceled=1`)}
          onPay={async () => { await confirmRunner({ runnerId: sim.runnerId, payToken: sim.payToken }); router.push(`/done?runner=${sim.runnerId}`); }} />
      )}
    </>
  );
}

/* ---------------- runner: confirmation ---------------- */
type DoneRunner = { id: string; bib: number | null; first_name: string; last_name: string; fee: number; payment_status: string; team_name: string; race_id: string };
export function Done() {
  const { t, lang } = useT();
  const q = useSearchParams();
  const runnerId = q.get('runner') || '', sessionId = q.get('session_id') || undefined, canceled = q.get('canceled');
  const [s, setS] = useState<{ loading?: boolean; error?: string; runner?: DoneRunner }>({ loading: true });
  const [sim, setSim] = useState<string | null>(null);
  const load = () => confirmRunner({ runnerId, sessionId }).then((r) => setS('error' in r ? { error: r.error } : { runner: r.runner }));
  useEffect(() => { load(); }, [runnerId, sessionId]); // eslint-disable-line react-hooks/exhaustive-deps
  if (s.loading) return <p className="muted">{t('p_confirming')}</p>;
  if (s.error || !s.runner) return <div className="banner">{t(s.error || 'not_found')}</div>;
  const y = s.runner;
  const retry = async () => {
    const r = await retryRunnerPayment(y.id);
    if ('error' in r) return;
    if ('url' in r) window.location.href = r.url;
    else setSim(r.payToken);
  };
  return (
    <div className="card stack" style={{ alignItems: 'center', textAlign: 'center', padding: '36px 20px' }}>
      <h2>{t('p_youreIn')}</h2>
      <div className="label">{t('p_yourBib')}</div>
      <Bib n={y.bib} big />
      <p><b>{y.first_name} {y.last_name}</b> · {y.team_name}</p>
      {y.fee > 0 && <PayChip status={y.payment_status} />}
      {y.payment_status !== 'paid' && <p className="muted" style={{ maxWidth: '44ch' }}>{canceled ? t('p_canceled') : t('p_notPaid')}</p>}
      <div className="row" style={{ justifyContent: 'center' }}>
        {y.payment_status !== 'paid' && y.fee > 0 && <button type="button" className="btn btn-primary" onClick={retry}>{t('p_retryPay')} · {money(y.fee, lang)}</button>}
        <Link className="btn" href={`/r/${y.race_id}/register`}>{t('p_another')}</Link>
        <Link className="btn btn-ghost" href="/">{t('p_exit')}</Link>
      </div>
      {sim && (
        <TestCheckout amount={y.fee} concept={`${t('p_feeDue')} · ${y.first_name} ${y.last_name}`}
          onClose={() => setSim(null)}
          onPay={async () => { await confirmRunner({ runnerId: y.id, payToken: sim }); setSim(null); load(); }} />
      )}
    </div>
  );
}
