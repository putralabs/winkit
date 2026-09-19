import { useEffect, useMemo, useRef, useState } from 'react';
import { t as translate, useT } from '../shared/i18n';
import { isExtension } from '../shared/platform';
import { getTool, searchTools, visibleTools } from '../shared/tools';

/** Command palette: fuzzy-find any tool from the keyboard (Ctrl/⌘+K). */
export function CmdPalette({
  recentIds,
  onPick,
  onClose,
}: {
  recentIds: string[];
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const t = useT();

  const recent = useMemo(
    () =>
      recentIds
        .map(getTool)
        .filter((x): x is NonNullable<typeof x> => !!x && (!x.webOnly || !isExtension()))
        .slice(0, 4),
    [recentIds],
  );
  const results = useMemo(() => {
    if (!query.trim()) return recent;
    return searchTools(query, translate).slice(0, 9);
  }, [query, recent]);

  useEffect(() => {
    setCursor(0);
  }, [results.length, query]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const el = listRef.current?.children[cursor] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  const choose = (id: string) => {
    onPick(id);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/45 p-4 pt-[14vh]"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="wk-pop w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('palette.label')}
      >
        <div className="flex items-center gap-2 border-b border-border px-4">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-muted-foreground" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setCursor((c) => Math.min(results.length - 1, c + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setCursor((c) => Math.max(0, c - 1));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                const hit = results[cursor];
                if (hit) choose(hit.id);
              } else if (e.key === 'Escape') {
                onClose();
              }
            }}
            placeholder={t('palette.searchPh')}
            aria-label={t('palette.searchPh')}
            className="w-full bg-transparent py-3.5 text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="shrink-0 rounded-md border border-border bg-muted px-1.5 py-0.5 text-[11px] font-bold text-muted-foreground">esc</kbd>
        </div>
        {results.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">{t('palette.empty', { q: query })}</p>
        ) : (
          <ul ref={listRef} className="max-h-72 overflow-auto p-2" role="listbox" aria-label={t('palette.label')}>
            {query.trim() === '' && recent.length > 0 && (
              <li className="px-2 pb-1 pt-2 text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground" aria-hidden="true">
                {t('palette.recent')}
              </li>
            )}
            {results.map((tool, i) => (
              <li key={tool.id} role="option" aria-selected={i === cursor}>
                <button
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => choose(tool.id)}
                  className={`flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors duration-100 ${
                    i === cursor ? 'bg-primary text-white' : 'hover:bg-muted'
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{translate(tool.nameKey)}</span>
                    <span className={`block truncate text-xs ${i === cursor ? 'text-white/70' : 'text-muted-foreground'}`}>
                      {translate(tool.descKey)}
                    </span>
                  </span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${i === cursor ? 'bg-white/20' : 'bg-muted text-muted-foreground'}`}>
                    {tool.category}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-3 border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
          <span><kbd className="font-bold">Up/Down</kbd> {t('palette.move')}</span>
          <span><kbd className="font-bold">Enter</kbd> {t('palette.open')}</span>
          <span className="wk-mono wk-nums ml-auto">{visibleTools().length} {t('common.tools')}</span>
        </div>
      </div>
    </div>
  );
}
