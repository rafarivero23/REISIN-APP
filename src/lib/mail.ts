// Transactional email through Resend (https://resend.com) — plain fetch, no SDK.
// Env: RESEND_API_KEY (required to send), MAIL_FROM (default "Reisin <hola@reisin.mx>"),
// MAIL_REPLY_TO (optional), MAIL_BCC (optional copy of every email, e.g. for the team).
// Without RESEND_API_KEY nothing is sent (logged instead), so dev/test never emails anyone.
import { getRace, getTeam, type Race, type Team } from './repo';
import { run } from './db';
import { translate } from './dict';
import { captainMessage } from './capmsg';
import { money } from './format';
import type { Order } from './store-shared';

export const mailOn = () => !!process.env.RESEND_API_KEY;
export const siteUrl = () => {
  const u = process.env.PUBLIC_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '') || 'https://reisin-app.vercel.app';
  return u.replace(/\/+$/, '');
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const linkify = (s: string) => esc(s).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#111;font-weight:600">$1</a>');

// Simple branded layout: black band with the Reisin wordmark, text, one button.
export function layout(o: { title: string; text: string; cta?: { label: string; url: string }; extraHtml?: string }) {
  const site = siteUrl();
  const paras = o.text.split(/\n{2,}/).map((p) => `<p style="margin:0 0 14px;line-height:1.55">${linkify(p).replace(/\n/g, '<br>')}</p>`).join('');
  return `<!doctype html><html><body style="margin:0;background:#f2f2ef;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#111">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f2ef;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff">
<tr><td style="background:#050505;padding:22px 28px"><img src="${site}/reisin-wordmark-white.png" alt="REISIN" height="26" style="display:block;height:26px"></td></tr>
<tr><td style="padding:28px 28px 8px"><h1 style="margin:0 0 18px;font-size:22px;line-height:1.2;text-transform:uppercase;letter-spacing:.02em">${esc(o.title)}</h1>${paras}${o.extraHtml || ''}
${o.cta ? `<p style="margin:22px 0 8px"><a href="${o.cta.url}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:14px 22px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;font-size:14px">${esc(o.cta.label)} →</a></p>` : ''}
</td></tr>
<tr><td style="padding:18px 28px 26px;color:#888;font-size:12px;border-top:1px solid #eee">A race by Reisin · <a href="${site}" style="color:#888">${site.replace(/^https?:\/\//, '')}</a></td></tr>
</table></td></tr></table></body></html>`;
}

export async function sendMail(m: { to: string; subject: string; html: string; text: string }): Promise<{ ok: boolean; error?: string }> {
  const to = (m.to || '').trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return { ok: false, error: 'bad_email' };
  const key = process.env.RESEND_API_KEY;
  if (!key) { console.log(`[mail] (not sent, no RESEND_API_KEY) to=${to} subject=${m.subject}`); return { ok: false, error: 'mail_off' }; }
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.MAIL_FROM || 'Reisin <hola@reisin.mx>', to: [to], subject: m.subject, html: m.html, text: m.text,
        ...(process.env.MAIL_REPLY_TO ? { reply_to: process.env.MAIL_REPLY_TO } : {}),
        ...(process.env.MAIL_BCC ? { bcc: process.env.MAIL_BCC.split(',').map((x) => x.trim()).filter(Boolean) } : {}),
      }),
    });
    if (!r.ok) { const e = await r.text(); console.error('[mail] resend error', r.status, e); return { ok: false, error: e.slice(0, 200) }; }
    return { ok: true };
  } catch (e: any) {
    console.error('[mail] failed', e?.message);
    return { ok: false, error: 'network' };
  }
}

const tr = (k: string) => translate('es', k);

