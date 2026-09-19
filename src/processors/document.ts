import { Document, Packer, Paragraph, TextRun } from 'docx';
import { jsPDF } from 'jspdf';
import * as mammoth from 'mammoth';
import type { CancelToken, OutputFile, Progress } from '../shared/types';
import { baseName } from '../shared/validation';

async function pdfTextItems(file: File): Promise<{ text: string; pages: number }> {
  const lib = await import('pdfjs-dist');
  let pdf;
  try {
    pdf = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  } catch (e) {
    const err = e as { name?: string; message?: string };
    if (err?.name === 'PasswordException' || /encrypt|password/i.test(err?.message ?? '')) throw new Error('encrypted');
    throw e;
  }
  try {
    const parts: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      try {
        const content = await page.getTextContent();
        const line = content.items
          .map((it) => ('str' in it ? (it as { str: string }).str : ''))
          .join(' ');
        parts.push(`--- Page ${i} ---\n${line}`);
      } finally {
        page.cleanup();
      }
    }
    return { text: parts.join('\n\n'), pages: pdf.numPages };
  } finally {
    await pdf.destroy();
  }
}

/** PDF → Text: layout-aware extraction for simple PDFs (PRD §20, local path). */
export async function pdfToText(file: File, token: CancelToken): Promise<OutputFile> {
  if (token.cancelled) throw new Error('cancelled');
  const { text, pages } = await pdfTextItems(file);
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  return { name: `${baseName(file.name)}.txt`, blob, size: blob.size, pages };
}

/** PDF → Word (simple PDFs): text/layout extraction into DOCX (PRD §20, local path). */
export async function pdfToWord(
  file: File,
  token: CancelToken,
  onProgress: (p: Progress) => void,
): Promise<OutputFile> {
  onProgress({ done: 0, total: 2 });
  const { text, pages } = await pdfTextItems(file);
  if (token.cancelled) throw new Error('cancelled');
  onProgress({ done: 1, total: 2 });
  const paragraphs = text
    .split('\n')
    .map((line) => new Paragraph({ children: [new TextRun(line || ' ')] }));
  const doc = new Document({ sections: [{ children: paragraphs }] });
  const blob = await Packer.toBlob(doc);
  onProgress({ done: 2, total: 2 });
  return { name: `${baseName(file.name)}.docx`, blob, size: blob.size, pages };
}

function wrapLines(doc: jsPDF, text: string): string[] {
  const width = doc.internal.pageSize.getWidth() - 30;
  return doc.splitTextToSize(text, width);
}

/** TXT / Markdown → PDF, rendered locally with jsPDF. */
export async function textToPdf(
  file: File,
  kind: 'txt' | 'md',
  token: CancelToken,
): Promise<OutputFile> {
  let raw = await file.text();
  if (token.cancelled) throw new Error('cancelled');
  if (kind === 'md') {
    raw = raw
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  }
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  const pageH = doc.internal.pageSize.getHeight();
  let y = 15;
  for (const paragraph of raw.split('\n')) {
    if (token.cancelled) throw new Error('cancelled');
    const lines = wrapLines(doc, paragraph === '' ? ' ' : paragraph);
    for (const line of lines) {
      if (y > pageH - 15) {
        doc.addPage();
        y = 15;
      }
      doc.text(line, 15, y);
      y += 6;
    }
  }
  const blob = doc.output('blob');
  return { name: `${baseName(file.name)}.pdf`, blob, size: blob.size };
}

/** TXT / Markdown → DOCX (local, docx lib). */
export async function textToDocx(file: File, kind: 'txt' | 'md', token: CancelToken): Promise<OutputFile> {
  let raw = await file.text();
  if (token.cancelled) throw new Error('cancelled');
  if (kind === 'md') {
    raw = raw
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  }
  const paragraphs = raw.split('\n').map((line) => new Paragraph({ children: [new TextRun(line || ' ')] }));
  const doc = new Document({ sections: [{ children: paragraphs }] });
  const blob = await Packer.toBlob(doc);
  return { name: `${baseName(file.name)}.docx`, blob, size: blob.size };
}

