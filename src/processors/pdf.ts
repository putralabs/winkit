import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';
import type { CancelToken, OutputFile, PdfImageFormat, PdfRenderOptions, Progress } from '../shared/types';
import { baseName } from '../shared/validation';

// pdf.js ships its own worker; in the extension bundle we prefer a bundled
// worker port and fall back to the main-thread (fake) worker.
let pdfjs: typeof import('pdfjs-dist') | null = null;

async function ensurePdfJs(): Promise<typeof import('pdfjs-dist')> {
  if (pdfjs) return pdfjs;
  const lib = await import('pdfjs-dist');
  try {
    const mod = await import('pdfjs-dist/build/pdf.worker.min.mjs?worker');
    const WorkerFactory = (mod as { default: new () => Worker }).default;
    lib.GlobalWorkerOptions.workerPort = new WorkerFactory();
  } catch {
    // No bundled worker (e.g. restrictive CSP): pdf.js falls back to the
    // main-thread fake worker. Slower, but fully local and functional.
  }
  pdfjs = lib;
  return lib;
}

export async function getPdfPageCount(file: File): Promise<number> {
  const lib = await ensurePdfJs();
  const data = new Uint8Array(await file.arrayBuffer());
  let pdf;
  try {
    pdf = await lib.getDocument({ data }).promise;
  } catch (e) {
    if (isPasswordError(e)) throw new Error('encrypted');
    throw e;
  }
  const n = pdf.numPages;
  await pdf.destroy();
  return n;
}

function isPasswordError(e: unknown): boolean {
  const err = e as { name?: string; message?: string };
  return err?.name === 'PasswordException' || /encrypt|password/i.test(err?.message ?? '');
}

/** pdf-lib load that reports password-protected files honestly. */
export async function loadPdfDoc(data: Uint8Array | ArrayBuffer, options?: { ignoreEncryption?: boolean }) {
  try {
    return await PDFDocument.load(data, options as { ignoreEncryption: boolean });
  } catch (e) {
    if (isPasswordError(e)) throw new Error('encrypted');
    throw e;
  }
}

function renderToBlob(
  canvas: HTMLCanvasElement,
  format: PdfImageFormat,
  quality: number,
): Promise<Blob> {
  const mime = format === 'jpg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('encode'))),
      mime,
      format === 'png' ? undefined : quality / 100,
    );
  });
}

