import { useState } from 'react';
import { Dropzone } from './Dropzone';
import { useT } from '../shared/i18n';
import { downloadBlob } from '../shared/download';
import { recordStatus } from '../shared/storage';
import { formatBytes } from '../shared/validation';
import { inspectImage, type ImageInfo } from '../processors/image-info';

/** Image information viewer (PRD §15.4) - inspect, don't convert. */
export function ImageInfoRunner({ onHistoryChange }: { onHistoryChange: () => void }) {
  const t = useT();
  const [info, setInfo] = useState<ImageInfo | null>(null);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState(false);

  const run = async (files: File[]) => {
    const file = files[0];
    setFileName(file.name);
    setError(false);
    try {
      const data = await inspectImage(file);
      setInfo(data);
      await recordStatus('image-info', file.name, 'completed', file.size, 'info');
    } catch {
      setInfo(null);
      setError(true);
      await recordStatus('image-info', file.name, 'failed', file.size, 'info');
    }
    onHistoryChange();
  };

  const report = () => {
    if (!info) return;
    const lines = [
      `${t('hist.file')}: ${info.name}`,
      `${t('hist.file')} size: ${formatBytes(info.size)}`,
      `${t('info.dimensions')}: ${info.width}×${info.height}`,
      `${t('info.format')}: ${info.format}`,
      `${t('info.mime')}: ${info.mime}`,
      '',
      `${t('info.exif')}:`,
      ...info.exif.map((e) => `${e.tag}: ${e.value}`),
    ];
    void downloadBlob(new Blob([lines.join('\n')], { type: 'text/plain' }), `${info.name}.info.txt`);
  };

  if (!info && !error) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <Dropzone accept={['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp']} multiple={false} onFiles={run} />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-3">
      {error && (
        <div className="rounded-xl border border-destructive/40 bg-card p-4 text-center">
          <p className="text-sm text-destructive" role="alert">
            {fileName}: {t('err.corrupted')}
          </p>
          <button onClick={() => { setError(false); setInfo(null); }} className="mt-2 cursor-pointer rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">
            {t('common.tryAgain')}
          </button>
        </div>
      )}
      {info && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-3 truncate text-sm font-bold">{info.name}</p>
          <dl className="grid grid-cols-2 gap-2 text-xs">
            <dt className="text-muted-foreground">{t('hist.file')}</dt>
            <dd className="font-semibold">{formatBytes(info.size)}</dd>
            <dt className="text-muted-foreground">{t('info.dimensions')}</dt>
            <dd className="font-semibold">{info.width}×{info.height}</dd>
            <dt className="text-muted-foreground">{t('info.format')}</dt>
            <dd className="font-semibold">{info.format}</dd>
            <dt className="text-muted-foreground">{t('info.mime')}</dt>
            <dd className="font-semibold">{info.mime}</dd>
          </dl>
          <h4 className="mb-1 mt-4 text-sm font-bold">{t('info.exif')}</h4>
          {info.exif.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('info.noExif')}</p>
          ) : (
            <ul className="max-h-48 space-y-1 overflow-auto">
              {info.exif.map((e) => (
                <li key={e.tag} className="flex gap-2 rounded-lg bg-muted/60 px-2 py-1 text-xs">
                  <span className="shrink-0 font-semibold">{e.tag}</span>
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">{e.value}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex gap-2">
            <button onClick={report} className="flex-1 cursor-pointer rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-black transition-opacity hover:opacity-90">
              {t('info.downloadReport')}
            </button>
            <button onClick={() => setInfo(null)} className="cursor-pointer rounded-xl border border-border px-4 py-2.5 text-sm font-semibold">
              {t('common.tryAgain')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
