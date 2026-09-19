import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ToolRunner } from '../components/ToolRunner';
import { ImageInfoRunner } from '../components/ImageInfoRunner';
import { TextRunner } from '../components/TextRunner';
import { CmdPalette } from '../components/CmdPalette';
import { Checkbox, FavoriteStar, SearchBar, Segmented, ToolCard, ToolIcon } from '../components/ui';
import {
  IArchive,
  IArrowLeft,
  IArrowRight,
  IAudio,
  IClock,
  ICode,
  IDoc,
  IFileText,
  IGear,
  IHome,
  IImage,
  IRotateCw,
  IStar,
  IVideo,
  IWrench,
} from '../components/icons';
import { getLanguage, greetingKey, setLanguage, t, useT } from '../shared/i18n';
import {
  clearHistory,
  getFavorites,
  getHistory,
  getRecentTools,
  getSettings,
  saveSettings,
  setPendingFiles,
  toggleFavorite,
} from '../shared/storage';
import { applyTheme } from '../shared/theme';
import { POPULAR_TOOL_IDS, getTool, searchTools, visibleTools } from '../shared/tools';
import type { HistoryEntry, Settings, ToolCategory } from '../shared/types';
import { DEFAULT_SETTINGS } from '../shared/types';
import { formatBytes } from '../shared/validation';
import logoUrl from '../assets/logo-mark.png';

type Route =
  | { name: 'home' }
  | { name: 'category'; category: ToolCategory }
  | { name: 'tool'; id: string }
  | { name: 'favorites' }
  | { name: 'history' }
  | { name: 'settings' };

function initialRoute(): Route {
  const id = new URLSearchParams(window.location.search).get('tool');
  if (id && getTool(id)) return { name: 'tool', id };
  return { name: 'home' };
}

const NAV_ICONS: Record<string, ReactNode> = {
  home: <IHome />,
  pdf: <IFileText />,
  images: <IImage />,
  video: <IVideo />,
  audio: <IAudio />,
  documents: <IDoc />,
  archives: <IArchive />,
  utilities: <IWrench />,
  favorites: <IStar />,
  history: <IClock />,
  settings: <IGear />,
  developer: <ICode />,
};

const CATEGORIES: ToolCategory[] = ['pdf', 'images', 'video', 'audio', 'documents', 'archives', 'utilities', 'developer'];

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-border bg-card/50 px-6 py-12 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10" aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-primary">
          <path d="M14 3H7a1 1 0 00-1 1v16a1 1 0 001 1h10a1 1 0 001-1V8l-4-5z" strokeLinejoin="round" />
          <path d="M14 3v5h4" strokeLinejoin="round" />
        </svg>
      </span>
      <p className="mx-auto mt-3 max-w-xs text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

