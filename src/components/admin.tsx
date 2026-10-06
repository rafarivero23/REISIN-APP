'use client';
import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useT } from './I18n';
import { Drawer, Field, PayChip, Bib, DeleteButton, useToast, useCopy } from './ui';
import { RunnerFields, type RunnerForm } from './portal';
import { money, fmtDate, fmtDT, splitCats, BRANDS } from '@/lib/format';
import { raceStats, teamSlots, isHold, regComplete } from '@/lib/stats';
import { parseGroups, groupFor, categoryOf, fmtHalf, type StartGroup } from '@/lib/groups';
import { LogoInput } from './LogoInput';
import { staffSetAgentStatus, staffAgentNotes, staffDeleteAgent } from '@/app/actions/agents';
import {
  saveRace, removeRace, saveTeam, teamMarkPaid, teamNewCode, teamClearPassword, removeTeam, saveRunner, runnerMarkPaid,
  removeRunner, addTeammate, removeTeammate, teamAddSlots, savePaymentNotes, saveRunnerNotes, setTeamLogoAdmin, saveGroups, setPaymentTeam, removePayment, importCsv, rematchPayments, changePassword,
} from '@/app/actions/admin';

/* Shapes passed from server components (no password hashes). */
export type ARace = {
  id: string; name: string; brand: string; status: string; race_date: string | null; location: string | null;
  team_price: number; runner_fee: number; team_size: number; capacity_teams: number; categories: string;
  bib_start: number; waiver: string | null; team_sizes: string; hold_slots: number; start_groups: string;
};
export type APayment = {
  id: string; team_id: string | null; runner_id: string | null; kind: string; source: string; external_id: string | null; quantity: number;
  amount: number; payer_name: string | null; payer_email: string | null; comment: string | null; paid_at: string; notes: string | null;
};
export const sizeList = (r: ARace) => {
  const xs = (r.team_sizes || '').split(',').map((x) => parseInt(x, 10)).filter((n) => n > 0);
  return xs.length ? xs : [r.team_size];
};
export type ATeam = {
  id: string; race_id: string; name: string; category: string | null; captain_name: string; captain_email: string;
  captain_phone: string | null; amount: number; payment_status: string; payment_method: string | null; paid_at: string | null;
  claim_code: string; has_password: boolean; created_at: string; team_size: number | null; extra_slots: number; notes: string | null;
  half_avg_min: number | null; reg_type: string; logo_v: string | null;
};
export type ARunner = {
  id: string; race_id: string; team_id: string; bib: number | null; first_name: string; last_name: string; email: string;
  phone: string | null; birth_date: string | null; gender: string | null; shirt_size: string | null; emergency_name: string | null;
  emergency_phone: string | null; waiver_accepted_at: string | null; fee: number; payment_status: string;
  payment_method: string | null; paid_at: string | null; created_at: string; notes: string | null;
};

export const genderLabel = (g: string | null, t: (k: string) => string) => (g === 'F' ? t('female') : g === 'M' ? t('male') : g === 'X' ? t('nonbinary') : '—');
const methodLabel = (m: string | null, t: (k: string) => string) => (m === 'stripe' ? 'Stripe' : m === 'test' ? t('stripeTest') : m === 'manual' ? t('manual') : m === 'ecwid' ? 'Ecwid' : m === 'team' ? t('team') : m === 'import' ? 'RedPodium' : '—');

function useAct() {
  const toast = useToast();
  const router = useRouter();
  const { t } = useT();
  const [pending, start] = useTransition();
  const act = async (fn: () => Promise<{ error?: string; id?: string }>, ok = 'saved') => {
    const r = await fn();
    if (r?.error) { toast(t(r.error)); return null; }
    toast(t(ok));
    start(() => router.refresh());
    return r;
  };
  return { act, pending };
}

export function GroupChip({ g }: { g: StartGroup | null }) {
  const { t } = useT();
  if (!g) return <span className="chip plain">{t('noGroup')}</span>;
  return <span className="chip plain" style={{ background: g.color, color: '#fff' }}>{t('group')} {g.label}</span>;
}
export function CatChip({ c }: { c: string | null }) {
  const { t } = useT();
  return c ? <span className={'chip plain cat-' + c}>{t(c)}</span> : <span className="muted">—</span>;
}
const logoSrc = (x: { id: string; logo_v: string | null }) => (x.logo_v ? `/api/logo/${x.id}?v=${x.logo_v}` : null);

// Inline note: click to edit, saves on blur or Enter. Empty shows a faint "+ nota".
function NoteCell({ value, onSave, wide }: { value: string | null; onSave: (v: string) => Promise<unknown>; wide?: boolean }) {
  const { t } = useT();
  const [edit, setEdit] = useState<string | null>(null);
  if (edit !== null) {
    const done = async () => { const v = edit.trim(); setEdit(null); if (v !== (value || '')) await onSave(v); };
    return <textarea autoFocus value={edit} onChange={(e) => setEdit(e.target.value)} onBlur={done}
      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); (e.target as HTMLTextAreaElement).blur(); } if (e.key === 'Escape') setEdit(null); }}
      rows={2} style={{ width: wide ? '100%' : 240, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--accent)', background: 'var(--surface)', font: 'inherit', fontSize: 13 }} />;
  }
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); setEdit(value || ''); }} title={t('notes')}
      style={{ all: 'unset', cursor: 'text', display: 'block', minWidth: 120, maxWidth: wide ? '100%' : 260, fontSize: 13, whiteSpace: 'pre-wrap', padding: '4px 6px', borderRadius: 6, background: value ? 'var(--warn-soft)' : 'transparent', color: value ? 'var(--ink)' : 'var(--muted)' }}>
      {value || `+ ${t('addNote')}`}
    </button>
  );
}

/* ---------------- nav ---------------- */
export function AdminNav({ races, mobile }: { races: { id: string; name: string }[]; mobile?: boolean }) {
  const { t } = useT();
  const path = usePathname();
  const cur = (href: string, exact = false) => (exact ? path === href : path.startsWith(href)) ? 'page' : undefined;
  return (
    <nav className="nav" aria-label={t('admin')}>
      <Link href="/admin" aria-current={cur('/admin', true)}>{t('home')}</Link>
      <Link href="/admin/races" aria-current={path === '/admin/races' ? 'page' : undefined}>{t('races')}</Link>
      {!mobile && races.map((r) => <Link key={r.id} className="sub" href={`/admin/races/${r.id}`} aria-current={cur(`/admin/races/${r.id}`)}>{r.name}</Link>)}
      <Link href="/admin/team" aria-current={cur('/admin/team')}>{t('staff')}</Link>
    </nav>
  );
}

/* ---------------- race form ---------------- */
export function NewRaceButton({ label, className = 'btn btn-primary' }: { label?: string; className?: string }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>+ {label || t('newRace')}</button>
      {open && <RaceForm onClose={() => setOpen(false)} />}
    </>
  );
}

