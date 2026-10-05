'use client';
import { createContext, useContext, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { translate } from '@/lib/dict';
import type { Lang } from '@/lib/format';

const Ctx = createContext<{ lang: Lang; t: (k: string) => string; setLang: (l: Lang) => void }>({
  lang: 'es',
  t: (k) => translate('es', k),
  setLang: () => {},
});

export function I18nProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  const router = useRouter();
  const t = useCallback((k: string) => translate(lang, k), [lang]);
  const setLang = useCallback(
    (l: Lang) => {
      document.cookie = `reisin_lang=${l}; path=/; max-age=31536000; samesite=lax`;
      router.refresh();
    },
    [router]
  );
  return <Ctx.Provider value={{ lang, t, setLang }}>{children}</Ctx.Provider>;
}
export const useT = () => useContext(Ctx);

export function LangToggle() {
  const { lang, setLang } = useT();
  return (
    <div className="lang" role="group" aria-label="Idioma / Language">
      {(['es', 'en'] as const).map((l) => (
        <button key={l} type="button" aria-pressed={lang === l} onClick={() => setLang(l)}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