export function DashboardApp() {
  const tt = useT();
  const [route, setRoute] = useState<Route>(initialRoute);
  const [query, setQuery] = useState('');
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Press "/" to search, Ctrl/⌘+K for the command palette (ignored while typing).
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el) return;
      const typing = ['INPUT', 'TEXTAREA'].includes(el.tagName) || el.isContentEditable;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(true);
        return;
      }
      if (e.key === '/' && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, []);

  useEffect(() => {
    void (async () => {
      const s = await getSettings();
      if (getLanguage() !== s.language) setLanguage(s.language);
      applyTheme(s.theme);
      setSettings(s);
      setFavorites(await getFavorites());
      setHistory(await getHistory());
      setRecent(await getRecentTools());
      setReady(true);
    })();
  }, []);

  const updateSettings = (next: Settings) => {
    setSettings(next);
    applyTheme(next.theme);
    if (getLanguage() !== next.language) setLanguage(next.language);
    void saveSettings(next);
  };

  const refreshHistory = useCallback(() => {
    void getHistory().then(setHistory);
    void getRecentTools().then(setRecent);
  }, []);

  const onToggleFav = (id: string) => {
    void toggleFavorite(id).then(setFavorites);
  };

  if (!ready) return <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">WinKit…</div>;

  const go = (r: Route) => {
    setRoute(r);
    setQuery('');
  };

  const results = query.trim() ? searchTools(query, t) : null;
  const favTools = favorites.map(getTool).filter((x): x is NonNullable<typeof x> => !!x);
  const recentTools = recent.map(getTool).filter((x): x is NonNullable<typeof x> => !!x);

  const isCat = (c: ToolCategory) => route.name === 'category' && route.category === c;
  const nav: { key: string; label: string; route: Route; active: boolean }[] = [
    { key: 'home', label: tt('nav.home'), route: { name: 'home' }, active: route.name === 'home' },
    ...CATEGORIES.map((c) => ({
      key: c,
      label: tt(`nav.${c}`),
      route: { name: 'category', category: c } as Route,
      active: isCat(c),
    })),
    { key: 'favorites', label: tt('nav.favorites'), route: { name: 'favorites' }, active: route.name === 'favorites' },
    { key: 'history', label: tt('nav.history'), route: { name: 'history' }, active: route.name === 'history' },
    { key: 'settings', label: tt('nav.settings'), route: { name: 'settings' }, active: route.name === 'settings' },
  ];

  const toolHeader = (id: string) => {
    const tool = getTool(id)!;
    const fav = favorites.includes(id);
    return (
      <div className="mb-4 flex items-center gap-3">
        <button onClick={() => go({ name: 'category', category: tool.category })} className="flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label={tt('nav.back')}>
          <IArrowLeft size={15} />
          <span className="hidden sm:inline">{tt('nav.back')}</span>
        </button>
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
          <ToolIcon category={tool.category} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-bold">{tt(tool.nameKey)}</h2>
          <p className="truncate text-xs text-muted-foreground">{tt(tool.descKey)}</p>
        </div>
        <FavoriteStar active={fav} onToggle={() => onToggleFav(id)} label={fav ? tt('fav.remove') : tt('fav.add')} />
      </div>
    );
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar (PRD §12) */}
      <aside className="hidden w-52 shrink-0 flex-col border-r border-border bg-card/60 p-3 backdrop-blur md:flex">
        <div className="mb-3 flex items-center gap-2.5 px-1.5 pt-1">
          <img src={logoUrl} alt="WinKit" className="h-9 w-9 rounded-xl" />
          <div>
            <p className="text-sm font-extrabold leading-tight tracking-tight">WinKit</p>
            <p className="text-[10px] font-bold tracking-wider text-muted-foreground">BENCH · v0.1.0</p>
          </div>
        </div>
        <nav className="space-y-0.5" aria-label="main">
          {nav.map((n) => (
            <button
              key={n.key}
              onClick={() => go(n.route)}
              aria-current={n.active ? 'page' : undefined}
              className={`flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-all duration-150 active:scale-[0.98] ${
                n.active
                  ? 'bg-primary font-bold text-white'
                  : 'font-medium text-muted-foreground hover:translate-x-0.5 hover:bg-muted hover:text-foreground'
              }`}
            >
              <span className="w-4 text-center" aria-hidden="true">{NAV_ICONS[n.key]}</span>
              {n.label}
            </button>
          ))}
        </nav>
        <div className="mt-auto px-1.5 pb-1 pt-4">
          <p className="wk-mono wk-nums text-[10px] font-bold text-muted-foreground">{history.length} JOBS · {favorites.length} PINNED</p>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
          <div className="mx-auto flex w-full max-w-3xl items-center gap-2 px-6 py-3">
            <div className="min-w-0 flex-1">
              <SearchBar value={query} onChange={setQuery} inputRef={searchRef} hint />
            </div>
            <button
              onClick={() => setPaletteOpen(true)}
              aria-label="open command palette"
              className="flex h-[42px] shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-xs font-bold text-muted-foreground shadow-sm transition-all duration-150 hover:-translate-y-px hover:text-foreground hover:shadow-md"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M8 6l-5 6 5 6M16 6l5 6-5 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[11px] font-bold">Ctrl+K</kbd>
            </button>
          </div>
        </header>
        {/* Mobile rail: same destinations, horizontal scroll (sidebar is md+) */}
        <nav className="flex gap-1.5 overflow-x-auto border-b border-border bg-card/60 px-4 py-2 md:hidden" aria-label="main">
          {nav.map((n) => (
            <button
              key={n.key}
              onClick={() => go(n.route)}
              aria-current={n.active ? 'page' : undefined}
              className={`flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                n.active ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
              }`}
            >
              <span className="flex items-center" aria-hidden="true">{NAV_ICONS[n.key]}</span>
              {n.label}
            </button>
          ))}
        </nav>

        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6">
          {results !== null ? (
            <div className="space-y-2">
              {results.length === 0 && <Empty text={tt('home.noResults', { q: query })} />}
              {results.map((tool) => (
                <ToolCard
                  key={tool.id}
                  tool={tool}
                  onOpen={() => go({ name: 'tool', id: tool.id })}
                  trailing={
                    <FavoriteStar
                      active={favorites.includes(tool.id)}
                      onToggle={() => onToggleFav(tool.id)}
                      label={tt('fav.add')}
                    />
                  }
                />
              ))}
            </div>
          ) : route.name === 'home' ? (
            <div className="space-y-6">
              <div className="wk-readout relative overflow-hidden rounded-2xl p-6">
                <h2 className="relative text-2xl font-extrabold tracking-tight text-white">
                  {tt(greetingKey())}
                </h2>
                <p className="relative mt-1 text-sm text-white/70">{tt('home.question')}</p>
                <div className="relative mt-4 flex gap-5 text-xs font-semibold">
                  <span><span className="wk-mono wk-nums text-base font-bold text-white">{visibleTools().length}</span> <span className="text-white/60">{t('common.tools')}</span></span>
                  <span><span className="wk-mono wk-nums text-base font-bold text-white">{history.length}</span> <span className="text-white/60">{tt('nav.history').toLowerCase()}</span></span>
                  <span><span className="wk-mono wk-nums text-base font-bold text-white">{favorites.length}</span> <span className="text-white/60">{tt('nav.favorites').toLowerCase()}</span></span>
                </div>
              </div>
              <section>
                <h3 className="mb-2 text-sm font-bold">{tt('common.popular')}</h3>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {POPULAR_TOOL_IDS.map((id) => {
                    const tool = getTool(id)!;
                    return (
                      <button
                        key={id}
                        onClick={() => go({ name: 'tool', id })}
                        className="group cursor-pointer rounded-xl border border-border bg-card p-3 text-left shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-primary/50 hover:shadow-md active:translate-y-0"
                      >
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 transition-colors duration-200 group-hover:bg-primary/20">
                          <ToolIcon category={tool.category} />
                        </span>
                        <span className="mt-1.5 block text-xs font-extrabold">{tt(tool.nameKey)}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
              <section>
                <h3 className="mb-2 text-sm font-bold">{tt('common.categories')}</h3>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c}
                      onClick={() => go({ name: 'category', category: c })}
                      className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition-all duration-200 hover:-translate-y-px hover:shadow-md"
                    >
                      <ToolIcon category={c} />
                      <span className="text-sm font-bold">{tt(`nav.${c}`)}</span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {visibleTools().filter((x) => x.category === c).length}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
              {recentTools.length > 0 && (
                <>
                  <button
                    onClick={() => go({ name: 'tool', id: recentTools[0].id })}
                    className="group flex w-full cursor-pointer items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-md"
                  >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white"><IRotateCw /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] font-extrabold uppercase tracking-wider text-primary">{t('common.continue')}</span>
                      <span className="block truncate text-sm font-bold">{tt(recentTools[0].nameKey)}</span>
                    </span>
                    <span className="shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-1 group-hover:text-primary" aria-hidden="true"><IArrowRight /></span>
                  </button>
                  <section>
                    <h3 className="mb-2 text-sm font-bold">{tt('common.recent')}</h3>
                    <div className="space-y-2">
                      {recentTools.slice(0, 5).map((tool) => (
                        <ToolCard key={tool.id} tool={tool} onOpen={() => go({ name: 'tool', id: tool.id })} />
                      ))}
                    </div>
                  </section>
                </>
              )}
            </div>
          ) : route.name === 'category' ? (
            <div className="space-y-2">
              <h2 className="mb-3 text-lg font-bold">{tt(`nav.${route.category}`)}</h2>
              {visibleTools().filter((x) => x.category === route.category).map((tool) => (
                <ToolCard
                  key={tool.id}
                  tool={tool}
                  onOpen={() => go({ name: 'tool', id: tool.id })}
                  trailing={
                    <FavoriteStar
                      active={favorites.includes(tool.id)}
                      onToggle={() => onToggleFav(tool.id)}
                      label={tt('fav.add')}
                    />
                  }
                />
              ))}
            </div>
          ) : route.name === 'tool' ? (
            <div>
              {toolHeader(route.id)}
              {(() => {
                const tool = getTool(route.id)!;
                if (tool.kind === 'text') return <TextRunner tool={tool} onHistoryChange={refreshHistory} />;
                if (tool.id === 'image-info') return <ImageInfoRunner onHistoryChange={refreshHistory} />;
                return (
                  <ToolRunner
                    tool={tool}
                    settings={settings}
                    onHistoryChange={refreshHistory}
                    onPickTool={(id, f) => {
                      setPendingFiles(f);
                      go({ name: 'tool', id });
                    }}
                  />
                );
              })()}
            </div>
          ) : route.name === 'favorites' ? (
            <div className="space-y-2">
              <h2 className="mb-3 text-lg font-bold">{tt('nav.favorites')}</h2>
              {favTools.length === 0 && <Empty text={tt('home.emptyFavorites')} />}
              {favTools.map((tool) => (
                <ToolCard
                  key={tool.id}
                  tool={tool}
                  onOpen={() => go({ name: 'tool', id: tool.id })}
                  trailing={<FavoriteStar active onToggle={() => onToggleFav(tool.id)} label={tt('fav.remove')} />}
                />
              ))}
            </div>
          ) : route.name === 'history' ? (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-bold">{tt('nav.history')}</h2>
                {history.length > 0 && (
                  <button
                    onClick={() => {
                      void clearHistory().then(() => setHistory([]));
                    }}
                    className="cursor-pointer rounded-lg px-2 py-1 text-xs text-muted-foreground hover:text-destructive"
                  >
                    {tt('hist.clear')}
                  </button>
                )}
              </div>
              {history.length === 0 && <Empty text={tt('home.emptyHistory')} />}
              <ul className="space-y-2">
                {history.map((h) => (
                  <li key={h.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{getTool(h.toolId) ? tt(getTool(h.toolId)!.nameKey) : h.toolId}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {h.fileName} · <span className="wk-mono wk-nums">{formatBytes(h.size)}</span> · {h.outputFormat.toUpperCase()} ·{' '}
                        <time dateTime={new Date(h.date).toISOString()} className="wk-nums">
                          {new Date(h.date).toLocaleString(getLanguage() === 'id' ? 'id-ID' : 'en-US')}
                        </time>
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        h.status === 'completed' ? 'bg-primary/10 text-primary' : h.status === 'failed' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {tt(`status.${h.status}`)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="max-w-xl space-y-5">
              <h2 className="text-lg font-bold">{tt('nav.settings')}</h2>
              <section className="rounded-xl border border-border bg-card p-4">
                <h3 className="mb-3 text-sm font-bold">{tt('set.general')}</h3>
                <div className="space-y-3">
                  <Segmented
                    label={tt('set.theme')}
                    value={settings.theme}
                    onChange={(v) => updateSettings({ ...settings, theme: v })}
                    options={[
                      { value: 'system', label: tt('common.system') },
                      { value: 'light', label: tt('common.light') },
                      { value: 'dark', label: tt('common.dark') },
                    ]}
                  />
                  <Segmented
                    label={tt('set.language')}
                    value={settings.language}
                    onChange={(v) => updateSettings({ ...settings, language: v })}
                    options={[
                      { value: 'en', label: 'English' },
                      { value: 'id', label: 'Indonesia' },
                    ]}
                  />
                  <Checkbox
                    checked={settings.notifications}
                    onChange={(v) => updateSettings({ ...settings, notifications: v })}
                    label="Notifications"
                  />
                  <Checkbox
                    checked={settings.animations}
                    onChange={(v) => updateSettings({ ...settings, animations: v })}
                    label="Animations"
                  />
                </div>
              </section>
              <section className="rounded-xl border border-border bg-card p-4">
                <h3 className="mb-3 text-sm font-bold">{tt('set.processing')}</h3>
                <div className="space-y-3 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={settings.preferLocal}
                      onChange={(e) => updateSettings({ ...settings, preferLocal: e.target.checked })}
                      className="h-4 w-4 accent-[#002bcd]"
                    />
                    {tt('set.preferLocal')}
                  </label>
                  <label className="block">
                    <span className="mb-1 block font-medium">
                      {tt('set.workers')}: <span className="wk-mono wk-nums font-bold text-primary">{settings.workers}</span>
                    </span>
                    <input
                      type="range"
                      min={1}
                      max={4}
                      value={settings.workers}
                      onChange={(e) => updateSettings({ ...settings, workers: Number(e.target.value) })}
                      className="w-full accent-[#002bcd]"
                    />
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={settings.askBeforeCloud}
                      onChange={(e) => updateSettings({ ...settings, askBeforeCloud: e.target.checked })}
                      className="h-4 w-4 accent-[#002bcd]"
                    />
                    {tt('set.askCloud')}
                  </label>
                </div>
              </section>
              <section className="rounded-xl border border-border bg-card p-4">
                <h3 className="mb-2 text-sm font-bold">{tt('set.privacy')}</h3>
                <p className="text-xs text-muted-foreground">{tt('set.localNote')}</p>
              </section>
              <section className="rounded-xl border border-border bg-card p-4">
                <h3 className="mb-3 text-sm font-bold">{tt('set.cloud')}</h3>
                <div className="space-y-3">
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium">{tt('set.cloudUrl')}</span>
                    <input
                      type="url"
                      value={settings.cloudUrl}
                      placeholder="http://127.0.0.1:8787"
                      onChange={(e) => updateSettings({ ...settings, cloudUrl: e.target.value })}
                      className="w-full rounded-lg border border-border bg-card px-3 py-2 font-mono text-xs outline-none transition-colors focus:border-primary"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium">{tt('set.cloudKey')}</span>
                    <input
                      type="password"
                      value={settings.cloudKey}
                      onChange={(e) => updateSettings({ ...settings, cloudKey: e.target.value })}
                      className="w-full rounded-lg border border-border bg-card px-3 py-2 font-mono text-xs outline-none transition-colors focus:border-primary"
                    />
                  </label>
                  <p className="text-xs text-muted-foreground">{tt('set.cloudNote')}</p>
                </div>
              </section>
              <section className="rounded-xl border border-border bg-card p-4">
                <h3 className="mb-2 text-sm font-bold">{tt('set.about')}</h3>
                <p className="text-xs text-muted-foreground">
                  WinKit v0.1.0 · {tt('set.version')} 0.1.0
                </p>
                <button
                  onClick={() => {
                    const d = DEFAULT_SETTINGS;
                    updateSettings(d);
                  }}
                  className="mt-2 cursor-pointer rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:border-destructive hover:text-destructive"
                >
                  {tt('common.reset')}
                </button>
              </section>
            </div>
          )}
        </main>
      </div>
      {paletteOpen && (
        <CmdPalette
          recentIds={recent}
          onPick={(id) => go({ name: 'tool', id })}
          onClose={() => setPaletteOpen(false)}
        />
      )}
    </div>
  );
}