export function RaceForm({ race, onClose }: { race?: ARace; onClose: () => void }) {
  const { t } = useT();
  const router = useRouter();
  const { act } = useAct();
  const [f, setF] = useState<Record<string, any>>(race || {
    name: '', brand: 'Sal a Valle', status: 'draft', race_date: '', location: '', team_price: 12000, runner_fee: 0,
    team_size: 6, capacity_teams: 50, categories: 'Varonil, Femenil, Mixto', bib_start: 100, waiver: t('w_default'), team_sizes: '', hold_slots: 0,
  });
  const set = (k: string) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await act(() => saveRace(race?.id || null, f));
    if (!r) return;
    onClose();
    if (!race && r.id) router.push(`/admin/races/${r.id}`);
  };
  return (
    <Drawer title={race ? race.name : t('newRace')} sub={t('races')} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <Field id="r-name" label={t('name')} value={f.name} onChange={set('name')} req full />
        <Field id="r-brand" label={t('brand')} value={f.brand} onChange={set('brand')} options={BRANDS} />
        <Field id="r-status" label={t('status')} value={f.status} onChange={set('status')} options={[['draft', t('draft')], ['open', t('open')], ['closed', t('closed')]]} />
        <Field id="r-date" label={t('date')} type="date" value={f.race_date || ''} onChange={set('race_date')} req />
        <Field id="r-loc" label={t('location')} value={f.location || ''} onChange={set('location')} />
        <Field id="r-tprice" label={`${t('teamPrice')} (MXN)`} type="number" min="0" step="50" value={f.team_price} onChange={set('team_price')} />
        <Field id="r-rfee" label={`${t('runnerFee')} (MXN)`} type="number" min="0" step="50" value={f.runner_fee} onChange={set('runner_fee')} hint={t('runnerFeeHint')} />
        <Field id="r-size" label={t('teamSizeMax')} type="number" min="1" value={f.team_size} onChange={set('team_size')} />
        <Field id="r-sizes" label={t('teamSizes')} value={f.team_sizes || ''} onChange={set('team_sizes')} hint={t('teamSizesHint')} placeholder="4,5,6" />
        <Field id="r-hold" label={t('holdSlots')} type="number" min="0" value={f.hold_slots ?? 0} onChange={set('hold_slots')} hint={t('holdSlotsHint')} />
        <Field id="r-cap" label={t('capacity')} type="number" min="1" value={f.capacity_teams} onChange={set('capacity_teams')} />
        <Field id="r-cats" label={t('categories')} value={f.categories || ''} onChange={set('categories')} hint={t('categoriesHint')} />
        <Field id="r-bib" label={t('bibStart')} type="number" min="1" value={f.bib_start} onChange={set('bib_start')} />
        <Field id="r-waiver" label={t('waiver')} type="textarea" value={f.waiver || ''} onChange={set('waiver')} full />
        <div className="full row" style={{ justifyContent: 'space-between', marginTop: 6 }}>
          <div>{race && <DeleteButton onConfirm={async () => { if (await act(() => removeRace(race.id), 'deleted')) { onClose(); router.push('/admin/races'); } }} />}</div>
          <div className="row">
            <button type="button" className="btn" onClick={onClose}>{t('cancel')}</button>
            <button className="btn btn-primary" type="submit">{race ? t('save') : t('create')}</button>
          </div>
        </div>
      </form>
    </Drawer>
  );
}

/* ---------------- race detail ---------------- */
type Modal = { type: 'race' } | { type: 'teamForm'; id?: string } | { type: 'team'; id: string } | { type: 'runner'; id: string } | null;

export type AAgent = { id: string; name: string; email: string; phone: string | null; gender: string | null; half_avg_min: number | null; city: string | null;
  message: string | null; paid_claim: boolean; status: string; team_id: string | null; notes: string | null; created_at: string };
export function RaceDetail({ race, teams, runners, payments, agents }: { race: ARace; teams: ATeam[]; runners: ARunner[]; payments: APayment[]; agents: AAgent[] }) {
  const { t, lang } = useT();
  const router = useRouter();
  const q = useSearchParams();
  const tab = q.get('tab') || 'summary';
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<Modal>(null);
  const teamById = (id: string) => teams.find((x) => x.id === id);
  const runnersOfTeam = (id: string) => runners.filter((r) => r.team_id === id).sort((a, b) => (a.bib || 0) - (b.bib || 0));
  const stats = raceStats(race, teams, runners, payments);
  const unassigned = payments.filter((p) => !p.team_id).length;
  const tabs: [string, string][] = [['summary', t('summary')], ['teams', `${t('teams')} · ${stats.teams}`], ['runners', `${t('runners')} · ${stats.runners}`],
    ['payments', t('payments') + (unassigned ? ` · ⚠ ${unassigned}` : '')], ['agents', `${t('fa_tab')} · ${agents.filter((a) => a.status === 'open').length}`], ['import', t('importTab')]];
  // Hold races: a runner is "covered" when they fit inside the team's paid slots.
  const groups = parseGroups(race.start_groups);
  const info = (tm: ATeam) => {
    const rs = runnersOfTeam(tm.id);
    return { cat: categoryOf(rs.map((r) => r.gender)), group: groupFor(tm.half_avg_min, groups), complete: regComplete(teamSlots(tm, race).size, rs) };
  };
  const covered = new Set<string>();
  if (isHold(race)) for (const tm of teams) runnersOfTeam(tm.id).slice(0, teamSlots(tm, race).paid).forEach((r) => covered.add(r.id));
  const setTab = (k: string) => { setSearch(''); router.replace(k === 'summary' ? `/admin/races/${race.id}` : `/admin/races/${race.id}?tab=${k}`, { scroll: false }); };
  const csvHref = `/api/admin/races/${race.id}/csv`;

  return (
    <>
      <div className="top">
        <div>
          <div className="crumbs"><Link href="/admin/races">{t('races')}</Link> / <span className={'brand-chip ' + brandClass(race.brand)}>{race.brand}</span></div>
          <h1>{race.name}</h1>
          <div className="row muted" style={{ marginTop: 8, fontSize: 14 }}>
            <StatusPill s={race.status} /><span>{fmtDate(race.race_date, lang)}</span>{race.location && <span>· {race.location}</span>}
          </div>
        </div>
        <div className="row">
          <button type="button" className="btn" onClick={() => setModal({ type: 'race' })}>{t('edit')}</button>
          <a className="btn" href={csvHref}>{t('exportCsv')}</a>
          <button type="button" className="btn btn-primary" onClick={() => setModal({ type: 'teamForm' })}>+ {t('addTeam')}</button>
        </div>
      </div>
      <div className="tabs" role="tablist">
        {tabs.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>)}
      </div>

      {tab === 'summary' && <Summary race={race} teams={teams} runners={runners} stats={stats} info={info} groups={groups} />}
      {tab === 'teams' && (
        <>
          <div className="toolbar">
            <input className="search" type="search" placeholder={t('search')} value={search} onChange={(e) => setSearch(e.target.value)} aria-label={t('search')} />
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setModal({ type: 'teamForm' })}>+ {t('addTeam')}</button>
          </div>
          <TeamsTable race={race} teams={teams.filter((x) => !search || `${x.name} ${x.captain_name} ${x.captain_email} ${x.claim_code}`.toLowerCase().includes(search.toLowerCase()))}
            count={(id) => runnersOfTeam(id).length} open={(id) => setModal({ type: 'team', id })} info={info} />
        </>
      )}
      {tab === 'runners' && (
        <>
          <div className="toolbar">
            <input className="search" type="search" placeholder={t('search')} value={search} onChange={(e) => setSearch(e.target.value)} aria-label={t('search')} />
            <a className="btn btn-sm" href={csvHref}>{t('exportCsv')}</a>
          </div>
          <RunnersTable runners={runners.filter((x) => !search || `${x.first_name} ${x.last_name} ${x.email} ${teamById(x.team_id)?.name || ''} ${x.bib}`.toLowerCase().includes(search.toLowerCase()))}
            teamName={(id) => teamById(id)?.name || '—'} open={(id) => setModal({ type: 'runner', id })} hold={isHold(race)} covered={covered} />
        </>
      )}
      {tab === 'payments' && <Payments race={race} teams={teams} payments={payments} stats={stats} />}
      {tab === 'import' && <ImportPanel race={race} />}
      {tab === 'agents' && <AgentsAdmin agents={agents} teamName={(id) => teamById(id)?.name || '—'} />}

      {modal?.type === 'race' && <RaceForm race={race} onClose={() => setModal(null)} />}
      {modal?.type === 'teamForm' && <TeamForm race={race} team={modal.id ? teamById(modal.id) : undefined} onClose={() => setModal(null)} onSaved={(id) => setModal({ type: 'team', id })} />}
      {modal?.type === 'team' && teamById(modal.id) && (
        <TeamDrawer team={teamById(modal.id)!} race={race} runners={runnersOfTeam(modal.id)} payments={payments.filter((p) => p.team_id === modal.id)} info={info(teamById(modal.id)!)} onClose={() => setModal(null)}
          onEdit={() => setModal({ type: 'teamForm', id: modal.id })} onRunner={(id) => setModal({ type: 'runner', id })} />
      )}
      {modal?.type === 'runner' && runners.find((r) => r.id === modal.id) && (
        <RunnerDrawer runner={runners.find((r) => r.id === modal.id)!} race={race} team={teamById(runners.find((r) => r.id === modal.id)!.team_id)}
          onClose={() => setModal(null)} onTeam={(id) => setModal({ type: 'team', id })} />
      )}
    </>
  );
}