/** Markdown → HTML (minimal local renderer). */
export async function mdToHtml(file: File, token: CancelToken): Promise<OutputFile> {
  const raw = await file.text();
  if (token.cancelled) throw new Error('cancelled');
  const html = raw
    .split('\n')
    .map((line) => {
      const h = line.match(/^(#{1,6})\s+(.*)/);
      if (h) return `<h${h[1].length}>${escapeHtml(h[2])}</h${h[1].length}>`;
      if (/^\s*[-*]\s+/.test(line)) return `<li>${escapeHtml(line.replace(/^\s*[-*]\s+/, ''))}</li>`;
      if (line.trim() === '') return '';
      return `<p>${escapeHtml(line)
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')}</p>`;
    })
    .join('\n')
    .replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`);
  const page = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(baseName(file.name))}</title></head><body>${html}</body></html>`;
  const blob = new Blob([page], { type: 'text/html;charset=utf-8' });
  return { name: `${baseName(file.name)}.html`, blob, size: blob.size };
}

/** Word → HTML file download (mammoth, local). */
export async function docxToHtml(file: File, token: CancelToken): Promise<OutputFile> {
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
  if (token.cancelled) throw new Error('cancelled');
  const page = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(baseName(file.name))}</title></head><body>${html}</body></html>`;
  const blob = new Blob([page], { type: 'text/html;charset=utf-8' });
  return { name: `${baseName(file.name)}.html`, blob, size: blob.size };
}

/** PDF → simple HTML (text per page, local). */
export async function pdfToHtml(file: File, token: CancelToken): Promise<OutputFile> {
  const { text, pages } = await pdfTextItems(file);
  if (token.cancelled) throw new Error('cancelled');
  const body = text
    .split('\n')
    .map((line) => (line.startsWith('--- Page') ? `<h2>${escapeHtml(line)}</h2>` : line.trim() === '' ? '' : `<p>${escapeHtml(line)}</p>`))
    .join('\n');
  const page = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(baseName(file.name))}</title></head><body>${body}</body></html>`;
  void pages;
  const blob = new Blob([page], { type: 'text/html;charset=utf-8' });
  return { name: `${baseName(file.name)}.html`, blob, size: blob.size };
}

/** Images → PDF, one image per A4 page, fit without distortion (local, jsPDF). */
export async function imagesToPdf(
  files: File[],
  token: CancelToken,
  onProgress: (p: Progress) => void,
): Promise<OutputFile> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  for (let i = 0; i < files.length; i++) {
    if (token.cancelled) throw new Error('cancelled');
    onProgress({ done: i, total: files.length });
    const bmp = await createImageBitmap(files[i]);
    try {
      const fmt = files[i].name.toLowerCase().endsWith('.png') ? 'PNG' : 'JPEG';
      const scale = Math.min(pageW / (bmp.width * 0.264583), pageH / (bmp.height * 0.264583));
      const w = bmp.width * 0.264583 * scale;
      const h = bmp.height * 0.264583 * scale;
      if (i > 0) doc.addPage();
      const canvas = document.createElement('canvas');
      canvas.width = bmp.width;
      canvas.height = bmp.height;
      const ctx = canvas.getContext('2d')!;
      if (fmt === 'JPEG') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(bmp, 0, 0);
      doc.addImage(canvas.toDataURL(fmt === 'PNG' ? 'image/png' : 'image/jpeg', 0.92), fmt, (pageW - w) / 2, (pageH - h) / 2, w, h);
      canvas.width = 0;
    } finally {
      bmp.close();
    }
    onProgress({ done: i + 1, total: files.length });
  }
  const blob = doc.output('blob');
  return { name: `${baseName(files[0].name)}-images.pdf`, blob, size: blob.size, pages: files.length };
}
export async function docxToText(file: File, token: CancelToken): Promise<OutputFile> {
  const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  if (token.cancelled) throw new Error('cancelled');
  const blob = new Blob([value], { type: 'text/plain;charset=utf-8' });
  return { name: `${baseName(file.name)}.txt`, blob, size: blob.size };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export interface DocxRun {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  /** points, resolved (direct size → heading default → 11) */
  size: number;
  font: 'helvetica' | 'times' | 'courier';
}

export interface DocxPara {
  runs: DocxRun[];
  align: 'left' | 'center' | 'right' | 'justify';
  indentMm: number;
  firstLineMm: number;
  spaceBeforeMm: number;
  spaceAfterMm: number;
  list: { ordered: boolean; level: number } | null;
}

export type DocxBlock =
  | { kind: 'para'; para: DocxPara }
  | { kind: 'table'; rows: DocxPara[][][] }
  | { kind: 'image'; data: Uint8Array; format: 'PNG' | 'JPEG' | null; widthMm: number | null; heightMm: number | null }
  | { kind: 'pageBreak' };

type MammothEl = {
  type: string;
  children?: MammothEl[];
  value?: string;
  styleId?: string | null;
  styleName?: string | null;
  alignment?: string | null;
  numbering?: { isOrdered: boolean; level: string | number } | null;
  indent?: { start?: string | null; firstLine?: string | null; hanging?: string | null } | null;
  isBold?: boolean;
  isItalic?: boolean;
  isUnderline?: boolean;
  fontSize?: number | null;
  font?: string | null;
  breakType?: string | null;
  readAsArrayBuffer?: () => Promise<ArrayBuffer | Uint8Array>;
};

/** Read the mammoth document model via the public transformDocument hook. */
export async function readDocxModel(input: { path: string } | { arrayBuffer: ArrayBuffer }): Promise<unknown> {
  let captured: unknown = null;
  await mammoth.convertToHtml(input, {
    transformDocument: (el: unknown) => {
      captured = el;
      return el;
    },
  });
  if (!captured) throw new Error('decode');
  return captured;
}

const twipsToMm = (v: string | null | undefined): number => {
  const n = v ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) ? (n / 1440) * 25.4 : 0;
};

