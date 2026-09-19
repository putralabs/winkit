import { useState } from 'react';
import { getLanguage, setLanguage, useT } from '../shared/i18n';
import { getSettings, saveSettings } from '../shared/storage';
import { applyTheme } from '../shared/theme';
import { POPULAR_TOOL_IDS, getTool, visibleTools } from '../shared/tools';
import { Reveal } from '../components/reveal';
import { ThemeToggle } from '../components/ui';
import logoUrl from '../assets/logo-mark.png';

function useLang() {
  const [lang, setLang] = useState(getLanguage());
  return {
    lang,
    toggle: () => {
      const next = lang === 'en' ? 'id' : 'en';
      setLang(next);
      setLanguage(next);
    },
  };
}

function useDark() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  return {
    dark,
    toggle: () => {
      const next = !dark;
      setDark(next);
      applyTheme(next ? 'dark' : 'light');
      void getSettings().then((s) => saveSettings({ ...s, theme: next ? 'dark' : 'light' }));
    },
  };
}

/** The bench card: the 4 most-used WinKit tools, straight from the
 *  registry's popularity list. Clicking one opens it directly in the app. */
function BenchInstrument() {
  const t = useT();
  const popular = POPULAR_TOOL_IDS.map((id) => getTool(id)).filter((x) => x !== undefined).slice(0, 4);

  return (
    <div className="wk-readout overflow-hidden rounded-2xl">
      <div className="flex items-center gap-2 border-b border-white/10 px-5 py-3">
        <span className="relative flex h-2 w-2" aria-hidden="true">
          <span className="absolute h-full w-full rounded-full bg-emerald-400 opacity-70 motion-safe:animate-ping" />
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
        </span>
        <span className="wk-readout-label">{t('landing.popTitle')}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 p-4">
        {popular.map((tool) => (
          <a
            key={tool.id}
            href={`./app.html?tool=${tool.id}`}
            className="group rounded-xl border border-white/10 bg-white/5 p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-orange-400/50"
          >
            <p className="wk-readout-label text-orange-400">{tool.category}</p>
            <p className="mt-1 text-sm font-extrabold leading-snug text-white">{t(tool.nameKey)}</p>
            <p className="mt-2 text-[11px] font-bold text-white/40 transition-colors group-hover:text-white/70">
              {t('landing.tryTool')} →
            </p>
          </a>
        ))}
      </div>
      <div className="border-t border-white/10 px-5 py-3">
        <a
          href="#tools"
          className="wk-mono wk-nums text-[11px] font-bold tracking-wider text-white/60 transition-colors hover:text-white"
        >
          {t('landing.browse', { n: visibleTools().length })} ↓
        </a>
      </div>
    </div>
  );
}

const PROCEDURE = [
  { n: '01', tKey: 'landing.p1t', dKey: 'landing.p1d' },
  { n: '02', tKey: 'landing.p2t', dKey: 'landing.p2d' },
  { n: '03', tKey: 'landing.p3t', dKey: 'landing.p3d' },
];