export const brandClass = (b: string) => (b === 'Sal a Valle' ? 'sav' : b === 'Baja Crossing' ? 'baja' : 'other');
function StatusPill({ s }: { s: string }) {
  const { t } = useT();
  return s === 'open' ? <span className="chip ok">{t('open')}</span> : s === 'closed' ? <span className="chip bad">{t('closed')}</span> : <span className="chip">{t('draft')}</span>;
}

type Stats = ReturnType<typeof raceStats>;

function GroupsCard({ race, teams, info, groups }: { race: ARace; teams: ATeam[]; info: Info; groups: StartGroup[] }) {
  const { t } = useT();
  const { act } = useAct();
  const [edit, setEdit] = useState<{ label: string; max: string; color: string; start: string }[] | null>(null);
  const counts = (g: StartGroup | null) => {
    const ts = teams.filter((x) => (info(x).group?.label ?? null) === (g?.label ?? null));
    return { n: ts.length, f: ts.filter((x) => info(x).cat === 'femenil').length, v: ts.filter((x) => info(x).cat === 'varonil').length, m: ts.filter((x) => info(x).cat === 'mixto').length };
  };
  const none = counts(null);
  const rangeOf = (i: number, sorted: StartGroup[]) => {
    const prev = i > 0 ? sorted[i - 1].max : null, g = sorted[i];
    return g.max == null ? `${(prev ?? 0) + 1}+ min` : prev == null ? `≤ ${g.max} min` : `${prev + 1}–${g.max} min`;
  };
  const sorted = [...groups].sort((a, b) => (a.max ?? Infinity) - (b.max ?? Infinity));
  return (
    <div className="card stack" style={{ gridColumn: '1 / -1' }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div><h3 style={{ textTransform: 'uppercase' }}>{t('startGroups')}</h3><p className="muted" style={{ fontSize: 14, marginTop: 4 }}>{t('startGroupsSub')}</p></div>
        {!edit && <button type="button" className="btn btn-sm" onClick={() => setEdit(sorted.map((g) => ({ label: g.label, max: g.max == null ? '' : String(g.max), color: g.color, start: g.start })))}>{t('edit')}</button>}
      </div>
      {edit ? (
        <form className="stack" style={{ gap: 10 }} onSubmit={async (e) => { e.preventDefault(); if (await act(() => saveGroups(race.id, edit))) setEdit(null); }}>
          {edit.map((g, i) => (
            <div key={i} className="row" style={{ alignItems: 'flex-end' }}>
              <Field id={`g-l-${i}`} label={t('group')} value={g.label} onChange={(v) => setEdit(edit.map((x, j) => (j === i ? { ...x, label: v } : x)))} style={{ width: 70 }} />
              <Field id={`g-m-${i}`} label={t('limitMin')} type="number" value={g.max} placeholder={t('noLimit')} onChange={(v) => setEdit(edit.map((x, j) => (j === i ? { ...x, max: v } : x)))} style={{ width: 110 }} />
              <Field id={`g-c-${i}`} label={t('color')} type="color" value={g.color} onChange={(v) => setEdit(edit.map((x, j) => (j === i ? { ...x, color: v } : x)))} style={{ width: 60, padding: 2, height: 42 }} />
              <Field id={`g-s-${i}`} label={t('startTime')} type="time" value={g.start} onChange={(v) => setEdit(edit.map((x, j) => (j === i ? { ...x, start: v } : x)))} />
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEdit(edit.filter((_, j) => j !== i))}>×</button>
            </div>
          ))}
          <div className="row">
            <button type="button" className="btn btn-sm" onClick={() => setEdit([...edit, { label: String(edit.length + 1), max: '', color: '#5b6370', start: '' }])}>+ {t('addGroup')}</button>
            <span style={{ flex: 1 }} />
            <button type="button" className="btn btn-sm" onClick={() => setEdit(null)}>{t('cancel')}</button>
            <button type="submit" className="btn btn-primary btn-sm">{t('save')}</button>
          </div>
        </form>
      ) : (
        <div className="tbl-wrap"><table>
          <thead><tr><th>{t('group')}</th><th>Min</th><th>{t('startTime')}</th><th style={{ textAlign: 'right' }}>{t('teams')}</th><th style={{ textAlign: 'right' }}>{t('femenil')}</th><th style={{ textAlign: 'right' }}>{t('varonil')}</th><th style={{ textAlign: 'right' }}>{t('mixto')}</th></tr></thead>
          <tbody>
            {sorted.map((g, i) => { const c = counts(g); return (
              <tr key={g.label + i}><td><GroupChip g={g} /></td><td className="num">{rangeOf(i, sorted)}</td><td className="num">{g.start || '—'}</td>
                <td className="num" style={{ textAlign: 'right' }}><b>{c.n}</b></td><td className="num" style={{ textAlign: 'right' }}>{c.f}</td><td className="num" style={{ textAlign: 'right' }}>{c.v}</td><td className="num" style={{ textAlign: 'right' }}>{c.m}</td></tr>
            ); })}
            {none.n > 0 && <tr><td><GroupChip g={null} /></td><td>—</td><td>—</td><td className="num" style={{ textAlign: 'right' }}><b>{none.n}</b></td><td className="num" style={{ textAlign: 'right' }}>{none.f}</td><td className="num" style={{ textAlign: 'right' }}>{none.v}</td><td className="num" style={{ textAlign: 'right' }}>{none.m}</td></tr>}
          </tbody>
        </table></div>
      )}
    </div>
  );
}

