import { createWorker } from 'tesseract.js';
import type { CancelToken, OutputFile, Progress } from '../shared/types';
import { baseName } from '../shared/validation';
import { renderPdf } from './pdf';

/**
 * Image → Text via Tesseract OCR (local inference; language data downloads
 * once on first use, then works offline).
 */
export async function ocrImage(
  file: File,
  lang: 'eng' | 'ind',
  token: CancelToken,
  onProgress: (p: Progress) => void,
): Promise<OutputFile> {
  // Language data downloads from CDN once, then the browser caches it.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new Error('offline');
  onProgress({ done: 0, total: 100 });
  const worker = await createWorker(lang, 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') {
        onProgress({ done: Math.round(m.progress * 100), total: 100 });
      }
    },
  });
  try {
    if (token.cancelled) throw new Error('cancelled');
    const {
      data: { text },
    } = await worker.recognize(file);
    if (token.cancelled) throw new Error('cancelled');
    const blob = new Blob([text.trim() + '\n'], { type: 'text/plain;charset=utf-8' });
    onProgress({ done: 100, total: 100 });
    return { name: `${baseName(file.name)}.ocr.txt`, blob, size: blob.size };
  } finally {
    await worker.terminate();
  }
}

/** PDF → Text via OCR: render each page, then recognize (local, slower but thorough). */
export async function pdfOcrText(
  file: File,
  lang: 'eng' | 'ind',
  token: CancelToken,
  onProgress: (p: Progress) => void,
): Promise<OutputFile> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new Error('offline');
  const pages = await renderPdf(file, { format: 'png', quality: 90, scale: 2, fromPage: null, toPage: null }, token, (p) =>
    onProgress({ done: p.done, total: p.total * 2 }),
  );
  const parts: string[] = [];
  for (let i = 0; i < pages.length; i++) {
    if (token.cancelled) throw new Error('cancelled');
    const pageFile = new File([pages[i].blob], pages[i].name, { type: 'image/png' });
    const r = await ocrImage(pageFile, lang, token, (p) =>
      onProgress({ done: pages.length + i + p.done / 100, total: pages.length * 2 }),
    );
    parts.push(`--- Page ${i + 1} ---\n${await r.blob.text()}`);
  }
  const blob = new Blob([parts.join('\n\n')], { type: 'text/plain;charset=utf-8' });
  onProgress({ done: 1, total: 1 });
  return { name: `${baseName(file.name)}.ocr.txt`, blob, size: blob.size, pages: pages.length };
}
