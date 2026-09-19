import type { ReactNode, Ref } from 'react';
import { useT } from '../shared/i18n';
import type { ToolDef } from '../shared/types';
import { IArrowRight, IStar, IStarLine } from './icons';

export function SearchBar({ value, onChange, autoFocus, inputRef, hint }: { value: string; onChange: (v: string) => void; autoFocus?: boolean; inputRef?: Ref<HTMLInputElement>; hint?: boolean }) {
  const t = useT();
  return (
    <div className="relative">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
      </svg>
      <input
        ref={inputRef}
        type="search"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('common.searchTools')}
        aria-label={t('common.searchTools')}
        className={`w-full rounded-xl border border-border bg-card py-2.5 pl-9 text-sm outline-none transition-all duration-200 placeholder:text-muted-foreground focus:border-primary focus:shadow-md focus:ring-2 focus:ring-primary/20 ${hint ? 'pr-9' : 'pr-3'}`}
      />
      {hint && (
        <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-border bg-muted px-1.5 py-0.5 text-[11px] font-bold text-muted-foreground" aria-hidden="true">
          /
        </kbd>
      )}
    </div>
  );
}

const CATEGORY_ICON: Record<string, ReactNode> = {
  pdf: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M14 3H7a1 1 0 00-1 1v16a1 1 0 001 1h10a1 1 0 001-1V8l-4-5z" strokeLinejoin="round" />
      <path d="M14 3v5h4" strokeLinejoin="round" />
    </svg>
  ),
  images: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="M4 18l5-5 3 3 3-3 5 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  video: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M10 9.5l5 2.5-5 2.5v-5z" strokeLinejoin="round" />
    </svg>
  ),
  audio: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M9 18V6l10-2v12" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="6.5" cy="18" r="2.5" />
      <circle cx="16.5" cy="16" r="2.5" />
    </svg>
  ),
  documents: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M6 3h9l4 4v14H6V3z" strokeLinejoin="round" />
      <path d="M9 12h7M9 15.5h7" strokeLinecap="round" />
    </svg>
  ),
  archives: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3" y="4" width="18" height="5" rx="1" />
      <path d="M5 9v10h14V9M10 13h4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  utilities: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M14.5 6.5a4 4 0 00-5.6 5L4 16.4V20h3.6l4.9-4.9a4 4 0 005-5.6l-2.8 2.8-2.4-.7-.7-2.4 2.9-2.7z" strokeLinejoin="round" />
    </svg>
  ),
  developer: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M8 6l-5 6 5 6M16 6l5 6-5 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

export function ToolIcon({ category }: { category: string }) {
  return <span className="text-primary">{CATEGORY_ICON[category] ?? CATEGORY_ICON.images}</span>;
}

export function ToolCard({ tool, onOpen, trailing }: { tool: ToolDef; onOpen: () => void; trailing?: ReactNode }) {
  const t = useT();
  return (
    <button
      onClick={onOpen}
      className="group flex w-full cursor-pointer items-center gap-3 rounded-xl border border-border bg-card p-3 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-md active:translate-y-0 active:scale-[0.99]"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 transition-colors duration-200 group-hover:bg-primary/20">
        <ToolIcon category={tool.category} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold">{t(tool.nameKey)}</span>
        <span className="block truncate text-xs text-muted-foreground">{t(tool.descKey)}</span>
      </span>
      {trailing}
      <span className="shrink-0 text-muted-foreground/60 transition-all duration-200 group-hover:translate-x-1 group-hover:text-primary" aria-hidden="true"><IArrowRight size={15} /></span>
    </button>
  );
}

export function FavoriteStar({ active, onToggle, label }: { active: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      aria-label={label}
      aria-pressed={active}
      className="cursor-pointer rounded p-1 text-lg leading-none transition-transform duration-150 hover:scale-110"
    >
      <span className={active ? 'text-accent' : 'text-muted-foreground/50'} aria-hidden="true">{active ? <IStar /> : <IStarLine />}</span>
    </button>
  );
}

export function ThemeToggle({ dark, onToggle, label }: { dark: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      onClick={onToggle}
      aria-label={label}
      aria-pressed={dark}
      className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-border bg-card text-muted-foreground shadow-sm transition-all duration-200 hover:-translate-y-px hover:text-foreground hover:shadow-md active:translate-y-0"
    >
      {dark ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4l1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" strokeLinecap="round" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M20 13A8 8 0 1111 4a6.5 6.5 0 009 9z" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

export function Steps({ current }: { current: number }) {
  const t = useT();
  const steps = [t('step.select'), t('step.configure'), t('step.process'), t('step.preview'), t('step.download')];
  return (
    <ol className="flex items-center gap-1" aria-label="progress">
      {steps.map((s, i) => (
        <li key={s} className="flex flex-1 items-center gap-1 last:flex-none" aria-current={i === current ? 'step' : undefined}>
          <span
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
              i < current ? 'bg-primary text-white' : i === current ? 'bg-accent text-black' : 'bg-muted text-muted-foreground'
            }`}
          >
            {i + 1}
          </span>
          <span className={`hidden text-[11px] sm:block ${i === current ? 'font-semibold' : 'text-muted-foreground'}`}>{s}</span>
          {i < steps.length - 1 && <span className="mx-1 h-px flex-1 bg-border" />}
        </li>
      ))}
    </ol>
  );
}

export function Slider({ value, min, max, onChange, label, unit = '%' }: { value: number; min: number; max: number; onChange: (v: number) => void; label: string; unit?: string }) {
  return (
    <label className="block">
      <span className="mb-1 flex justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="wk-mono wk-nums font-bold text-primary">{value}{unit}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[#002bcd]"
      />
    </label>
  );
}

export function Segmented<T extends string>({ options, value, onChange, label }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div>
      <p className="mb-1 text-sm font-medium">{label}</p>
      <div className="flex gap-1 rounded-lg bg-muted p-1" role="group" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            aria-pressed={value === o.value}
            className={`flex-1 cursor-pointer rounded-md px-2 py-1.5 text-xs font-semibold transition-all duration-150 ${
              value === o.value ? 'bg-card text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function NumberInput({ value, onChange, label, min }: { value: string; onChange: (v: string) => void; label: string; min?: number }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none transition-colors focus:border-primary"
      />
    </label>
  );
}

export function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-[#002bcd]" />
      {label}
    </label>
  );
}

export function TextInput({ value, onChange, label, placeholder }: { value: string; onChange: (v: string) => void; label: string; placeholder?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none transition-colors focus:border-primary"
      />
    </label>
  );
}