type Info = (tm: ATeam) => { cat: string | null; group: StartGroup | null; complete: boolean };
function Summary({ race, teams, runners, stats, info, groups }: { race: ARace; teams: ATeam[]; runners: ARunner[]; stats: Stats; info: Info; groups: StartGroup[] }) {
  const { t, lang } = useT();
  const copy = useCopy();
  const [link, setLink] = useState(`/r/${race.id}`);
  useEffect(() => setLink(window.location.origin + `/r/${race.id}`), [race.id]);
  const cats = splitCats(race.categories);
  const shirts: Record<string, number> = {};
  runners.forEach((x) => (shirts[x.shirt_size || '—'] = (shirts[x.shirt_size || '—'] || 0) + 1));
  return (
    <div className="stack">
      <div className="kpis">
        <div className="kpi"><div className="label">{t('teamsSold')}</div><div className="v num">{stats.teams}<span className="muted" style={{ fontSize: 22 }}>/{race.capacity_teams}</span></div><div className="s">{stats.teamsLeft} {t('slotsLeft')}</div></div>
        <div className="kpi"><div className="label">{t('runners')}</div><div className="v num">{stats.runners}<span className="muted" style={{ fontSize: 22 }}>/{stats.capRunners}</span></div><div className="meter"><i style={{ width: Math.min(100, Math.round(stats.fill * 100)) + '%' }} /></div></div>
        <div className="kpi"><div className="label">{t('revenue')}</div><div className="v num">{money(stats.revenue, lang)}</div><div className="s">{money(stats.pending, lang)} {t('pending').toLowerCase()}</div></div>
        <div className="kpi"><div className="label">{isHold(race) ? t('holdLabel') : t('teamPrice')}</div><div className="v num">{money(race.team_price, lang)}</div><div className="s">{isHold(race) ? `${race.hold_slots} ${t('slotsWord')} · ${money(race.runner_fee, lang)} ${t('perExtraSlot')}` : race.runner_fee > 0 ? `${money(race.runner_fee, lang)} · ${t('runnerFee').toLowerCase()}` : t('p_included')}</div></div>
      </div>
      <div className="split">
        <div className="card">
          <h3 style={{ textTransform: 'uppercase', marginBottom: 10 }}>{t('categories')}</h3>
          <div className="list">{(['femenil', 'varonil', 'mixto'] as const).map((c) => <div className="it" key={c}><CatChip c={c} /><b className="num">{teams.filter((x) => info(x).cat === c).length} {t('teams').toLowerCase()}</b></div>)}</div>
          {cats.length > 0 && <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{cats.map((c) => `${c}: ${teams.filter((x) => x.category === c).length}`).join(' · ')}</div>}
          <h3 style={{ textTransform: 'uppercase', margin: '18px 0 10px' }}>{t('shirt')}</h3>
          {Object.keys(shirts).length ? <div className="row">{Object.entries(shirts).map(([k, n]) => <span key={k} className="chip plain">{k} · <b className="num">{n}</b></span>)}</div> : <p className="muted">—</p>}
        </div>
        <GroupsCard race={race} teams={teams} info={info} groups={groups} />
        <div className="card stack">
          <div><h3 style={{ textTransform: 'uppercase' }}>{t('p_captainLink')}</h3><p className="muted" style={{ fontSize: 14, marginTop: 6 }}>{race.status === 'open' ? t('p_shareText') : t('race_closed')}</p></div>
          <div className="row"><span className="code" style={{ overflowWrap: 'anywhere' }}>{link}</span><button type="button" className="btn btn-sm" onClick={() => copy(link)}>{t('copy')}</button></div>
        </div>
      </div>
    </div>
  );
}

