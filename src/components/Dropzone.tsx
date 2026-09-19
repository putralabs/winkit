import { useRef, useState } from 'react';
import { useT } from '../shared/i18n';

interface Props {
  accept: string[];
  multiple: boolean;
  onFiles: (files: File[]) => void;
  compact?: boolean;
}

/** Drag & drop + file picker (PRD §25). */
export function Dropzone({ accept, multiple, onFiles, compact }: Props) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState(false);
  const depthRef = useRef(0);

  const pick = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    onFiles(multiple ? Array.from(list) : [list[0]]);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={t('drop.title')}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        depthRef.current += 1;
        setActive(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={(e) => {
        e.preventDefault();
        depthRef.current = Math.max(0, depthRef.current - 1);
        if (depthRef.current === 0) setActive(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        depthRef.current = 0;
        setActive(false);
        pick(e.dataTransfer.files);
      }}
      className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed text-center transition-all duration-200 ${
        compact ? 'px-4 py-6' : 'px-6 py-10'
      } ${
        active
          ? 'scale-[1.02] border-primary bg-primary/10'
          : 'border-border bg-card hover:border-primary/60'
      }`}
    >
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="mb-2 text-primary" aria-hidden="true">
        <path d="M12 16V4m0 0l-4 4m4-4l4 4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" strokeLinecap="round" />
      </svg>
      <p className="text-sm font-semibold">{active ? t('drop.active') : t('drop.title')}</p>
      <p className="mt-1 text-xs text-muted-foreground">{t('drop.or')}</p>
      <span className="mt-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-black transition-opacity duration-200 hover:opacity-90">
        {t('drop.browse')}
      </span>
      <p className="mt-2 text-[11px] text-muted-foreground">{t('drop.hint')} · {accept.join(', ')}</p>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={accept.join(',')}
        multiple={multiple}
        onChange={(e) => {
          pick(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}
