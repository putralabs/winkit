import JSZip from 'jszip';
import { ungzip } from 'pako';
import type { CancelToken, OutputFile, Progress } from '../shared/types';
import { baseName } from '../shared/validation';

/** Create a ZIP from arbitrary files (PRD §21, local via jszip). */
export async function createZip(
  files: File[],
  zipBaseName: string,
  token: CancelToken,
  onProgress: (p: Progress) => void,
): Promise<OutputFile> {
  const zip = new JSZip();
  for (let i = 0; i < files.length; i++) {
    if (token.cancelled) throw new Error('cancelled');
    onProgress({ done: i, total: files.length + 1, messageKey: 'proc.merging' });
    zip.file(files[i].name, files[i]);
    onProgress({ done: i + 1, total: files.length + 1 });
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  return { name: `${zipBaseName}.zip`, blob, size: blob.size };
}

function sanitizeEntry(name: string): string | null {
  // Flatten paths, drop dangerous segments. Never write outside the download.
  const parts = name.split('/').filter((p) => p && p !== '.' && p !== '..');
  if (parts.length === 0) return null;
  return parts.join('-');
}

/** Extract a ZIP archive into individual output files. */
export async function extractZip(
  file: File,
  token: CancelToken,
  onProgress: (p: Progress) => void,
): Promise<OutputFile[]> {
  const zip = await JSZip.loadAsync(file);
  const entries = Object.values(zip.files).filter((e) => !e.dir);
  if (entries.length === 0) throw new Error('empty');
  const out: OutputFile[] = [];
  for (let i = 0; i < entries.length; i++) {
    if (token.cancelled) throw new Error('cancelled');
    onProgress({ done: i, total: entries.length });
    const name = sanitizeEntry(entries[i].name);
    if (!name) continue;
    const blob = await entries[i].async('blob');
    out.push({ name, blob, size: blob.size });
    onProgress({ done: i + 1, total: entries.length });
  }
  return out;
}

interface TarEntry {
  name: string;
  size: number;
  offset: number;
}

function parseOctal(bytes: Uint8Array, off: number, len: number): number {
  let s = '';
  for (let i = 0; i < len; i++) {
    const c = bytes[off + i];
    if (c === 0 || c === 32) break;
    s += String.fromCharCode(c);
  }
  const n = parseInt(s.trim(), 8);
  return Number.isFinite(n) ? n : 0;
}

function parseTar(data: Uint8Array): TarEntry[] {
  const entries: TarEntry[] = [];
  let off = 0;
  while (off + 512 <= data.length) {
    // Two zero blocks = end of archive.
    let empty = true;
    for (let i = 0; i < 512; i++) {
      if (data[off + i] !== 0) {
        empty = false;
        break;
      }
    }
    if (empty) break;
    let name = '';
    for (let i = 0; i < 100; i++) {
      const c = data[off + i];
      if (c === 0) break;
      name += String.fromCharCode(c);
    }
    // ustar prefix at 345 (155 bytes)
    let prefix = '';
    for (let i = 0; i < 155; i++) {
      const c = data[off + 345 + i];
      if (c === 0) break;
      prefix += String.fromCharCode(c);
    }
    if (prefix) name = `${prefix}/${name}`;
    const size = parseOctal(data, off + 124, 12);
    const typeflag = String.fromCharCode(data[off + 156]);
    if ((typeflag === '0' || typeflag === '\0') && name) {
      entries.push({ name, size, offset: off + 512 });
    }
    off += 512 + Math.ceil(size / 512) * 512;
    if (entries.length > 5000) break;
  }
  return entries;
}

/** Extract .tar / .tar.gz / .tgz archives (pako + minimal ustar reader, local). */
export async function extractTar(
  file: File,
  token: CancelToken,
  onProgress: (p: Progress) => void,
): Promise<OutputFile[]> {
  const lower = file.name.toLowerCase();
  const gzipped = lower.endsWith('.gz') || lower.endsWith('.tgz');
  let data = new Uint8Array(await file.arrayBuffer());
  if (gzipped) {
    try {
      data = ungzip(data);
    } catch {
      throw new Error('corrupted');
    }
  }
  const entries = parseTar(data);
  if (entries.length === 0) throw new Error('corrupted');
  const out: OutputFile[] = [];
  for (let i = 0; i < entries.length; i++) {
    if (token.cancelled) throw new Error('cancelled');
    onProgress({ done: i, total: entries.length });
    const name = sanitizeEntry(entries[i].name);
    if (!name) continue;
    const slice = data.slice(entries[i].offset, entries[i].offset + entries[i].size);
    const blob = new Blob([slice.buffer as ArrayBuffer]);
    out.push({ name, blob, size: blob.size });
    onProgress({ done: i + 1, total: entries.length });
  }
  return out;
}

export function archiveBaseName(input: string): string {
  return baseName(baseName(input.replace(/\.tar$/i, '').replace(/\.tgz$/i, '')));
}
