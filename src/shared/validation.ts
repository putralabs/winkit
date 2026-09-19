// File validation: extension + MIME + magic bytes (PRD §46).
// Never trust the extension alone.
export type DetectedKind =
  | 'jpg' | 'png' | 'webp' | 'gif' | 'bmp' | 'svg' | 'pdf'
  | 'mp4' | 'webm' | 'mkv' | 'avi'
  | 'mp3' | 'wav' | 'aac'
  | 'zip' | 'docx' | 'tar' | 'gzip'
  | 'txt'
  | 'unknown';

const MAGIC: { kind: DetectedKind; sig: number[]; offset?: number }[] = [
  { kind: 'jpg', sig: [0xff, 0xd8, 0xff] },
  { kind: 'png', sig: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { kind: 'gif', sig: [0x47, 0x49, 0x46, 0x38] },
  { kind: 'bmp', sig: [0x42, 0x4d] },
  { kind: 'pdf', sig: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { kind: 'webp', sig: [0x52, 0x49, 0x46, 0x46], offset: 0 }, // RIFF....
];

export async function detectKind(file: File): Promise<DetectedKind> {
  // 8KB window: EBML DocType and the OOXML central names live past the head.
  const buf = new Uint8Array(await file.slice(0, 8192).arrayBuffer());
  const head = buf.subarray(0, 12);
  const match = (sig: number[], offset = 0) =>
    sig.every((b, i) => head[offset + i] === b);
  for (const { kind, sig, offset } of MAGIC) {
    if (match(sig, offset)) {
      if (kind === 'webp') {
        // RIFF xxxx WEBP
        if (head[8] === 0x57 && head[9] === 0x45 && head[10] === 0x42 && head[11] === 0x50) return 'webp';
        continue;
      }
      return kind;
    }
  }
  // ISO BMFF: box-size(4) + 'ftyp' - covers .mp4/.m4v/.mov/.m4a.
  if (match([0x66, 0x74, 0x79, 0x70], 4)) return 'mp4';
  // EBML header 1A 45 DF A3 - DocType deeper in the header.
  if (match([0x1a, 0x45, 0xdf, 0xa3])) {
    if (hasBytes(buf, 'matroska')) return 'mkv';
    if (hasBytes(buf, 'webm')) return 'webm';
    return 'unknown';
  }
  // MP3: ID3 tag or MPEG frame sync (layer bits non-zero).
  if (match([0x49, 0x44, 0x33])) return 'mp3';
  if (head[0] === 0xff && head.length > 1) {
    // ADTS (AAC): 12-bit sync + layer 00.
    if ((head[1] & 0xf0) === 0xf0 && (head[1] & 0x06) === 0x00) return 'aac';
    if ((head[1] & 0xe0) === 0xe0) return 'mp3';
  }
  // RIFF container: WEBP handled above; AVI/WAVE here.
  if (match([0x52, 0x49, 0x46, 0x46])) {
    const tag = String.fromCharCode(head[8] ?? 0, head[9] ?? 0, head[10] ?? 0, head[11] ?? 0);
    if (tag === 'AVI ') return 'avi';
    if (tag === 'WAVE') return 'wav';
  }
  // ZIP family: PK.. - OOXML (docx) carries [Content_Types].xml up front.
  if (match([0x50, 0x4b, 0x03, 0x04]) || match([0x50, 0x4b, 0x05, 0x06]) || match([0x50, 0x4b, 0x07, 0x08])) {
    if (hasBytes(buf, '[Content_Types].xml')) return 'docx';
    return 'zip';
  }
  // TAR: 'ustar' at offset 257. GZip: 1F 8B (covers .tgz/.tar.gz).
  if (buf.length > 262 && buf[257] === 0x75 && buf[258] === 0x73 && buf[259] === 0x74 && buf[260] === 0x61 && buf[261] === 0x72) {
    return 'tar';
  }
  if (match([0x1f, 0x8b])) return 'gzip';
  const ext = file.name.toLowerCase().split('.').pop() ?? '';
  if (ext === 'svg') return 'svg';
  // Plain text (txt/md): no binary signature and no NUL bytes in the window.
  if (!buf.includes(0)) return 'txt';
  return 'unknown';
}

/** Byte-substring search for ASCII markers (e.g. EBML DocType). */
function hasBytes(buf: Uint8Array, s: string): boolean {
  outer: for (let i = 0; i + s.length <= buf.length; i++) {
    for (let j = 0; j < s.length; j++) {
      if (buf[i + j] !== s.charCodeAt(j)) continue outer;
    }
    return true;
  }
  return false;
}

export type ValidationError = 'err.empty' | 'err.unsupported' | 'err.corrupted';

export async function validateFile(
  file: File,
  accept: string[],
): Promise<{ ok: true; kind: DetectedKind } | { ok: false; error: ValidationError }> {
  if (file.size === 0) return { ok: false, error: 'err.empty' };
  // '*' accepts any file (e.g. Create ZIP) - no signature to check against.
  if (accept.includes('*')) return { ok: true, kind: 'unknown' };
  const lower = file.name.toLowerCase();
  // Compound extension: 'archive.tar.gz' would otherwise parse as '.gz'.
  const ext = lower.endsWith('.tar.gz') ? '.tar.gz' : '.' + (lower.split('.').pop() ?? '');
  if (!accept.includes(ext)) return { ok: false, error: 'err.unsupported' };
  // SVG has no reliable magic bytes; rely on extension + MIME here.
  if (ext === '.svg') {
    if (file.type && file.type !== 'image/svg+xml') return { ok: false, error: 'err.corrupted' };
    return { ok: true, kind: 'svg' };
  }
  const kind = await detectKind(file);
  if (kind === 'unknown') return { ok: false, error: 'err.corrupted' };
  const kindExt: Record<string, string> = {
    jpg: '.jpg',
    png: '.png',
    webp: '.webp',
    gif: '.gif',
    bmp: '.bmp',
    pdf: '.pdf',
    mp4: '.mp4',
    webm: '.webm',
    mkv: '.mkv',
    avi: '.avi',
    mp3: '.mp3',
    wav: '.wav',
    aac: '.aac',
    zip: '.zip',
    docx: '.docx',
    tar: '.tar',
    gzip: '.tgz',
    txt: '.txt',
  };
  const alias: Record<string, string[]> = {
    '.jpg': ['.jpg', '.jpeg'],
    '.jpeg': ['.jpg', '.jpeg'],
    // ISO BMFF variants share the ftyp box; the decoder sorts out the rest.
    '.mp4': ['.mp4', '.m4v', '.mov', '.m4a'],
    // Same EBML family; both decode in <video>/audio paths.
    '.webm': ['.webm', '.mkv'],
    '.mkv': ['.mkv', '.webm'],
    // A docx IS a zip; extracting one as an archive is legitimate.
    '.docx': ['.docx', '.zip'],
    '.tgz': ['.tgz', '.tar.gz'],
    // Plain-text sniff can't tell .txt/.md apart; processors read either.
    '.txt': ['.txt', '.md', '.markdown'],
  };
  const detected = kindExt[kind];
  const accepted = alias[detected] ?? [detected];
  if (!accepted.some((e) => accept.includes(e))) return { ok: false, error: 'err.corrupted' };
  return { ok: true, kind };
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function baseName(name: string): string {
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(0, i) : name;
}

/** WinKit naming convention: original-name + output-extension (PRD §33). */
export function outputName(input: string, ext: string, suffix = ''): string {
  return `${baseName(input)}${suffix}.${ext}`;
}