/** Render PDF pages to images. Cancellable between pages; releases buffers per page. */
export async function renderPdf(
  file: File,
  opts: PdfRenderOptions,
  token: CancelToken,
  onProgress: (p: Progress) => void,
): Promise<OutputFile[]> {
  const lib = await ensurePdfJs();
  const data = new Uint8Array(await file.arrayBuffer());
  let pdf;
  try {
    pdf = await lib.getDocument({ data }).promise;
  } catch (e) {
    if (isPasswordError(e)) throw new Error('encrypted');
    throw e;
  }
  const total = pdf.numPages;
  const from = Math.max(1, opts.fromPage ?? 1);
  const to = Math.min(total, opts.toPage ?? total);
  if (from > to) {
    await pdf.destroy();
    throw new Error('range');
  }
  const out: OutputFile[] = [];
  try {
    for (let pageNum = from; pageNum <= to; pageNum++) {
      if (token.cancelled) throw new Error('cancelled');
      onProgress({ done: pageNum - from, total: to - from + 1, messageKey: 'proc.renderingPage', messageParams: { done: pageNum, total } });
      const page = await pdf.getPage(pageNum);
      try {
        const viewport = page.getViewport({ scale: opts.scale });
        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('encode');
        if (opts.format === 'jpg') {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        await page.render({ canvasContext: ctx, viewport }).promise;
        const blob = await renderToBlob(canvas, opts.format, opts.quality);
        const idx = String(pageNum).padStart(2, '0');
        out.push({
          name: `${baseName(file.name)}-page-${idx}.${opts.format}`,
          blob,
          size: blob.size,
          width: canvas.width,
          height: canvas.height,
          pages: total,
        });
        canvas.width = 0;
        canvas.height = 0;
      } finally {
        page.cleanup();
      }
      onProgress({ done: pageNum - from + 1, total: to - from + 1 });
    }
    return out;
  } finally {
    await pdf.destroy();
  }
}

/** Merge multiple PDFs in the given order. */
export async function mergePdfs(
  files: File[],
  token: CancelToken,
  onProgress: (p: Progress) => void,
): Promise<OutputFile> {
  const merged = await PDFDocument.create();
  for (let i = 0; i < files.length; i++) {
    if (token.cancelled) throw new Error('cancelled');
    onProgress({ done: i, total: files.length, messageKey: 'proc.merging' });
    const src = await loadPdfDoc(await files[i].arrayBuffer(), { ignoreEncryption: false });
    const pages = await merged.copyPages(src, src.getPageIndices());
    for (const p of pages) merged.addPage(p);
    onProgress({ done: i + 1, total: files.length, messageKey: 'proc.merging' });
  }
  const bytes = await merged.save();
  const blob = new Blob([bytes.slice().buffer as ArrayBuffer], { type: 'application/pdf' });
  return { name: `${baseName(files[0].name)}-merged.pdf`, blob, size: blob.size, pages: merged.getPageCount() };
}

/** Extract [from, to] (1-based, inclusive) into a new PDF. */
export async function splitPdf(
  file: File,
  from: number,
  to: number,
  token: CancelToken,
): Promise<OutputFile> {
  if (token.cancelled) throw new Error('cancelled');
  const src = await loadPdfDoc(await file.arrayBuffer());
  const total = src.getPageCount();
  const f = Math.max(1, Math.floor(from));
  const t = Math.min(total, Math.floor(to));
  if (f > t) throw new Error('range');
  const out = await PDFDocument.create();
  const indices = Array.from({ length: t - f + 1 }, (_, i) => f - 1 + i);
  const pages = await out.copyPages(src, indices);
  for (const p of pages) out.addPage(p);
  const bytes = await out.save();
  const blob = new Blob([bytes.slice().buffer as ArrayBuffer], { type: 'application/pdf' });
  return { name: `${baseName(file.name)}-p${f}-${t}.pdf`, blob, size: blob.size, pages: indices.length };
}

export const PDF_RENDER_SCALE: Record<'low' | 'medium' | 'high', number> = {
  low: 1,
  medium: 1.5,
  high: 2,
};

/** Add a diagonal text watermark to every page (local, pdf-lib). */
export async function watermarkPdf(
  file: File,
  text: string,
  opacity: number,
  token: CancelToken,
  onProgress: (p: Progress) => void,
): Promise<OutputFile> {
  const src = await loadPdfDoc(await file.arrayBuffer());
  if (token.cancelled) throw new Error('cancelled');
  const font = await src.embedFont(StandardFonts.HelveticaBold);
  const pages = src.getPages();
  for (let i = 0; i < pages.length; i++) {
    if (token.cancelled) throw new Error('cancelled');
    onProgress({ done: i, total: pages.length });
    const page = pages[i];
    const { width, height } = page.getSize();
    const size = Math.min(width, height) / 8;
    const tw = font.widthOfTextAtSize(text, size);
    page.drawText(text, {
      x: width / 2 - tw / 2,
      y: height / 2,
      size,
      font,
      color: rgb(0.55, 0.55, 0.55),
      opacity: Math.max(0.05, Math.min(0.8, opacity)),
      rotate: degrees(-45),
    });
    onProgress({ done: i + 1, total: pages.length });
  }
  const bytes = await src.save({ useObjectStreams: true });
  const blob = new Blob([bytes.slice().buffer as ArrayBuffer], { type: 'application/pdf' });
  return { name: `${baseName(file.name)}-watermarked.pdf`, blob, size: blob.size, pages: pages.length };
}

/** Optimize a PDF by re-saving with object streams (local; gains vary by file). */
export async function compressPdf(file: File, token: CancelToken): Promise<OutputFile> {
  const src = await loadPdfDoc(await file.arrayBuffer());
  if (token.cancelled) throw new Error('cancelled');
  const bytes = await src.save({ useObjectStreams: true });
  const blob = new Blob([bytes.slice().buffer as ArrayBuffer], { type: 'application/pdf' });
  return { name: `${baseName(file.name)}-optimized.pdf`, blob, size: blob.size, pages: src.getPageCount() };
}

export interface OrganizeOps {
  /** final page order as 0-based source indices (duplicates allowed, omissions = deleted) */
  order: number[];
  /** extra 90° clockwise turns per 0-based source index */
  rotations: Record<number, number>;
}

/**
 * Reorganize a PDF: reorder, delete (omit), duplicate (repeat), rotate pages.
 * Covers PRD §14.2 organization with one local pass (pdf-lib).
 */
export async function organizePdf(
  file: File,
  ops: OrganizeOps,
  token: CancelToken,
  onProgress: (p: Progress) => void,
): Promise<OutputFile> {
  const src = await loadPdfDoc(await file.arrayBuffer());
  if (token.cancelled) throw new Error('cancelled');
  const total = src.getPageCount();
  const order = ops.order.filter((i) => i >= 0 && i < total);
  if (order.length === 0) throw new Error('range');
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, order);
  for (let i = 0; i < pages.length; i++) {
    if (token.cancelled) throw new Error('cancelled');
    onProgress({ done: i, total: pages.length });
    const srcIdx = order[i];
    const base = src.getPage(srcIdx).getRotation().angle;
    const extra = ((ops.rotations[srcIdx] ?? 0) % 4 + 4) % 4;
    pages[i].setRotation(degrees((base + extra * 90) % 360));
    out.addPage(pages[i]);
    onProgress({ done: i + 1, total: pages.length });
  }
  const bytes = await out.save({ useObjectStreams: true });
  const blob = new Blob([bytes.slice().buffer as ArrayBuffer], { type: 'application/pdf' });
  return { name: `${baseName(file.name)}-organized.pdf`, blob, size: blob.size, pages: pages.length };
}