function TeamsTable({ race, teams, count, open, info }: { race: ARace; teams: ATeam[]; count: (id: string) => number; open: (id: string) => void; info: Info }) {
  const { t, lang } = useT();
  const hold = isHold(race);
  return (
    <div className="tbl-wrap">
      {teams.length ? (
        <table>
          <thead><tr><th>{t('team')}</th><th>{t('captain')}</th><th>{t('categories')}</th><th>{t('group')}</th><th>{t('members')}</th>{hold && <th>{t('paidSlots')}</th>}<th style={{ textAlign: 'right' }}>{t('balance')}</th><th>{t('regType')}</th><th>{t('logo')}</th><th>{t('teamPassword')}</th><th>{hold ? t('holdLabel') : t('payment')}</th></tr></thead>
          <tbody>
            {teams.map((x) => {
              const sl = teamSlots(x, race), n = count(x.id), inf = info(x), lg = logoSrc(x);
              return (
                <tr key={x.id} className="click" onClick={() => open(x.id)}>
                  <td><div className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>{lg && <img src={lg} alt="" style={{ width: 28, height: 28, objectFit: 'contain', borderRadius: 4 }} />}<b>{x.name}</b></div></td>
                  <td>{x.captain_name}<div className="muted" style={{ fontSize: 12 }}>{x.captain_email}</div></td>
                  <td><CatChip c={inf.cat} /></td>
                  <td><GroupChip g={inf.group} />{x.half_avg_min && <div className="muted num" style={{ fontSize: 12 }}>{fmtHalf(x.half_avg_min)}</div>}</td>
                  <td className="num">{n}/{sl.size}{n > sl.size && <span className="chip bad" style={{ marginLeft: 6 }}>+{n - sl.size}</span>}<div>{inf.complete ? <span className="chip ok">{t('regComplete')}</span> : <span className="chip warn">{t('regIncomplete')}</span>}</div></td>
                  {hold && <td className="num"><SlotBar paid={sl.paid} size={sl.size} /></td>}
                  <td className="num" style={{ textAlign: 'right' }}>{sl.balance > 0 ? money(sl.balance, lang) : <span className="chip ok">{t('paid')}</span>}</td>
                  <td><span className="chip plain">{t(x.reg_type === 'full' ? 'full' : 'presale')}</span></td>
                  <td>{lg ? <span className="chip ok">✓</span> : <span className="chip">—</span>}</td>
                  <td>{x.has_password ? <span className="chip ok">{t('set')}</span> : <span className="chip">{t('notSet')}</span>}</td>
                  <td><PayChip status={x.payment_status} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : <div className="empty">{t('noTeams')}</div>}
    </div>
  );
}

function SlotBar({ paid, size }: { paid: number; size: number }) {
  return (
    <span className="row" style={{ gap: 3, flexWrap: 'nowrap' }} title={`${paid}/${size}`}>
      {Array.from({ length: Math.max(size, paid) }, (_, i) => (
        <i key={i} style={{ width: 9, height: 14, borderRadius: 2, display: 'inline-block', background: i < paid ? (i < size ? 'var(--ok)' : 'var(--warn)') : 'var(--line)' }} />
      ))}
      <span style={{ marginLeft: 6 }}>{paid}/{size}</span>
    </span>
  );
}

function RunnersTable({ runners, teamName, open, hold, covered }: { runners: ARunner[]; teamName: (id: string) => string; open: (id: string) => void; hold: boolean; covered: Set<string> }) {
  const { t } = useT();
  const { act } = useAct();
  const saveNote = (id: string, v: string) => act(() => saveRunnerNotes(id, v));
  const sorted = [...runners].sort((a, b) => (a.bib || 0) - (b.bib || 0));
  return (
    <div className="tbl-wrap">
      {sorted.length ? (
        <table>
          <thead><tr><th>{t('bib')}</th><th>{t('name')}</th><th>{t('team')}</th><th>{t('gender')}</th><th>{t('shirt')}</th><th>{t('waiverOk')}</th><th>{t('payment')}</th><th>{t('notes')}</th></tr></thead>
          <tbody>
            {sorted.map((x) => (
              <tr key={x.id} className="click" onClick={() => open(x.id)}>
                <td><Bib n={x.bib} /></td>
                <td><b>{x.first_name} {x.last_name}</b><div className="muted" style={{ fontSize: 12 }}>{x.email}</div></td>
                <td>{teamName(x.team_id)}</td><td>{genderLabel(x.gender, t)}</td><td>{x.shirt_size || '—'}</td>
                <td>{x.waiver_accepted_at ? <span className="chip ok">✓</span> : <span className="chip bad">✗</span>}</td>
                <td>{hold ? (covered.has(x.id) ? <span className="chip ok">{t('covered')}</span> : <span className="chip warn">{t('pending')}</span>)
                  : x.fee > 0 ? <PayChip status={x.payment_status} /> : <span className="chip plain">{t('p_included')}</span>}</td>
                <td onClick={(e) => e.stopPropagation()}><NoteCell value={x.notes} onSave={(v) => saveNote(x.id, v)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <div className="empty">{t('noRunners')}</div>}
    </div>
  );
}

function Payments({ race, teams, payments, stats }: { race: ARace; teams: ATeam[]; payments: APayment[]; stats: Stats }) {
  const { t, lang } = useT();
  const { act } = useAct();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const sortedTeams = [...teams].sort((a, b) => a.name.localeCompare(b.name));
  const teamName = (id: string | null) => teams.find((x) => x.id === id)?.name || '—';
  const un = payments.filter((p) => !p.team_id);
  const shown = payments.filter((p) => !q || `${p.payer_name} ${p.payer_email} ${p.comment} ${p.notes} ${teamName(p.team_id)} ${p.external_id}`.toLowerCase().includes(q.toLowerCase()));
  const concept = (p: APayment) => p.kind === 'team' ? (isHold(race) ? t('holdLabel') : t('team')) : p.kind === 'slots' ? `${p.quantity} ${t('slotsWord')}` : t('runnerFee');
  const TeamSelect = ({ p }: { p: APayment }) => (
    <select value={p.team_id || ''} onChange={(e) => act(() => setPaymentTeam(p.id, e.target.value || null))} aria-label={t('team')} style={{ maxWidth: 220, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--surface)' }}>
      <option value="">— {t('unassigned')} —</option>
      {sortedTeams.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
    </select>
  );
  return (
    <div className="stack">
      <div className="kpis">
        <div className="kpi"><div className="label">{t('paid')}</div><div className="v num">{money(stats.revenue, lang)}</div><div className="s">{payments.length} {t('payments').toLowerCase()}</div></div>
        <div className="kpi"><div className="label">{t('pending')}</div><div className="v num">{money(stats.pending, lang)}</div></div>
        <div className="kpi"><div className="label">{t('unassigned')}</div><div className="v num">{un.length}</div><div className="s">{money(un.reduce((a, p) => a + p.amount, 0), lang)}</div></div>
      </div>
      {un.length > 0 && (
        <div className="card stack">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div><h3 style={{ textTransform: 'uppercase' }}>{t('unassignedTitle')}</h3><p className="muted" style={{ fontSize: 14, marginTop: 4 }}>{t('unassignedSub')}</p></div>
            <button type="button" className="btn btn-sm" disabled={busy} onClick={async () => { setBusy(true); const r = await rematchPayments(race.id); setBusy(false); toast(`${t('stillUnassigned')}: ${r.left}`); }}>{t('rematch')}</button>
          </div>
          <div className="tbl-wrap"><table>
            <thead><tr><th>{t('date')}</th><th>{t('payer')}</th><th>{t('concept')}</th><th style={{ textAlign: 'right' }}>{t('amount')}</th><th>{t('team')}</th><th>{t('notes')}</th></tr></thead>
            <tbody>{un.map((p) => (
              <tr key={p.id}>
                <td className="num">{fmtDate(p.paid_at, lang)}</td>
                <td><b>{p.payer_name || '—'}</b><div className="muted" style={{ fontSize: 12 }}>{p.payer_email}</div>{p.comment && <div style={{ fontSize: 12, marginTop: 2 }}>“{p.comment}”</div>}</td>
                <td>{concept(p)}</td><td className="num" style={{ textAlign: 'right' }}>{money(p.amount, lang)}</td>
                <td><TeamSelect p={p} /></td>
                <td><NoteCell value={p.notes} onSave={(v) => act(() => savePaymentNotes(p.id, v))} /></td>
              </tr>
            ))}</tbody>
          </table></div>
        </div>
      )}
      <div className="toolbar"><input className="search" type="search" placeholder={t('search')} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('search')} /></div>
      <div className="tbl-wrap">
        {shown.length ? (
          <table>
            <thead><tr><th>{t('date')}</th><th>{t('payer')}</th><th>{t('concept')}</th><th>{t('method')}</th><th style={{ textAlign: 'right' }}>{t('amount')}</th><th>{t('team')}</th><th>{t('notes')}</th><th /></tr></thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.id}>
                  <td className="num">{fmtDT(p.paid_at, lang)}</td>
                  <td>{p.payer_name || '—'}<div className="muted" style={{ fontSize: 12 }}>{p.payer_email}{p.external_id?.startsWith('ecwid:') ? ` · #${p.external_id.slice(6)}` : ''}</div></td>
                  <td>{concept(p)}</td><td>{methodLabel(p.source, t)}</td>
                  <td className="num" style={{ textAlign: 'right' }}>{money(p.amount, lang)}</td>
                  <td><TeamSelect p={p} /></td>
                  <td><NoteCell value={p.notes} onSave={(v) => act(() => savePaymentNotes(p.id, v))} /></td>
                  <td style={{ textAlign: 'right' }}>{p.source === 'manual' && <DeleteButton onConfirm={() => act(() => removePayment(p.id), 'deleted')} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div className="empty">{t('noPayments')}</div>}
      </div>
    </div>
  );
}

function AgentsAdmin({ agents, teamName }: { agents: AAgent[]; teamName: (id: string) => string }) {
  const { t, lang } = useT();
  const { act } = useAct();
  return (
    <div className="stack">
      <p className="muted" style={{ fontSize: 14 }}>{t('fa_adminSub')}</p>
      <div className="tbl-wrap">
        {agents.length ? (
          <table>
            <thead><tr><th>{t('date')}</th><th>{t('name')}</th><th>{t('gender')}</th><th>21K</th><th>{t('fa_city')}</th><th>{t('fa_paid')}</th><th>{t('status')}</th><th>{t('notes')}</th><th /></tr></thead>
            <tbody>
              {agents.map((a) => (
                <tr key={a.id}>
                  <td className="num">{fmtDate(a.created_at, lang)}</td>
                  <td><b>{a.name}</b><div className="muted" style={{ fontSize: 12 }}>{a.email} · {a.phone}</div>{a.message && <div style={{ fontSize: 12, marginTop: 2 }}>“{a.message}”</div>}</td>
                  <td>{genderLabel(a.gender, t)}</td><td className="num">{fmtHalf(a.half_avg_min)}</td><td>{a.city || '—'}</td>
                  <td>{a.paid_claim ? <span className="chip warn">{t('fa_paid')}</span> : '—'}</td>
                  <td>
                    <select value={a.status} onChange={(e) => act(() => staffSetAgentStatus(a.id, e.target.value as any))} style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--surface)' }}>
                      {['open', 'matched', 'closed'].map((s) => <option key={s} value={s}>{t('fa_st_' + s)}</option>)}
                    </select>
                    {a.team_id && <div className="muted" style={{ fontSize: 12 }}>{teamName(a.team_id)}</div>}
                  </td>
                  <td><NoteCell value={a.notes} onSave={(v) => act(() => staffAgentNotes(a.id, v))} /></td>
                  <td style={{ textAlign: 'right' }}><DeleteButton onConfirm={() => act(() => staffDeleteAgent(a.id), 'deleted')} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div className="empty">{t('fa_empty')}</div>}
      </div>
    </div>
  );
}

function ImportPanel({ race }: { race: ARace }) {
  const { t } = useT();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<{ file: string; text: string; ok: boolean }[]>([]);
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    setBusy(true);
    // RedPodium first so payments can match against its runners.
    const texts = await Promise.all(files.map(async (f) => ({ name: f.name, text: await f.text() })));
    texts.sort((a, b) => Number(/order_number/.test(a.text.slice(0, 500))) - Number(/order_number/.test(b.text.slice(0, 500))));
    for (const f of texts) {
      const r: any = await importCsv(race.id, f.text);
      if (r.error) setLog((l) => [...l, { file: f.name, ok: false, text: t(r.error) }]);
      else setLog((l) => [...l, { file: f.name, ok: true, text:
        (r.kind === 'redpodium' ? `RedPodium · ${r.teamsCreated} ${t('teams').toLowerCase()}, ${r.runnersCreated} ${t('runners').toLowerCase()}` : `Ecwid · ${r.paymentsCreated} ${t('payments').toLowerCase()}`) +
        ` · ${r.skipped} ${t('alreadyImported')} · ${r.unmatched} ${t('unassigned').toLowerCase()}` + (r.warnings?.length ? `\n⚠ ${r.warnings.join('\n⚠ ')}` : '') }]);
    }
    setBusy(false);
    router.refresh();
  };
  return (
    <div className="split">
      <div className="card stack">
        <h3 style={{ textTransform: 'uppercase' }}>{t('importTitle')}</h3>
        <p className="muted" style={{ fontSize: 14 }}>{t('importSub')}</p>
        <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14, display: 'grid', gap: 6 }}>
          <li>{t('importStep1')}</li><li>{t('importStep2')}</li><li>{t('importStep3')}</li>
        </ol>
        <label className="btn btn-primary" style={{ alignSelf: 'flex-start', cursor: busy ? 'wait' : 'pointer' }}>
          {busy ? <><span className="spin" /> {t('importing')}</> : t('chooseCsv')}
          <input type="file" accept=".csv,text/csv" multiple hidden onChange={onFile} disabled={busy} />
        </label>
      </div>
      <div className="card stack">
        <h3 style={{ textTransform: 'uppercase' }}>{t('importLog')}</h3>
        {log.length ? log.map((l, i) => (
          <div key={i} className="note" style={{ whiteSpace: 'pre-wrap', color: l.ok ? undefined : 'var(--bad)' }}><b>{l.file}</b><br />{l.text}</div>
        )) : <p className="muted">—</p>}
      </div>
    </div>
  );
}

/* ---------------- team form / drawer ---------------- */
function TeamForm({ race, team, onClose, onSaved }: { race: ARace; team?: ATeam; onClose: () => void; onSaved: (id: string) => void }) {
  const { t } = useT();
  const { act } = useAct();
  const cats = splitCats(race.categories);
  const sizes = sizeList(race);
  const [f, setF] = useState<Record<string, any>>(team ? { ...team, team_size: team.team_size || race.team_size, half_avg: team.half_avg_min ? fmtHalf(team.half_avg_min) : '' } : { half_avg: '', reg_type: 'presale', name: '', category: cats[0] || '', captain_name: '', captain_email: '', captain_phone: '', amount: race.team_price, payment_status: 'pending', team_size: sizes[sizes.length - 1], notes: '' });
  const set = (k: string) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await act(() => saveTeam(team?.id || null, race.id, f));
    if (r?.id) onSaved(r.id);
  };
  return (
    <Drawer title={team ? team.name : t('addTeam')} sub={race.name} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <Field id="t-name" label={t('p_teamName')} value={f.name} onChange={set('name')} req full />
        <Field id="t-cat" label={t('category')} value={f.category || ''} onChange={set('category')} options={cats.length ? cats : ['—']} />
        <Field id="t-pay" label={t('payment')} value={f.payment_status} onChange={set('payment_status')} options={[['pending', t('pending')], ['paid', t('paid')]]} />
        <Field id="t-cname" label={t('p_captainName')} value={f.captain_name} onChange={set('captain_name')} req />
        <Field id="t-cemail" label={t('email')} type="email" value={f.captain_email} onChange={set('captain_email')} req />
        <Field id="t-cphone" label={t('phone')} type="tel" value={f.captain_phone || ''} onChange={set('captain_phone')} />
        <Field id="t-amt" label={`${isHold(race) ? t('holdLabel') : t('amount')} (MXN)`} type="number" value={f.amount} onChange={set('amount')} />
        <Field id="t-size" label={t('teamSize')} value={String(f.team_size)} onChange={set('team_size')} options={sizes.map(String)} />
        <Field id="t-half" label={t('halfAvg')} value={f.half_avg || ''} onChange={set('half_avg')} placeholder="1:45" hint={t('halfHint')} />
        <Field id="t-reg" label={t('regType')} value={f.reg_type || 'presale'} onChange={set('reg_type')} options={[['presale', t('presale')], ['full', t('full')]]} />
        <Field id="t-notes" label={t('notes')} type="textarea" value={f.notes || ''} onChange={set('notes')} full />
        <div className="full row" style={{ justifyContent: 'flex-end', marginTop: 6 }}>
          <button type="button" className="btn" onClick={onClose}>{t('cancel')}</button>
          <button className="btn btn-primary" type="submit">{team ? t('save') : t('create')}</button>
        </div>
      </form>
    </Drawer>
  );
}

function TeamDrawer({ team: x, race, runners, payments, info, onClose, onEdit, onRunner }: { team: ATeam; race: ARace; runners: ARunner[]; payments: APayment[]; info: ReturnType<Info>; onClose: () => void; onEdit: () => void; onRunner: (id: string) => void }) {
  const { t, lang } = useT();
  const { act } = useAct();
  const copy = useCopy();
  const sl = teamSlots(x, race);
  const hold = isHold(race);
  const [add, setAdd] = useState<{ qty: string; amount: string } | null>(null);
  return (
    <Drawer title={x.name} sub={`${race.name} · ${x.category || ''}`} onClose={onClose}>
      <div className="row"><PayChip status={x.payment_status} /><span className="chip plain num">{runners.length}/{sl.size} {t('runners').toLowerCase()}</span>
        {hold && <SlotBar paid={sl.paid} size={sl.size} />}{sl.balance > 0 && <span className="chip warn num">{t('balance')}: {money(sl.balance, lang)}</span>}</div>
      <div className="row"><CatChip c={info.cat} /><GroupChip g={info.group} /><span className="chip plain num">{t('halfAvg').split(' ')[0]}: {fmtHalf(x.half_avg_min)}</span>
        <span className="chip plain">{t(x.reg_type === 'full' ? 'full' : 'presale')}</span>{info.complete ? <span className="chip ok">{t('regComplete')}</span> : <span className="chip warn">{t('regIncomplete')}</span>}</div>
      <LogoInput current={logoSrc(x)} onChange={async (d) => { await act(() => setTeamLogoAdmin(x.id, d)); }} />
      {x.notes && <div className="note" style={{ whiteSpace: 'pre-wrap' }}>{x.notes}</div>}
      <div className="card">
        <dl className="kv">
          <dt>{t('captain')}</dt><dd>{x.captain_name}</dd>
          <dt>{t('email')}</dt><dd>{x.captain_email}</dd>
          <dt>{t('phone')}</dt><dd>{x.captain_phone || '—'}</dd>
          <dt>{t('amount')}</dt><dd className="num">{money(x.amount, lang)}{x.payment_status === 'paid' && ` · ${methodLabel(x.payment_method, t)}`}</dd>
          <dt>{t('captainCode')}</dt><dd><span className="code">{x.claim_code}</span> <button type="button" className="btn btn-ghost btn-sm" onClick={() => copy(x.claim_code)}>{t('copy')}</button></dd>
          <dt>{t('teamPassword')}</dt><dd>{x.has_password ? <span className="chip ok">{t('set')}</span> : <span className="chip">{t('notSet')}</span>}</dd>
          <dt>{t('registered')}</dt><dd>{fmtDT(x.created_at, lang)}</dd>
        </dl>
      </div>
      <div className="row">
        {x.payment_status !== 'paid' && <button type="button" className="btn btn-primary btn-sm" onClick={() => act(() => teamMarkPaid(x.id))}>{t('markPaid')}</button>}
        <button type="button" className="btn btn-sm" onClick={onEdit}>{t('edit')}</button>
        <button type="button" className="btn btn-sm" onClick={() => act(() => teamNewCode(x.id))}>{t('newCode')}</button>
        {x.has_password && <button type="button" className="btn btn-sm" onClick={() => act(() => teamClearPassword(x.id))}>{t('resetPass')}</button>}
        {hold && <button type="button" className="btn btn-sm" onClick={() => setAdd({ qty: String(Math.max(1, sl.size - sl.paid)), amount: String(Math.max(1, sl.size - sl.paid) * race.runner_fee) })}>{t('addSlots')}</button>}
      </div>
      {add && (
        <form className="card row" style={{ alignItems: 'flex-end' }} onSubmit={async (e) => { e.preventDefault(); if (await act(() => teamAddSlots(x.id, Number(add.qty), Number(add.amount)))) setAdd(null); }}>
          <Field id="as-qty" label={t('slotsWord')} type="number" min="1" value={add.qty} onChange={(v) => setAdd({ qty: v, amount: String((Number(v) || 0) * race.runner_fee) })} />
          <Field id="as-amt" label={`${t('amount')} (MXN)`} type="number" min="0" value={add.amount} onChange={(v) => setAdd({ ...add, amount: v })} />
          <button className="btn btn-primary btn-sm" type="submit">{t('save')}</button>
          <button className="btn btn-sm" type="button" onClick={() => setAdd(null)}>{t('cancel')}</button>
        </form>
      )}
      {payments.length > 0 && (
        <div>
          <h3 style={{ textTransform: 'uppercase', marginBottom: 8 }}>{t('payments')}</h3>
          <div className="tbl-wrap"><table><tbody>
            {payments.map((p) => (
              <tr key={p.id}>
                <td className="num">{fmtDate(p.paid_at, lang)}</td>
                <td>{p.kind === 'team' ? (hold ? t('holdLabel') : t('team')) : p.kind === 'slots' ? `${p.quantity} ${t('slotsWord')}` : t('runnerFee')}<div className="muted" style={{ fontSize: 12 }}>{p.payer_name} · {methodLabel(p.source, t)}</div></td>
                <td className="num" style={{ textAlign: 'right' }}>{money(p.amount, lang)}</td>
              </tr>
            ))}
          </tbody></table></div>
        </div>
      )}
      <div>
        <h3 style={{ textTransform: 'uppercase', marginBottom: 8 }}>{t('runners')}</h3>
        {runners.length ? (
          <div className="tbl-wrap"><table><tbody>
            {runners.map((y) => (
              <tr key={y.id} className="click" onClick={() => onRunner(y.id)}>
                <td><Bib n={y.bib} /></td>
                <td><b>{y.first_name} {y.last_name}</b><div className="muted" style={{ fontSize: 12 }}>{y.email}</div></td>
                <td>{y.fee > 0 && <PayChip status={y.payment_status} />}</td>
              </tr>
            ))}
          </tbody></table></div>
        ) : <p className="muted">{t('p_rosterEmpty')}</p>}
      </div>
      <div><DeleteButton onConfirm={async () => { if (await act(() => removeTeam(x.id), 'deleted')) onClose(); }} /></div>
    </Drawer>
  );
}

/* ---------------- runner drawer ---------------- */
function RunnerDrawer({ runner: x, race, team, onClose, onTeam }: { runner: ARunner; race: ARace; team?: ATeam; onClose: () => void; onTeam: (id: string) => void }) {
  const { t, lang } = useT();
  const { act } = useAct();
  const [edit, setEdit] = useState<(RunnerForm & { bib: string }) | null>(null);
  if (edit) {
    const set = (k: keyof RunnerForm | 'bib') => (v: string) => setEdit((f) => (f ? { ...f, [k]: v } : f));
    const save = async (e: React.FormEvent) => {
      e.preventDefault();
      if (await act(() => saveRunner(x.id, edit))) setEdit(null);
    };
    return (
      <Drawer title={`${x.first_name} ${x.last_name}`} sub={t('edit')} onClose={onClose}>
        <form className="form" onSubmit={save}>
          <RunnerFields f={edit} set={set} />
          <Field id="u-bib" label={t('bib')} type="number" value={edit.bib} onChange={set('bib')} />
          <div className="full row" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn" onClick={() => setEdit(null)}>{t('cancel')}</button>
            <button className="btn btn-primary" type="submit">{t('save')}</button>
          </div>
        </form>
      </Drawer>
    );
  }
  const s = (v: string | null) => v || '';
  return (
    <Drawer title={`${x.first_name} ${x.last_name}`} sub={`${race.name} · ${team?.name || ''}`} onClose={onClose}>
      <div className="row"><Bib n={x.bib} big /></div>
      <div className="card">
        <dl className="kv">
          <dt>{t('team')}</dt><dd>{team?.name || '—'}</dd>
          <dt>{t('email')}</dt><dd>{x.email}</dd>
          <dt>{t('phone')}</dt><dd>{x.phone || '—'}</dd>
          <dt>{t('birth')}</dt><dd>{fmtDate(x.birth_date, lang)}</dd>
          <dt>{t('gender')}</dt><dd>{genderLabel(x.gender, t)}</dd>
          <dt>{t('shirt')}</dt><dd>{x.shirt_size || '—'}</dd>
          <dt>{t('emergency')}</dt><dd>{x.emergency_name || '—'} · {x.emergency_phone}</dd>
          <dt>{t('waiverOk')}</dt><dd>{x.waiver_accepted_at ? fmtDT(x.waiver_accepted_at, lang) : '✗'}</dd>
          <dt>{t('payment')}</dt><dd>{x.fee > 0 ? <><PayChip status={x.payment_status} /> {money(x.fee, lang)}</> : t('p_included')}</dd>
          <dt>{t('registered')}</dt><dd>{fmtDT(x.created_at, lang)}</dd>
        </dl>
      </div>
      <div><div className="label" style={{ marginBottom: 6 }}>{t('notes')}</div><NoteCell wide value={x.notes} onSave={(v) => act(() => saveRunnerNotes(x.id, v))} /></div>
      <div className="row">
        {x.fee > 0 && x.payment_status !== 'paid' && <button type="button" className="btn btn-primary btn-sm" onClick={() => act(() => runnerMarkPaid(x.id))}>{t('markPaid')}</button>}
        <button type="button" className="btn btn-sm" onClick={() => setEdit({
          first_name: x.first_name, last_name: x.last_name, email: x.email, phone: s(x.phone), birth_date: s(x.birth_date), gender: s(x.gender),
          shirt_size: s(x.shirt_size), emergency_name: s(x.emergency_name), emergency_phone: s(x.emergency_phone), bib: x.bib ? String(x.bib) : '',
        })}>{t('edit')}</button>
        {team && <button type="button" className="btn btn-sm" onClick={() => onTeam(team.id)}>{t('team')} →</button>}
        <DeleteButton onConfirm={async () => { if (await act(() => removeRunner(x.id), 'deleted')) onClose(); }} />
      </div>
    </Drawer>
  );
}

/* ---------------- staff ---------------- */
export function Staff({ users, meId }: { users: { id: string; name: string; email: string; created_at: string }[]; meId: string }) {
  const { t, lang } = useT();
  const { act } = useAct();
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await act(() => addTeammate(f))) setF({ name: '', email: '', password: '' });
  };
  return (
    <div className="split">
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>{t('name')}</th><th>{t('email')}</th><th>{t('registered')}</th><th /></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td><b>{u.name}</b></td><td>{u.email}</td><td className="num">{fmtDate(u.created_at, lang)}</td>
                <td style={{ textAlign: 'right' }}>{u.id !== meId && <DeleteButton onConfirm={() => act(() => removeTeammate(u.id), 'deleted')} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form className="card form" onSubmit={submit} style={{ gridTemplateColumns: '1fr' }}>
        <h3 style={{ textTransform: 'uppercase' }}>{t('addUser')}</h3>
        <Field id="s-name" label={t('name')} value={f.name} onChange={set('name')} req />
        <Field id="s-email" label={t('email')} type="email" value={f.email} onChange={set('email')} req />
        <Field id="s-pass" label={t('password')} type="text" value={f.password} onChange={set('password')} req minLength={8} hint={t('passMin8')} autoComplete="off" />
        <div><button className="btn btn-primary" type="submit">{t('create')}</button></div>
      </form>
      <ChangePassword />
    </div>
  );
}

function ChangePassword() {
  const { t } = useT();
  const { act } = useAct();
  const [f, setF] = useState({ current: '', next: '' });
  return (
    <form className="card form" style={{ gridTemplateColumns: '1fr' }} onSubmit={async (e) => { e.preventDefault(); if (await act(() => changePassword(f.current, f.next))) setF({ current: '', next: '' }); }}>
      <h3 style={{ textTransform: 'uppercase' }}>{t('changePassword')}</h3>
      <Field id="cp-cur" label={t('currentPassword')} type="password" value={f.current} onChange={(v) => setF({ ...f, current: v })} req autoComplete="current-password" />
      <Field id="cp-new" label={t('newPassword')} type="password" value={f.next} onChange={(v) => setF({ ...f, next: v })} req minLength={8} hint={t('passMin8')} autoComplete="new-password" />
      <div><button className="btn btn-primary" type="submit">{t('save')}</button></div>
    </form>
  );
}