export function Landing() {
  const t = useT();
  const { lang, toggle } = useLang();
  const { dark, toggle: toggleDark } = useDark();
  const tools = visibleTools();
  const cats = [...new Set(tools.map((x) => x.category))];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-2 px-6 py-3">
          <img src={logoUrl} alt="WinKit" className="wk-logo-mark h-9 w-9 rounded-xl" />
          <span className="text-base font-extrabold tracking-tight">WinKit</span>
          <nav className="ml-6 hidden gap-5 text-sm font-medium text-muted-foreground sm:flex" aria-label="sections">
            <a href="#bench" className="transition-colors hover:text-foreground">Bench</a>
            <a href="#tools" className="transition-colors hover:text-foreground">Tools</a>
          </nav>
          <span className="ml-auto flex items-center gap-2">
            <ThemeToggle dark={dark} onToggle={toggleDark} label="toggle theme" />
            <button onClick={toggle} className="cursor-pointer rounded-lg border border-border px-2.5 py-1.5 text-xs font-bold transition-colors hover:border-primary" aria-label="switch language">
              {lang === 'en' ? 'ID' : 'EN'}
            </button>
            <a href="./app.html" className="rounded-lg bg-accent px-4 py-2 text-sm font-bold text-black transition-all duration-200 hover:-translate-y-px hover:opacity-90">
              {t('app.openDashboard')} →
            </a>
          </span>
        </div>
      </header>

      {/* First viewport: the bench proves itself */}
      <section className="mx-auto grid w-full max-w-6xl items-center gap-10 px-6 pb-16 pt-12 sm:pt-20 lg:grid-cols-[1fr_1.1fr]">
        <Reveal>
          <h1 className="wk-display max-w-xl">
            {t('landing.heroA')}<br />{t('landing.heroB')}
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-muted-foreground">
            {t('landing.heroSub')}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href="./app.html" className="rounded-xl bg-accent px-7 py-3.5 text-sm font-bold text-black transition-all duration-200 hover:-translate-y-0.5 hover:opacity-90">
              {t('app.openDashboard')} →
            </a>
            <a href="#tools" className="rounded-xl border-2 border-primary/40 px-7 py-3.5 text-sm font-bold text-primary transition-all duration-200 hover:border-primary hover:bg-primary/5">
              {t('landing.browse', { n: tools.length })}
            </a>
          </div>
          <ul className="mt-5 flex flex-wrap gap-1.5" aria-label="capabilities">
            {[t('landing.capExt'), t('landing.capWeb'), t('landing.capLang'), t('landing.capPriv')].map((c) => (
              <li key={c} className="rounded-full bg-muted px-3 py-1 text-[11px] font-bold text-muted-foreground">
                {c}
              </li>
            ))}
          </ul>
          <dl className="mt-8 flex gap-6">
            {[
              { v: String(tools.length), l: 'tools' },
              { v: String(cats.length), l: 'categories' },
              { v: '100%', l: 'local' },
            ].map((s) => (
              <div key={s.l}>
                <dt className="wk-mono wk-nums text-xl font-bold text-primary">{s.v}</dt>
                <dd className="text-xs text-muted-foreground">{s.l}</dd>
              </div>
            ))}
          </dl>
        </Reveal>
        <div id="bench" className="scroll-mt-24">
          <BenchInstrument />
        </div>
      </section>

      <div className="mx-auto w-full max-w-6xl px-6" aria-hidden="true">
        <hr className="border-border opacity-60" />
      </div>

      <main className="mx-auto w-full max-w-6xl px-6">
        {/* Procedure: an ordered rite, numbered because order matters */}
        <section className="py-14">
          <Reveal>
            <h2 className="max-w-lg text-3xl font-extrabold tracking-tight sm:text-4xl">{t('landing.procTitle')}</h2>
          </Reveal>
          <ol className="mt-8 divide-y divide-border border-y border-border">
            {PROCEDURE.map((p) => (
              <li key={p.n} className="group grid gap-2 py-6 transition-colors duration-150 hover:bg-muted/40 sm:grid-cols-[5rem_14rem_1fr] sm:items-baseline sm:gap-6 sm:px-4">
                <span className="wk-mono wk-nums text-2xl font-bold text-primary/70 transition-colors group-hover:text-primary">{p.n}</span>
                <span className="text-lg font-extrabold tracking-tight">{t(p.tKey)}</span>
                <span className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{t(p.dKey)}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* Tool index */}
        <section id="tools" className="scroll-mt-24 py-12">
          <Reveal>
            <div className="flex flex-wrap items-baseline gap-x-4">
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">The full bench.</h2>
              <p className="wk-mono wk-nums text-sm font-bold text-primary">{tools.length} instruments</p>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">Click any tool to open it directly in the app.</p>
          </Reveal>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {cats.map((c, ci) => (
              <Reveal key={c} delay={Math.min(ci, 4) * 60}>
                <div className="rounded-xl border border-border bg-card p-5 transition-colors duration-200 hover:border-primary/40">
                  <div className="mb-3 flex items-baseline justify-between border-b border-border pb-2">
                    <h3 className="text-sm font-extrabold uppercase tracking-wider">{c}</h3>
                    <span className="wk-mono wk-nums text-xs font-bold text-muted-foreground">
                      {String(tools.filter((x) => x.category === c).length).padStart(2, '0')}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {tools.filter((x) => x.category === c).map((x) => (
                      <a
                        key={x.id}
                        href={`./app.html?tool=${x.id}`}
                        className="rounded-full bg-muted px-3 py-1.5 text-xs font-semibold transition-all duration-150 hover:-translate-y-px hover:bg-primary hover:text-white"
                      >
                        {t(x.nameKey)}
                      </a>
                    ))}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Close: dark readout */}
        <section className="py-14">
          <Reveal>
            <div className="wk-readout relative overflow-hidden rounded-2xl p-10 text-center sm:p-14">
              <h2 className="mx-auto max-w-xl text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                {t('landing.closeTitle')}
              </h2>
              <p className="mx-auto mt-3 max-w-md text-sm text-white/70">
                {t('landing.closeSub')}
              </p>
              <a href="./app.html" className="mt-7 inline-block rounded-xl bg-accent px-9 py-3.5 text-sm font-bold text-black transition-all duration-200 hover:-translate-y-0.5 hover:opacity-90">
                {t('app.openDashboard')} →
              </a>
              <p className="wk-mono mt-5 text-[11px] text-white/70">{t('landing.countLine', { n: tools.length, c: cats.length })}</p>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-border">
        <p className="py-5 text-center text-xs text-muted-foreground">WinKit v0.1.0 · local-first · {t('app.tagline')}</p>
      </footer>
    </div>
  );
}