function mapFont(name: string | null | undefined): DocxRun['font'] {
  const f = (name ?? '').toLowerCase();
  if (/times|cambria|georgia|garamond|palatino|serif|book antiqua|minion/.test(f)) return 'times';
  if (/consolas|courier|mono|menlo|lucida console/.test(f)) return 'courier';
  return 'helvetica';
}

function mapAlign(jc: string | null | undefined): DocxPara['align'] {
  if (jc === 'center') return 'center';
  if (jc === 'right' || jc === 'end') return 'right';
  if (jc === 'both' || jc === 'justify') return 'justify';
  return 'left';
}

function headingSize(styleId: string | null | undefined, styleName: string | null | undefined): number | null {
  const s = `${styleId ?? ''} ${styleName ?? ''}`.toLowerCase();
  if (/title/.test(s)) return 20;
  if (/heading\s*1|heading1/.test(s)) return 16;
  if (/heading\s*2|heading2/.test(s)) return 14;
  if (/heading\s*3|heading3/.test(s)) return 13;
  if (/heading\s*[4-9]/.test(s)) return 12;
  return null;
}

function sniffImage(bytes: Uint8Array): 'PNG' | 'JPEG' | null {
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'PNG';
  if (bytes.length > 2 && bytes[0] === 0xff && bytes[1] === 0xd8) return 'JPEG';
  return null;
}

/** Natural size in mm (96 dpi). PNG via IHDR, JPEG via SOF scan. */
function imageSizeMm(bytes: Uint8Array, format: 'PNG' | 'JPEG'): { w: number; h: number } | null {
  const px2mm = (px: number) => (px * 25.4) / 96;
  try {
    if (format === 'PNG' && bytes.length > 24) {
      const w = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
      const h = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
      if (w > 0 && h > 0) return { w: px2mm(w), h: px2mm(h) };
    } else if (format === 'JPEG') {
      let i = 2;
      while (i + 8 < bytes.length) {
        if (bytes[i] !== 0xff) break;
        const marker = bytes[i + 1];
        const len = (bytes[i + 2] << 8) | bytes[i + 3];
        if (marker >= 0xc0 && marker <= 0xc3) {
          const h = (bytes[i + 5] << 8) | bytes[i + 6];
          const w = (bytes[i + 7] << 8) | bytes[i + 8];
          if (w > 0 && h > 0) return { w: px2mm(w), h: px2mm(h) };
          break;
        }
        i += 2 + len;
      }
    }
  } catch {
    return null;
  }
  return null;
}

