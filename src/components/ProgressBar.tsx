interface Props {
  percent: number;
  label?: string;
}

/** Progress UI (PRD §29). */
export function ProgressBar({ percent, label }: Props) {
  const p = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div className="w-full">
      {label && <p className="mb-1 text-xs text-muted-foreground" role="status">{label}</p>}
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={p} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-primary transition-[width] duration-200" style={{ width: `${p}%` }} />
      </div>
      <div className="wk-ticks mt-1 h-2 opacity-50" aria-hidden="true" />
      <p className="wk-mono wk-nums mt-0.5 text-right text-xs font-bold text-primary">{p}%</p>
    </div>
  );
}