// Team or Solo purchase: the captain / Solo code and how to finish registration.
export async function sendTeamWelcome(teamId: string, opts: { markSent?: boolean } = { markSent: true }) {
  const team = await getTeam(teamId);
  const race = team ? await getRace(team.race_id) : null;
  if (!team || !race || !team.captain_email) return { ok: false, error: 'not_found' };
  const site = siteUrl();
  let subject: string, text: string, cta: { label: string; url: string };
  if (team.is_solo) {
    const url = `${site}/r/${race.slug || race.id}/solo`;
    text = tr('so_msg').replace('{name}', (team.captain_name || '').split(/\s+/)[0]).replace('{race}', race.name).replace('{url}', url)
      .replace('{pass}', race.access_code ? `\n${tr('capMsgPass')}: ${race.access_code}` : '').replace('{code}', team.claim_code) + '\n\n' + tr('capMsgSign');
    subject = `${race.name} · Solo runner · ${tr('so_code')}: ${team.claim_code}`;
    cta = { label: tr('so_finishBtn'), url };
  } else {
    const m = captainMessage(tr, team as Team & { amount: number }, race as Race, site, true, 'es');
    subject = m.subject; text = m.body;
    cta = { label: tr('p_captain'), url: `${site}/r/${race.slug || race.id}/captain` };
  }
  const title = team.is_solo ? `¡Estás dentro de ${race.name}!` : `¡${team.name} está dentro de ${race.name}!`;
  const codeBox = `<p style="margin:8px 0 18px"><span style="display:inline-block;border:2px solid #111;padding:10px 16px;font-family:Menlo,Consolas,monospace;font-size:20px;letter-spacing:.12em;font-weight:700">${esc(team.claim_code)}</span></p>`;
  const r = await sendMail({ to: team.captain_email, subject, text, html: layout({ title, text, cta, extraHtml: codeBox }) });
  if (r.ok && opts.markSent !== false) await run('UPDATE teams SET code_sent_at = ? WHERE id = ?', [new Date().toISOString(), team.id]);
  return r;
}

// Store order paid: items, total and pickup / shipping.
export async function sendOrderConfirmation(o: Order) {
  const race = await getRace(o.race_id);
  if (!race || !o.email) return { ok: false, error: 'not_found' };
  const site = siteUrl();
  const lines = o.items.map((i) => `${i.qty}× ${i.name}${i.option ? ` · ${i.option}` : ''} — ${money(i.qty * i.price, 'es')}`);
  const money2 = (n: number) => money(n, 'es');
  const totals = [
    o.discount ? `Descuento ${o.discount_code}: −${money2(o.discount)}` : '',
    o.gift ? `Gift card ${o.gift_code}: −${money2(o.gift)}` : '',
    o.shipping ? `Envío: ${money2(o.shipping)}` : '',
    `Total pagado: ${money2(o.total)}`,
  ].filter(Boolean);
  const where = o.delivery === 'ship'
    ? `Lo enviamos a:\n${o.address || ''}`
    : `Recógelo en la entrega de kits de ${race.name}. Muestra este correo o tu número de pedido.`;
  const first = (o.name || '').trim().split(/\s+/)[0];
  const text = `Hola ${first},\n\nGracias por tu compra en el SHOP de ${race.name}. Tu pedido #${o.order_no} está confirmado.\n\n${lines.join('\n')}\n\n${totals.join('\n')}\n\n${where}\n\n${tr('capMsgSign')}`;
  const rows = o.items.map((i) => `<tr><td style="padding:6px 0;border-bottom:1px solid #eee">${i.qty}× ${esc(i.name)}${i.option ? ` <b>${esc(i.option)}</b>` : ''}</td><td align="right" style="padding:6px 0;border-bottom:1px solid #eee">${money2(i.qty * i.price)}</td></tr>`).join('')
    + totals.map((x, k) => `<tr><td colspan="2" align="right" style="padding:4px 0;${k === totals.length - 1 ? 'font-weight:700;font-size:16px' : 'color:#555'}">${esc(x)}</td></tr>`).join('');
  const html = layout({
    title: `Pedido #${o.order_no} confirmado`,
    text: `Hola ${first},\n\nGracias por tu compra en el SHOP de ${race.name}.`,
    extraHtml: `<table role="presentation" width="100%" style="border-collapse:collapse;font-size:14px;margin:4px 0 18px">${rows}</table><p style="margin:0 0 14px;line-height:1.55">${esc(where).replace(/\n/g, '<br>')}</p><p style="margin:0;color:#555">${esc(tr('capMsgSign')).replace(/\n/g, '<br>')}</p>`,
    cta: { label: 'Ver mi pedido', url: `${site}/r/${race.slug || race.id}/store/done?order=${o.id}` },
  });
  return sendMail({ to: o.email, subject: `${race.name} · SHOP · Pedido #${o.order_no}`, text, html });
}