function paraOf(el: MammothEl): DocxPara {
  const hs = headingSize(el.styleId, el.styleName);
  const para: DocxPara = {
    runs: [],
    align: mapAlign(el.alignment),
    indentMm: twipsToMm(el.indent?.start),
    firstLineMm: el.indent?.firstLine
      ? twipsToMm(el.indent.firstLine)
      : el.indent?.hanging
        ? -twipsToMm(el.indent.hanging)
        : 0,
    spaceBeforeMm: hs ? 4 : 0,
    spaceAfterMm: hs ? 3 : 2,
    list: el.numbering ? { ordered: !!el.numbering.isOrdered, level: Math.max(0, Number(el.numbering.level) || 0) } : null,
  };
  const pushText = (text: string, bold: boolean, italic: boolean, underline: boolean, size: number | null, font: string | null) => {
    if (!text) return;
    para.runs.push({
      text,
      bold: bold || hs !== null,
      italic,
      underline,
      size: size ?? hs ?? 11,
      font: mapFont(font),
    });
  };
  const walk = (node: MammothEl, bold: boolean, italic: boolean, underline: boolean, size: number | null, font: string | null) => {
    if (node.type === 'text') {
      pushText(node.value ?? '', bold, italic, underline, size, font);
    } else if (node.type === 'tab') {
      pushText('    ', bold, italic, underline, size, font);
    } else if (node.type === 'break') {
      pushText('\n', bold, italic, underline, size, font);
    } else if (node.type === 'run') {
      const b = bold || !!node.isBold;
      const it = italic || !!node.isItalic;
      const ul = underline || !!node.isUnderline;
      for (const c of node.children ?? []) walk(c, b, it, ul, node.fontSize ?? size, node.font ?? font);
    } else if (node.type === 'hyperlink') {
      for (const c of node.children ?? []) walk(c, bold, italic, true, size, font);
    }
  };
  for (const c of el.children ?? []) {
    if (c.type === 'image') continue; // emitted as its own block by modelToBlocks
    if (c.type === 'break' && c.breakType !== 'line') continue; // page/column breaks handled at block level
    walk(c, false, false, false, null, null);
  }
  return para;
}

const hasImageDeep = (n: MammothEl): boolean =>
  n.type === 'image' || ((n.type === 'run' || n.type === 'hyperlink') && (n.children ?? []).some(hasImageDeep));

/** Pull image nodes out of nested runs, preserving order and run props. */
function pullImages(nodes: MammothEl[]): MammothEl[] {
  const out: MammothEl[] = [];
  for (const n of nodes) {
    if (n.type === 'image') {
      out.push(n);
      continue;
    }
    if ((n.type === 'run' || n.type === 'hyperlink') && (n.children ?? []).some(hasImageDeep)) {
      let buf: MammothEl[] = [];
      const flushRun = () => {
        if (buf.length > 0) {
          out.push({ ...n, children: buf });
          buf = [];
        }
      };
      for (const c of n.children ?? []) {
        if (c.type === 'image') {
          flushRun();
          out.push(c);
        } else if (hasImageDeep(c)) {
          flushRun();
          for (const p of pullImages([c])) out.push(p);
        } else {
          buf.push(c);
        }
      }
      flushRun();
      continue;
    }
    out.push(n);
  }
  return out;
}

/**
 * Mammoth document model → flat blocks (async: image bytes are read here).
 * No DOM - runs in the browser and in node tests ({path} input).
 */
export async function modelToBlocks(doc: unknown): Promise<DocxBlock[]> {
  const blocks: DocxBlock[] = [];
  const el = doc as MammothEl;
  const kids = el.type === 'document' ? (el.children ?? []) : [el];
  for (const node of kids) {
    if (node.type === 'paragraph') {
      const brk = (node.children ?? []).find((c) => c.type === 'break' && c.breakType !== 'line');
      // Runs carrying images split into text + image blocks, in order.
      const kids = pullImages(node.children ?? []);
      let pending: MammothEl[] = [];
      const flush = () => {
        if (pending.length > 0) {
          blocks.push({ kind: 'para', para: paraOf({ ...node, children: pending }) });
          pending = [];
        }
      };
      for (const c of kids) {
        if (c.type === 'image') {
          flush();
          try {
            const raw = c.readAsArrayBuffer ? await c.readAsArrayBuffer() : null;
            // new Uint8Array copies in both cases (ArrayBuffer or a view).
            const data = raw ? new Uint8Array(raw) : null;
            const format = data ? sniffImage(data) : null;
            if (data && format) {
              const nat = imageSizeMm(data, format);
              blocks.push({ kind: 'image', data, format, widthMm: nat?.w ?? null, heightMm: nat?.h ?? null });
            }
          } catch {
            // Unreadable image: skip the block, keep the document going.
          }
        } else {
          pending.push(c);
        }
      }
      flush();
      if (brk) blocks.push({ kind: 'pageBreak' });
    } else if (node.type === 'table') {
      const rows: DocxPara[][][] = (node.children ?? []).map((row) =>
        (row.children ?? []).map((cell) => (cell.children ?? []).filter((p) => p.type === 'paragraph').map(paraOf)),
      );
      if (rows.length > 0) blocks.push({ kind: 'table', rows });
    }
  }
  return blocks;
}

