import { describe, expect, it } from 'vitest';
import { detectKind, outputName, validateFile } from './validation';

function file(bytes: number[], name: string, type = ''): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

describe('detectKind', () => {
  it('detects PNG/JPG/WebP/PDF by magic bytes', async () => {
    expect(await detectKind(file([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 'a.png'))).toBe('png');
    expect(await detectKind(file([0xff, 0xd8, 0xff, 0xe0], 'a.jpg'))).toBe('jpg');
    expect(await detectKind(file([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50], 'a.webp'))).toBe('webp');
    expect(await detectKind(file([0x25, 0x50, 0x44, 0x46, 0x2d], 'a.pdf'))).toBe('pdf');
  });

  it('returns unknown for random bytes', async () => {
    expect(await detectKind(file([0x4d, 0x5a, 0x90, 0x00], 'a.bin'))).toBe('unknown');
  });

  it('detects video containers by magic bytes', async () => {
    const ftyp = [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d];
    expect(await detectKind(file(ftyp, 'a.mp4'))).toBe('mp4');
    expect(await detectKind(file(ftyp, 'a.mov'))).toBe('mp4');
    const ebml = [0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x1f];
    const webm = [...ebml, 0x42, 0x82, 0x04, 0x77, 0x65, 0x62, 0x6d]; // DocType 'webm'
    const mkv = [...ebml, 0x42, 0x82, 0x08, 0x6d, 0x61, 0x74, 0x72, 0x6f, 0x73, 0x6b, 0x61]; // 'matroska'
    expect(await detectKind(file(webm, 'a.webm'))).toBe('webm');
    expect(await detectKind(file(mkv, 'a.mkv'))).toBe('mkv');
    expect(await detectKind(file(ebml, 'a.mkv'))).toBe('unknown');
    const riff = (tag: string) => [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, ...tag.split('').map((c) => c.charCodeAt(0))];
    expect(await detectKind(file(riff('AVI '), 'a.avi'))).toBe('avi');
    expect(await detectKind(file(riff('WAVE'), 'a.wav'))).toBe('wav');
  });

  it('detects audio codecs by magic bytes', async () => {
    expect(await detectKind(file([0x49, 0x44, 0x33, 0x04, 0x00], 'a.mp3'))).toBe('mp3');
    expect(await detectKind(file([0xff, 0xfb, 0x90, 0x00], 'a.mp3'))).toBe('mp3');
    expect(await detectKind(file([0xff, 0xf1, 0x50, 0x80], 'a.aac'))).toBe('aac');
  });

  it('detects archives and documents by magic bytes', async () => {
    const str = (s: string) => s.split('').map((c) => c.charCodeAt(0));
    const zip = [0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00];
    expect(await detectKind(file(zip, 'a.zip'))).toBe('zip');
    // Same PK container with OOXML marker → docx.
    expect(await detectKind(file([...zip, ...str('[Content_Types].xml')], 'a.docx'))).toBe('docx');
    const tar = new Array(512).fill(0);
    'ustar'.split('').forEach((c, i) => {
      tar[257 + i] = c.charCodeAt(0);
    });
    expect(await detectKind(file(tar, 'a.tar'))).toBe('tar');
    expect(await detectKind(file([0x1f, 0x8b, 0x08, 0x00], 'a.tgz'))).toBe('gzip');
    expect(await detectKind(file(str('hello world'), 'n.txt'))).toBe('txt');
    expect(await detectKind(file(str('<svg></svg>'), 'a.svg'))).toBe('svg');
    // NUL bytes → binary unknown, not text.
    expect(await detectKind(file([0x41, 0x00, 0x42], 'a.bin'))).toBe('unknown');
  });
});

describe('validateFile (PRD §46)', () => {
  it('rejects an exe renamed to .jpg by signature mismatch', async () => {
    const evil = file([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00], 'image.jpg', 'image/jpeg');
    expect(await validateFile(evil, ['.jpg', '.jpeg'])).toEqual({ ok: false, error: 'err.corrupted' });
  });

  it('accepts a genuine jpg', async () => {
    const good = file([0xff, 0xd8, 0xff, 0xe0, 0x10], 'photo.jpg', 'image/jpeg');
    const v = await validateFile(good, ['.jpg', '.jpeg']);
    expect(v.ok).toBe(true);
  });

  it('rejects empty and mismatched files', async () => {
    expect(await validateFile(file([], 'a.jpg'), ['.jpg'])).toEqual({ ok: false, error: 'err.empty' });
    // JPG bytes named .png: extension passes, but content does not match the claim.
    expect(await validateFile(file([0xff, 0xd8, 0xff], 'a.png'), ['.png'])).toEqual({
      ok: false,
      error: 'err.corrupted',
    });
    expect(await validateFile(file([0xff, 0xd8, 0xff], 'a.gif'), ['.png'])).toEqual({
      ok: false,
      error: 'err.unsupported',
    });
  });

  it('accepts any file when accept is wildcard (create-zip)', async () => {
    const v = await validateFile(file([1, 2, 3], 'notes.txt'), ['*']);
    expect(v.ok).toBe(true);
  });

  it('accepts genuine video/audio, rejects mismatches', async () => {
    const VID = ['.mp4', '.webm', '.mov', '.m4v', '.mkv', '.avi'];
    const mp4 = file([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d], 'clip.mp4', 'video/mp4');
    expect((await validateFile(mp4, VID)).ok).toBe(true);
    const evil = file([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00], 'clip.mp4', 'video/mp4');
    expect(await validateFile(evil, VID)).toEqual({ ok: false, error: 'err.corrupted' });
    // MP3 bytes claimed as .wav: content does not match the claim.
    expect(await validateFile(file([0x49, 0x44, 0x33, 0x04], 'a.wav'), ['.wav'])).toEqual({
      ok: false,
      error: 'err.corrupted',
    });
    expect((await validateFile(file([0x49, 0x44, 0x33, 0x04], 'a.mp3'), ['.mp3'])).ok).toBe(true);
  });

  it('accepts genuine archives/text/docx, rejects mismatches', async () => {
    const str = (s: string) => s.split('').map((c) => c.charCodeAt(0));
    const zip = [0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00];
    const docx = [...zip, ...str('[Content_Types].xml')];
    expect((await validateFile(file(zip, 'a.zip'), ['.zip'])).ok).toBe(true);
    expect((await validateFile(file(docx, 'a.docx'), ['.docx'])).ok).toBe(true);
    // A docx IS a zip - extracting one as an archive is legitimate.
    expect((await validateFile(file(docx, 'a.zip'), ['.zip'])).ok).toBe(true);
    // A plain zip is not a Word document.
    expect(await validateFile(file(zip, 'a.docx'), ['.docx'])).toEqual({ ok: false, error: 'err.corrupted' });
    const tar = new Array(600).fill(0);
    'ustar'.split('').forEach((c, i) => {
      tar[257 + i] = c.charCodeAt(0);
    });
    const TAR = ['.tar', '.tgz', '.tar.gz'];
    expect((await validateFile(file(tar, 'a.tar'), TAR)).ok).toBe(true);
    const gz = [0x1f, 0x8b, 0x08, 0x00, 0x01, 0x02];
    expect((await validateFile(file(gz, 'a.tgz'), TAR)).ok).toBe(true);
    // Compound extension used to parse as '.gz' → err.unsupported.
    expect((await validateFile(file(gz, 'a.tar.gz'), TAR)).ok).toBe(true);
    const txt = str('hello world');
    expect((await validateFile(file(txt, 'n.txt'), ['.txt'])).ok).toBe(true);
    expect((await validateFile(file(txt, 'n.md'), ['.md', '.markdown'])).ok).toBe(true);
    // Legacy .doc binary is not processed - honest 'unsupported', not 'corrupted'.
    expect(await validateFile(file(txt, 'a.doc'), ['.docx'])).toEqual({ ok: false, error: 'err.unsupported' });
  });
});

describe('outputName', () => {
  it('follows original-name + output-extension', () => {
    expect(outputName('presentation.pptx', 'pdf')).toBe('presentation.pdf');
    expect(outputName('doc-page-01.jpg', 'webp', '-c')).toBe('doc-page-01-c.webp');
  });
});
