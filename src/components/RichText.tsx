import { Fragment, type ReactNode } from 'react';
import { safeUrl } from '@/lib/racepage';

// Tiny, safe formatter for staff-written page text (no HTML):
//   "- item" bullets · blank line = new paragraph · **bold** · [text](url) · bare links.
const INLINE = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)|(https?:\/\/[^\s)]+)/g;

function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0, i = 0;
  for (const m of text.matchAll(INLINE)) {
    if (m.index! > last) out.push(text.slice(last, m.index));
    const k = `${key}-${i++}`;
    if (m[1]) out.push(<b key={k}>{inline(m[1], k)}</b>);
    else {
      const href = safeUrl(m[3] || m[4]);
      const label = m[2] ? inline(m[2], k) : m[4];
      out.push(href ? <a key={k} href={href} target={href.startsWith('mailto:') ? undefined : '_blank'} rel="noopener noreferrer">{label}</a> : <Fragment key={k}>{label}</Fragment>);
    }
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function RichText({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  const lines = text.replace(/\r/g, '').split('\n');
  let para: string[] = [], list: string[] = [];
  const flush = () => {
    if (para.length) { const k = 'p' + blocks.length; blocks.push(<p key={k}>{para.flatMap((l, j) => (j ? [<br key={k + j} />, ...inline(l, k + j)] : inline(l, k + j)))}</p>); para = []; }
    if (list.length) { const k = 'u' + blocks.length; blocks.push(<ul key={k}>{list.map((l, j) => <li key={j}>{inline(l, k + j)}</li>)}</ul>); list = []; }
  };
  for (const raw of lines) {
    const l = raw.trim();
    const b = l.match(/^[-•*]\s+(.*)$/);
    if (!l) flush();
    else if (b) { if (para.length) flush(); list.push(b[1]); }
    else { if (list.length) flush(); para.push(l); }
  }
  flush();
  return <div className="rich">{blocks}</div>;
}