interface Seg {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  size: number;
  font: DocxRun['font'];
}

interface Line {
  segs: Seg[];
  width: number;
  gaps: number;
}

/** Render model blocks to a real A4 PDF (jsPDF, local). No DOM. */
export function renderDocxPdf(base: string, blocks: DocxBlock[], token: CancelToken): OutputFile {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentW = pageW - margin * 2;
  const bottom = pageH - 15;
  let y = 15;

  const apply = (s: Seg) => {
    doc.setFont(s.font, s.bold && s.italic ? 'bolditalic' : s.bold ? 'bold' : s.italic ? 'italic' : 'normal');
    doc.setFontSize(s.size);
  };
  const measure = (s: Seg, text: string): number => {
    apply(s);
    return doc.getTextWidth(text);
  };
  const need = (h: number) => {
    if (y + h > bottom) {
      doc.addPage();
      y = 15;
    }
  };
  const lineH = (size: number) => size * 0.45;

  /** Greedy wrap: split runs into words, keep each word's style. */
  const layout = (runs: DocxRun[], maxW: number): Line[] => {
    const lines: Line[] = [];
    let segs: Seg[] = [];
    let width = 0;
    let gaps = 0;
    const words: Seg[] = [];
    for (const r of runs) {
      for (const part of r.text.split(/(\s+)/)) {
        if (!part) continue;
        if (/^\s+$/.test(part)) {
          if (part.includes('\n')) {
            lines.push({ segs, width, gaps });
            segs = [];
            width = 0;
            gaps = 0;
          }
          continue;
        }
        words.push({ text: part, bold: r.bold, italic: r.italic, underline: r.underline, size: r.size, font: r.font });
      }
    }
    const spaceW = (s: Seg) => measure(s, ' ');
    for (const w of words) {
      const ww = measure(w, w.text);
      const add = (segs.length > 0 ? spaceW(w) : 0) + ww;
      if (segs.length > 0 && width + add > maxW) {
        lines.push({ segs, width, gaps });
        segs = [];
        width = 0;
        gaps = 0;
      }
      if (segs.length > 0) {
        width += spaceW(w);
        gaps += 1;
      }
      segs.push(w);
      width += ww;
    }
    lines.push({ segs, width, gaps });
    return lines;
  };

  const drawLine = (line: Line, x0: number, maxW: number, align: DocxPara['align'], last: boolean, size: number) => {
    if (token.cancelled) throw new Error('cancelled');
    if (line.segs.length === 0) {
      y += lineH(size);
      return;
    }
    let x = x0;
    if (align === 'center') x = x0 + (maxW - line.width) / 2;
    else if (align === 'right') x = x0 + maxW - line.width;
    const justify = align === 'justify' && !last && line.gaps > 0;
    const extra = justify ? (maxW - line.width) / line.gaps : 0;
    line.segs.forEach((s, i) => {
      if (i > 0) x += measure(s, ' ') + (justify ? extra : 0);
      apply(s);
      doc.text(s.text, x, y);
      const w = doc.getTextWidth(s.text);
      if (s.underline) {
        doc.setDrawColor(0);
        doc.setLineWidth(0.2);
        doc.line(x, y + 0.8, x + w, y + 0.8);
      }
      x += w;
    });
    y += lineH(size);
  };

  const maxSize = (runs: DocxRun[]): number => runs.reduce((m, r) => Math.max(m, r.size), 11);
  // Ordered and unordered lists count independently (the model carries no numId).
  const numCounters: number[] = [];

  const drawPara = (para: DocxPara, maxW: number, xBase: number) => {
    y += para.spaceBeforeMm;
    let prefix = '';
    let prefixW = 0;
    const indent = xBase + para.indentMm;
    if (para.list) {
      const { ordered, level } = para.list;
      if (ordered) {
        numCounters.length = level + 1;
        numCounters[level] = (numCounters[level] ?? 0) + 1;
        prefix = `${numCounters[level]}.`;
      } else {
        prefix = level % 2 === 0 ? '\u2022' : '\u25E6';
      }
      const probe: Seg = { text: prefix + ' ', bold: false, italic: false, underline: false, size: maxSize(para.runs), font: 'helvetica' };
      prefixW = measure(probe, prefix + ' ');
    }
    const avail = maxW - para.indentMm - (para.list ? para.list.level * 6 + prefixW : 0);
    const lines = layout(para.runs, Math.max(20, avail));
    // Empty paragraph still occupies one line.
    if (lines.length === 1 && lines[0].segs.length === 0) {
      need(lineH(11));
      y += lineH(11) + para.spaceAfterMm;
      return;
    }
    lines.forEach((line, i) => {
      const first = i === 0;
      const x0 = first ? indent + (para.list ? para.list.level * 6 : 0) + para.firstLineMm : indent + (para.list ? para.list.level * 6 + prefixW : 0);
      need(lineH(maxSize(line.segs)));
      if (first && prefix) {
        const probe: Seg = { text: '', bold: false, italic: false, underline: false, size: maxSize(para.runs), font: 'helvetica' };
        apply(probe);
        doc.text(prefix, x0, y);
      }
      drawLine(line, x0 + (first && prefix ? prefixW : 0), avail, para.align, i === lines.length - 1, maxSize(line.segs));
    });
    y += para.spaceAfterMm;
  };

  for (const b of blocks) {
    if (token.cancelled) throw new Error('cancelled');
    if (b.kind === 'pageBreak') {
      doc.addPage();
      y = 15;
    } else if (b.kind === 'image') {
      const maxW = contentW;
      let w = b.widthMm ?? maxW;
      let h = b.heightMm ?? (maxW * 0.75);
      if (w > maxW) {
        h = (h * maxW) / w;
        w = maxW;
      }
      need(h + 2);
      try {
        doc.addImage(b.data, b.format ?? 'PNG', margin + (contentW - w) / 2, y, w, h);
        y += h + 2;
      } catch {
        // Unsupported raster: leave a labelled box instead of dying.
        need(27);
        doc.setDrawColor(160);
        doc.rect(margin, y, maxW, 25);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text('[image]', margin + 2, y + 8);
        y += 27;
      }
    } else if (b.kind === 'table') {
      const cols = Math.max(...b.rows.map((r) => r.length));
      const colW = contentW / cols;
      for (const row of b.rows) {
        if (token.cancelled) throw new Error('cancelled');
        const cells = row.map((cell) => {
          const out: { lines: Line[]; max: number }[] = [];
          for (const p of cell) {
            for (const ln of layout(p.runs, Math.max(10, colW - 4))) out.push({ lines: [ln], max: maxSize(ln.segs) });
          }
          if (out.length === 0) out.push({ lines: [{ segs: [], width: 0, gaps: 0 }], max: 11 });
          return out;
        });
        const rowH = Math.max(...cells.map((c) => c.reduce((h, l) => h + lineH(l.max), 0))) + 4;
        need(rowH);
        const y0 = y;
        cells.forEach((cell, ci) => {
          const x0 = margin + ci * colW;
          doc.setDrawColor(170);
          doc.rect(x0, y0, colW, rowH);
          let cy = y0 + 2;
          for (const { lines, max } of cell) {
            for (const ln of lines) {
              const keepY = y;
              y = cy;
              drawLine(ln, x0 + 2, colW - 4, 'left', true, max);
              cy = y;
              y = keepY;
            }
          }
        });
        y = y0 + rowH + 1;
      }
      y += 1;
    } else {
      drawPara(b.para, contentW, margin);
    }
  }
  const blob = doc.output('blob');
  return { name: `${base}.pdf`, blob, size: blob.size };
}

/**
 * Word → real PDF (local path): mammoth reads structure (sizes, bold/italic,
 * alignment, lists, tables, inline images), jsPDF renders it.
 * Not kept: text color, exact spacing, floating images, footnotes.
 * (Stated in cfg.noteWordPdf.) No upload, no server.
 */
export async function docxToPdf(file: File, token: CancelToken): Promise<OutputFile> {
  const model = await readDocxModel({ arrayBuffer: await file.arrayBuffer() });
  if (token.cancelled) throw new Error('cancelled');
  const blocks = await modelToBlocks(model);
  if (blocks.length === 0) throw new Error('empty');
  return renderDocxPdf(baseName(file.name), blocks, token);
}
