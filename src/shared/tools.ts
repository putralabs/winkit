import type { ToolDef } from './types';
import { isExtension } from './platform';

// Tool registry (PRD §71 + Phase 2–5, local-first subset). New tools only need
// an entry here plus a processor + config panel - core stays untouched.
const IMG = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
const VID = ['.mp4', '.webm', '.mov', '.m4v', '.mkv', '.avi'];

export const TOOLS: ToolDef[] = [
  // Phase 1 - images
  { id: 'jpg-to-png', category: 'images', accept: ['.jpg', '.jpeg'], multiple: true, nameKey: 'tool.jpg-to-png.name', descKey: 'tool.jpg-to-png.desc' },
  { id: 'png-to-jpg', category: 'images', accept: ['.png'], multiple: true, nameKey: 'tool.png-to-jpg.name', descKey: 'tool.png-to-jpg.desc' },
  { id: 'image-to-webp', category: 'images', accept: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'], multiple: true, nameKey: 'tool.image-to-webp.name', descKey: 'tool.image-to-webp.desc' },
  { id: 'image-resize', category: 'images', accept: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'], multiple: true, nameKey: 'tool.image-resize.name', descKey: 'tool.image-resize.desc' },
  { id: 'image-compress', category: 'images', accept: ['.jpg', '.jpeg', '.png', '.webp'], multiple: true, nameKey: 'tool.image-compress.name', descKey: 'tool.image-compress.desc' },
  // Phase 1 - PDF
  { id: 'pdf-to-jpg', category: 'pdf', accept: ['.pdf'], multiple: false, nameKey: 'tool.pdf-to-jpg.name', descKey: 'tool.pdf-to-jpg.desc' },
  { id: 'pdf-to-png', category: 'pdf', accept: ['.pdf'], multiple: false, nameKey: 'tool.pdf-to-png.name', descKey: 'tool.pdf-to-png.desc' },
  { id: 'pdf-merge', category: 'pdf', accept: ['.pdf'], multiple: true, nameKey: 'tool.pdf-merge.name', descKey: 'tool.pdf-merge.desc' },
  { id: 'pdf-split', category: 'pdf', accept: ['.pdf'], multiple: false, nameKey: 'tool.pdf-split.name', descKey: 'tool.pdf-split.desc' },
  // Phase 2 - video
  { id: 'video-to-jpg', category: 'video', accept: VID, multiple: false, nameKey: 'tool.video-to-jpg.name', descKey: 'tool.video-to-jpg.desc' },
  { id: 'video-to-png', category: 'video', accept: VID, multiple: false, nameKey: 'tool.video-to-png.name', descKey: 'tool.video-to-png.desc' },
  { id: 'video-to-gif', category: 'video', accept: VID, multiple: false, nameKey: 'tool.video-to-gif.name', descKey: 'tool.video-to-gif.desc' },
  { id: 'video-to-mp3', category: 'video', accept: VID, multiple: true, nameKey: 'tool.video-to-mp3.name', descKey: 'tool.video-to-mp3.desc' },
  // Phase 3 - audio
  { id: 'wav-to-mp3', category: 'audio', accept: ['.wav'], multiple: true, nameKey: 'tool.wav-to-mp3.name', descKey: 'tool.wav-to-mp3.desc' },
  { id: 'mp3-to-wav', category: 'audio', accept: ['.mp3'], multiple: true, nameKey: 'tool.mp3-to-wav.name', descKey: 'tool.mp3-to-wav.desc' },
  { id: 'm4a-to-mp3', category: 'audio', accept: ['.m4a', '.aac'], multiple: true, nameKey: 'tool.m4a-to-mp3.name', descKey: 'tool.m4a-to-mp3.desc' },
  // Phase 3 - documents
  { id: 'pdf-to-text', category: 'documents', accept: ['.pdf'], multiple: false, nameKey: 'tool.pdf-to-text.name', descKey: 'tool.pdf-to-text.desc' },
  { id: 'txt-to-pdf', category: 'documents', accept: ['.txt'], multiple: true, nameKey: 'tool.txt-to-pdf.name', descKey: 'tool.txt-to-pdf.desc' },
  { id: 'md-to-pdf', category: 'documents', accept: ['.md', '.markdown'], multiple: true, nameKey: 'tool.md-to-pdf.name', descKey: 'tool.md-to-pdf.desc' },
  { id: 'docx-to-txt', category: 'documents', accept: ['.docx'], multiple: true, nameKey: 'tool.docx-to-txt.name', descKey: 'tool.docx-to-txt.desc' },
  { id: 'pdf-to-word', category: 'documents', accept: ['.pdf'], multiple: false, nameKey: 'tool.pdf-to-word.name', descKey: 'tool.pdf-to-word.desc' },
  { id: 'word-to-pdf', category: 'documents', accept: ['.docx'], multiple: false, nameKey: 'tool.word-to-pdf.name', descKey: 'tool.word-to-pdf.desc' },
  // Phase 3 - archives
  { id: 'create-zip', category: 'archives', accept: ['*'], multiple: true, nameKey: 'tool.create-zip.name', descKey: 'tool.create-zip.desc' },
  { id: 'extract-zip', category: 'archives', accept: ['.zip'], multiple: false, nameKey: 'tool.extract-zip.name', descKey: 'tool.extract-zip.desc' },
  { id: 'extract-tar', category: 'archives', accept: ['.tar', '.tgz', '.tar.gz'], multiple: false, nameKey: 'tool.extract-tar.name', descKey: 'tool.extract-tar.desc' },
  // Phase 4 - advanced image
  { id: 'image-crop', category: 'images', accept: IMG, multiple: false, nameKey: 'tool.image-crop.name', descKey: 'tool.image-crop.desc' },
  { id: 'image-rotate', category: 'images', accept: IMG, multiple: true, nameKey: 'tool.image-rotate.name', descKey: 'tool.image-rotate.desc' },
  { id: 'image-filters', category: 'images', accept: IMG, multiple: true, nameKey: 'tool.image-filters.name', descKey: 'tool.image-filters.desc' },
  { id: 'image-strip-metadata', category: 'images', accept: ['.jpg', '.jpeg', '.png', '.webp'], multiple: true, nameKey: 'tool.image-strip-metadata.name', descKey: 'tool.image-strip-metadata.desc' },
  // Phase 4 - advanced PDF
  { id: 'pdf-watermark', category: 'pdf', accept: ['.pdf'], multiple: true, nameKey: 'tool.pdf-watermark.name', descKey: 'tool.pdf-watermark.desc' },
  { id: 'pdf-compress', category: 'pdf', accept: ['.pdf'], multiple: true, nameKey: 'tool.pdf-compress.name', descKey: 'tool.pdf-compress.desc' },
  // Phase 5 - utilities
  { id: 'ocr-image-to-text', category: 'utilities', accept: IMG, multiple: true, nameKey: 'tool.ocr-image-to-text.name', descKey: 'tool.ocr-image-to-text.desc' },
  // Website-only: FFmpeg needs a real page (SharedArrayBuffer for multi-thread)
  { id: 'video-convert', category: 'video', accept: VID, multiple: false, webOnly: true, nameKey: 'tool.video-convert.name', descKey: 'tool.video-convert.desc' },
  { id: 'video-trim', category: 'video', accept: VID, multiple: false, webOnly: true, nameKey: 'tool.video-trim.name', descKey: 'tool.video-trim.desc' },
  // Round-up - more local-first tools (PRD §§14–22 feasible subset)
  { id: 'image-to-pdf', category: 'images', accept: IMG, multiple: true, nameKey: 'tool.image-to-pdf.name', descKey: 'tool.image-to-pdf.desc' },
  { id: 'pdf-to-webp', category: 'pdf', accept: ['.pdf'], multiple: false, nameKey: 'tool.pdf-to-webp.name', descKey: 'tool.pdf-to-webp.desc' },
  { id: 'svg-to-png', category: 'images', accept: ['.svg'], multiple: true, nameKey: 'tool.svg-to-png.name', descKey: 'tool.svg-to-png.desc' },
  { id: 'pdf-organize', category: 'pdf', accept: ['.pdf'], multiple: false, nameKey: 'tool.pdf-organize.name', descKey: 'tool.pdf-organize.desc' },
  { id: 'image-info', category: 'images', accept: IMG, multiple: false, nameKey: 'tool.image-info.name', descKey: 'tool.image-info.desc' },
  { id: 'image-sharpen', category: 'images', accept: IMG, multiple: true, nameKey: 'tool.image-sharpen.name', descKey: 'tool.image-sharpen.desc' },
  { id: 'txt-to-docx', category: 'documents', accept: ['.txt', '.md', '.markdown'], multiple: true, nameKey: 'tool.txt-to-docx.name', descKey: 'tool.txt-to-docx.desc' },
  { id: 'md-to-html', category: 'documents', accept: ['.md', '.markdown'], multiple: true, nameKey: 'tool.md-to-html.name', descKey: 'tool.md-to-html.desc' },
  { id: 'word-to-html', category: 'documents', accept: ['.docx'], multiple: true, nameKey: 'tool.word-to-html.name', descKey: 'tool.word-to-html.desc' },
  { id: 'audio-compress', category: 'audio', accept: ['.mp3', '.wav', '.m4a', '.aac'], multiple: true, nameKey: 'tool.audio-compress.name', descKey: 'tool.audio-compress.desc' },
  { id: 'pdf-to-html', category: 'documents', accept: ['.pdf'], multiple: false, nameKey: 'tool.pdf-to-html.name', descKey: 'tool.pdf-to-html.desc' },
  { id: 'pdf-ocr-text', category: 'documents', accept: ['.pdf'], multiple: false, nameKey: 'tool.pdf-ocr-text.name', descKey: 'tool.pdf-ocr-text.desc' },
  // Developer text tools (PRD §22) - no files, kind 'text'
  { id: 'json-format', category: 'developer', accept: [], multiple: false, kind: 'text', nameKey: 'tool.json-format.name', descKey: 'tool.json-format.desc' },
  { id: 'json-minify', category: 'developer', accept: [], multiple: false, kind: 'text', nameKey: 'tool.json-minify.name', descKey: 'tool.json-minify.desc' },
  { id: 'json-validate', category: 'developer', accept: [], multiple: false, kind: 'text', nameKey: 'tool.json-validate.name', descKey: 'tool.json-validate.desc' },
  { id: 'base64-encode', category: 'developer', accept: [], multiple: false, kind: 'text', nameKey: 'tool.base64-encode.name', descKey: 'tool.base64-encode.desc' },
  { id: 'base64-decode', category: 'developer', accept: [], multiple: false, kind: 'text', nameKey: 'tool.base64-decode.name', descKey: 'tool.base64-decode.desc' },
  { id: 'url-encode', category: 'developer', accept: [], multiple: false, kind: 'text', nameKey: 'tool.url-encode.name', descKey: 'tool.url-encode.desc' },
  { id: 'url-decode', category: 'developer', accept: [], multiple: false, kind: 'text', nameKey: 'tool.url-decode.name', descKey: 'tool.url-decode.desc' },
  { id: 'hash-generator', category: 'developer', accept: [], multiple: false, kind: 'text', nameKey: 'tool.hash-generator.name', descKey: 'tool.hash-generator.desc' },
  { id: 'uuid-generator', category: 'developer', accept: [], multiple: false, kind: 'text', nameKey: 'tool.uuid-generator.name', descKey: 'tool.uuid-generator.desc' },
  { id: 'timestamp-converter', category: 'developer', accept: [], multiple: false, kind: 'text', nameKey: 'tool.timestamp-converter.name', descKey: 'tool.timestamp-converter.desc' },
  { id: 'regex-tester', category: 'developer', accept: [], multiple: false, kind: 'text', nameKey: 'tool.regex-tester.name', descKey: 'tool.regex-tester.desc' },
];

export const POPULAR_TOOL_IDS = ['pdf-to-jpg', 'image-to-webp', 'video-to-jpg', 'pdf-merge'];

export function getTool(id: string): ToolDef | undefined {
  return TOOLS.find((t) => t.id === id);
}

/** Tools available on the current target (web-only tools hidden in the extension). */
export function visibleTools(): ToolDef[] {
  if (isExtension()) return TOOLS.filter((t) => !t.webOnly);
  return TOOLS;
}

// Synonym mapping for universal search (PRD §23), English + Indonesian.
const SYNONYMS: Record<string, string[]> = {
  'jpg-to-png': ['jpg to png', 'jpeg to png', 'jpg png', 'convert jpg', 'gambar ke png', 'foto ke png'],
  'png-to-jpg': ['png to jpg', 'png jpg', 'convert png', 'gambar ke jpg', 'foto ke jpg'],
  'image-to-webp': ['image to webp', 'webp', 'convert to webp', 'gambar ke webp', 'foto ke webp', 'kompres web'],
  'image-resize': ['resize', 'resize image', 'ukuran', 'ubah ukuran', 'resize gambar', 'kecilkan gambar', 'dimensions'],
  'image-compress': ['compress', 'compress image', 'kompres', 'kompresi', 'kompres gambar', 'optimize image', 'optimasi', 'reduce size', 'perkecil'],
  'pdf-to-jpg': ['pdf to jpg', 'pdf jpg', 'convert pdf', 'pdf ke jpg', 'pdf ke gambar', 'pdf gambar'],
  'pdf-to-png': ['pdf to png', 'pdf png', 'pdf ke png'],
  'pdf-merge': ['merge pdf', 'merge', 'gabung pdf', 'gabungkan', 'combine pdf', 'satukan'],
  'pdf-split': ['split pdf', 'split', 'pisah pdf', 'potong pdf', 'pisahkan', 'extract pages', 'ambil halaman'],
  'video-to-jpg': ['video to jpg', 'video jpg', 'frame', 'ekstrak frame', 'video ke jpg', 'video frame', 'thumbnail'],
  'video-to-png': ['video to png', 'video png', 'frame png', 'video ke png'],
  'video-to-gif': ['video to gif', 'gif', 'animasi', 'animated', 'buat gif', 'video ke gif'],
  'video-to-mp3': ['video to mp3', 'video mp3', 'extract audio', 'ekstrak audio', 'video ke mp3', 'ambil suara', 'mp4 to mp3', 'mp4 ke mp3'],
  'video-convert': ['convert video', 'konversi video', 'mp4 webm', 'mov to mp4', 'avi to mp4', 'mkv to mp4', 'webm to mp4', 'transcode', 'ubah format video'],
  'video-trim': ['trim video', 'potong video', 'trim', 'cut video', 'potong klip', 'clip'],
  'wav-to-mp3': ['wav to mp3', 'wav mp3', 'wav ke mp3', 'audio ke mp3'],
  'mp3-to-wav': ['mp3 to wav', 'mp3 wav', 'mp3 ke wav', 'convert mp3'],
  'm4a-to-mp3': ['m4a to mp3', 'm4a mp3', 'm4a ke mp3', 'aac to mp3'],
  'pdf-to-text': ['pdf to text', 'pdf text', 'pdf ke teks', 'ekstrak teks', 'extract text', 'ocr pdf'],
  'txt-to-pdf': ['txt to pdf', 'txt pdf', 'teks ke pdf', 'text ke pdf'],
  'md-to-pdf': ['markdown to pdf', 'md pdf', 'markdown ke pdf', 'md ke pdf'],
  'docx-to-txt': ['docx to txt', 'word to txt', 'word ke teks', 'doc ke teks', 'word ke txt'],
  'pdf-to-word': ['pdf to word', 'pdf word', 'pdf ke word', 'pdf docx', 'convert pdf word'],
  'word-to-pdf': ['word to pdf', 'word pdf', 'word ke pdf', 'docx to pdf', 'docx ke pdf', 'doc ke pdf'],
  'create-zip': ['create zip', 'zip', 'buat zip', 'arsip', 'archive', 'kompres file', 'zip file'],
  'extract-zip': ['extract zip', 'unzip', 'ekstrak zip', 'buka zip'],
  'extract-tar': ['extract tar', 'tar', 'tgz', 'tar gz', 'ekstrak tar', 'buka tar'],
  'image-crop': ['crop', 'crop image', 'potong gambar', 'pangkas', 'crop foto'],
  'image-rotate': ['rotate', 'flip', 'putar', 'putar gambar', 'rotate image', 'balik gambar', 'mirror'],
  'image-filters': ['filter', 'filters', 'grayscale', 'hitam putih', 'brightness', 'kecerahan', 'contrast', 'kontras', 'blur', 'efek'],
  'image-strip-metadata': ['metadata', 'exif', 'hapus metadata', 'remove metadata', 'strip exif', 'privasi foto', 'clean image'],
  'pdf-watermark': ['watermark', 'tanda air', 'cap pdf', 'stamp', 'tambah teks pdf'],
  'pdf-compress': ['compress pdf', 'kompres pdf', 'optimize pdf', 'optimasi pdf', 'reduce pdf', 'perkecil pdf'],
  'ocr-image-to-text': ['ocr', 'scan', 'gambar ke teks', 'image to text', 'baca teks', 'pindai', 'scan gambar'],
  'image-to-pdf': ['image to pdf', 'jpg to pdf', 'gambar ke pdf', 'foto ke pdf', 'png to pdf'],
  'pdf-to-webp': ['pdf to webp', 'pdf webp', 'pdf ke webp'],
  'svg-to-png': ['svg to png', 'svg png', 'svg ke png', 'vector ke png'],
  'pdf-organize': ['organize pdf', 'atur pdf', 'reorder', 'susun ulang', 'rotate pages', 'putar halaman', 'delete pages', 'hapus halaman', 'duplicate pages', 'gandakan halaman', 'extract pages'],
  'image-info': ['image info', 'info gambar', 'metadata', 'exif', 'detail gambar', 'dimensi', 'file info'],
  'image-sharpen': ['sharpen', 'tajamkan', 'pertajam', 'sharpen image', 'asah'],
  'txt-to-docx': ['txt to docx', 'txt docx', 'teks ke word', 'text to word', 'txt ke word'],
  'md-to-html': ['markdown to html', 'md html', 'markdown ke html', 'md ke html'],
  'word-to-html': ['word to html', 'word html', 'docx to html', 'docx ke html', 'word ke html'],
  'audio-compress': ['compress audio', 'kompres audio', 'kompresi audio', 'reduce audio', 'perkecil audio'],
  'pdf-to-html': ['pdf to html', 'pdf html', 'pdf ke html'],
  'pdf-ocr-text': ['pdf ocr', 'scan pdf', 'pindai pdf', 'baca pdf', 'pdf ke teks ocr'],
  'json-format': ['json', 'format json', 'formatter', 'rapikan json', 'json formatter', 'validator'],
  'json-minify': ['json minify', 'minifier', 'kecilkan json', 'json minifier'],
  'json-validate': ['json validate', 'validasi json', 'cek json', 'json validator'],
  'base64-encode': ['base64', 'encode', 'enkode', 'base64 encode', 'base64 encoder'],
  'base64-decode': ['base64 decode', 'decode base64', 'dekode', 'base64 decoder'],
  'url-encode': ['url encode', 'encode url', 'enkode url', 'url encoder', 'percent'],
  'url-decode': ['url decode', 'decode url', 'dekode url', 'url decoder'],
  'hash-generator': ['hash', 'md5', 'sha', 'sha256', 'checksum', 'hash generator'],
  'uuid-generator': ['uuid', 'guid', 'uuid generator', 'unique id', 'id unik'],
  'timestamp-converter': ['timestamp', 'epoch', 'unix time', 'waktu', 'konversi waktu', 'tanggal'],
  'regex-tester': ['regex', 'regexp', 'regular expression', 'uji regex', 'tes regex', 'pola'],
  developer: ['developer', 'pengembang', 'dev', 'json', 'base64', 'hash', 'uuid', 'regex', 'kode'],
  images: ['image', 'gambar', 'foto', 'picture', 'photo', 'img'],
  pdf: ['pdf', 'document', 'dokumen'],
  video: ['video', 'film', 'mp4', 'rekaman'],
  audio: ['audio', 'suara', 'mp3', 'musik', 'music', 'bunyi'],
  documents: ['document', 'dokumen', 'word', 'text', 'teks', 'surat', 'tulisan'],
  archives: ['archive', 'arsip', 'zip', 'kompres'],
  utilities: ['utility', 'utilitas', 'alat', 'ocr', 'scan'],
};

function norm(s: string): string {
  return s.toLowerCase().trim().replace(/→|->/g, ' to ');
}

export function searchTools(query: string, t: (key: string) => string): ToolDef[] {
  const all = visibleTools();
  const q = norm(query);
  if (!q) return all;
  const words = q.split(/\s+/);
  return all.filter((tool) => {
    const hay = norm(`${t(tool.nameKey)} ${t(tool.descKey)} ${(SYNONYMS[tool.id] ?? []).join(' ')} ${(SYNONYMS[tool.category] ?? []).join(' ')}`);
    return words.every((w) => hay.includes(w));
  });
}
