import { useEffect, useState } from 'react';
import { SearchBar, ToolIcon } from '../components/ui';
import { IArrowRight } from '../components/icons';
import { getLanguage, setLanguage, t, useT } from '../shared/i18n';
import { getRecentTools, getSettings } from '../shared/storage';
import { openDashboard } from '../shared/theme';
import logoUrl from '../assets/logo-mark.png';
import { POPULAR_TOOL_IDS, TOOLS, getTool, searchTools } from '../shared/tools';

export function PopupApp() {
  const tt = useT();
  const [query, setQuery] = useState('');
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    void getSettings().then((s) => {
      if (getLanguage() !== s.language) setLanguage(s.language);
    });
    void getRecentTools().then(setRecent);
  }, []);

  const results = query.trim() ? searchTools(query, t) : [];
  const recentTools = recent.map(getTool).filter((x): x is NonNullable<typeof x> => !!x);

  return (
    <div className="w-[360px] bg-background p-4 text-foreground">
      <header className="mb-3 flex items-center gap-2.5">
        <img src={logoUrl} alt="WinKit" className="h-9 w-9 rounded-xl" />
        <div>
          <h1 className="text-sm font-extrabold leading-tight tracking-tight">WinKit</h1>
          <p className="text-[10px] font-bold tracking-wider text-muted-foreground">BENCH · {TOOLS.length} TOOLS</p>
        </div>
      </header>

      <SearchBar value={query} onChange={setQuery} autoFocus />

      {query.trim() ? (
        <div className="mt-3 max-h-64 space-y-1.5 overflow-auto">
          {results.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">{tt('home.noResults', { q: query })}</p>}
          {results.map((tool) => (
            <button
              key={tool.id}
              onClick={() => openDashboard(tool.id)}
              className="flex w-full cursor-pointer items-center gap-2 rounded-lg border border-border bg-card p-2 text-left hover:border-primary/60"
            >
              <ToolIcon category={tool.category} />
              <span className="text-xs font-semibold">{tt(tool.nameKey)}</span>
            </button>
          ))}
        </div>
      ) : (
        <>
          <p className="mb-2 mt-3 text-xs font-semibold text-muted-foreground">{tt('common.quickTools')}</p>
          <div className="grid grid-cols-2 gap-2">
            {POPULAR_TOOL_IDS.map((id) => {
              const tool = getTool(id)!;
              return (
                <button
                  key={id}
                  onClick={() => openDashboard(id)}
                  className="group cursor-pointer rounded-xl border border-border bg-card p-2.5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-md active:translate-y-0"
                >
                  <ToolIcon category={tool.category} />
                  <span className="mt-1 block text-xs font-bold">{tt(tool.nameKey)}</span>
                </button>
              );
            })}
          </div>

          {recentTools.length > 0 && (
            <>
              <p className="mb-2 mt-3 text-xs font-semibold text-muted-foreground">{tt('common.recent')}</p>
              <div className="space-y-1">
                {recentTools.slice(0, 3).map((tool) => (
                  <button
                    key={tool.id}
                    onClick={() => openDashboard(tool.id)}
                    className="w-full cursor-pointer truncate rounded-lg px-2 py-1.5 text-left text-xs hover:bg-muted"
                  >
                    {tt(tool.nameKey)}
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}

      <button
        onClick={() => openDashboard()}
        className="mt-3 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-black transition-all duration-200 hover:-translate-y-px hover:opacity-90 active:translate-y-0"
      >
        {tt('app.openDashboard')} <IArrowRight size={15} />
      </button>
      <p className="wk-mono wk-nums mt-2 text-center text-[10px] font-bold text-muted-foreground">{tt('common.tools')}: {TOOLS.length} · v0.1.0</p>
    </div>
  );
}
