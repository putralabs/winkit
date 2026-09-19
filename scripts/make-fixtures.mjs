// Generates small REAL fixtures for automated tests (test/fixtures/).
// Video/audio need the local ffmpeg binary; docs/archives use repo deps.
// Rerun: `node scripts/make-fixtures.mjs`. Keep every file < 1 MB.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';
import { gzip } from 'pako';

const out = new URL('../test/fixtures/', import.meta.url);
mkdirSync(out, { recursive: true });
const path = (name) => fileURLToPath(new URL(name, out));
const w = (name, data) => {
  writeFileSync(new URL(name, out), data);
  console.log(name, Buffer.byteLength(data), 'B');
};

const ff = (args) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args]);

// --- video: 0.5 s, 64x64 test pattern + 440 Hz tone ---
const src = ['-f', 'lavfi', '-i', 'testsrc=size=64x64:rate=10:duration=0.5',
  '-f', 'lavfi', '-i', 'sine=frequency=440:duration=0.5'];
ff([...src, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', path('sample.mp4')]);
ff([...src, '-c:v', 'libvpx-vp9', '-c:a', 'libopus', '-shortest', path('sample.webm')]);
ff([...src, '-c:v', 'libx264', '-c:a', 'aac', '-shortest', path('sample.mkv')]);
ff([...src, '-c:v', 'mpeg4', '-c:a', 'libmp3lame', '-shortest', path('sample.avi')]);
ff([...src, '-c:v', 'libx264', '-c:a', 'aac', '-shortest', path('sample.mov')]);
ff([...src, '-c:v', 'libx264', '-shortest', path('sample.m4v')]);

// --- audio: 0.5 s tone ---
const tone = ['-f', 'lavfi', '-i', 'sine=frequency=440:duration=0.5'];
ff([...tone, '-c:a', 'libmp3lame', path('sample.mp3')]);
ff([...tone, '-c:a', 'pcm_s16le', path('sample.wav')]);
ff([...tone, '-c:a', 'aac', path('sample.m4a')]);
ff([...tone, '-c:a', 'aac', '-f', 'adts', path('sample.aac')]);

// --- text ---
w('sample.txt', 'WinKit fixture\nSecond line.\n');
w('sample.md', '# Fixture\n\nHello **bold** and *italic*.\n\n- one\n- two\n');

// --- docx (real OOXML via the same lib the app uses): formatting kitchen sink ---
import {
  AlignmentType, Document as DocxDoc, Packer as DocxPacker, Paragraph as DocxP,
  TextRun as DocxRun, HeadingLevel, LevelFormat,
  Table as DocxTable, TableRow as DocxRow, TableCell as DocxCell,
  WidthType, ImageRun,
} from 'docx';
const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const numbering = {
  config: [
    {
      reference: 'bullets', levels: [
        { level: 0, format: LevelFormat.BULLET, text: '\u2022', alignment: AlignmentType.LEFT },
        { level: 1, format: LevelFormat.BULLET, text: '\u25E6', alignment: AlignmentType.LEFT },
      ],
    },
    {
      reference: 'decimal', levels: [
        { level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT },
      ],
    },
  ],
};
const kdoc = new DocxDoc({
  numbering,
  sections: [{ children: [
    new DocxP({ heading: HeadingLevel.HEADING_1, children: [new DocxRun('Fixture Heading One')] }),
    new DocxP({ heading: HeadingLevel.HEADING_2, children: [new DocxRun('Second Level')] }),
    new DocxP({ children: [new DocxRun('Plain eleven.')] }),
    new DocxP({ alignment: AlignmentType.CENTER, children: [new DocxRun({ text: 'Centered fourteen bold', size: 28, bold: true })] }),
    new DocxP({ alignment: AlignmentType.RIGHT, children: [new DocxRun({ text: 'Right italic', italics: true })] }),
    new DocxP({ alignment: AlignmentType.JUSTIFIED, children: [new DocxRun('Justified paragraph with enough words to wrap across the page width several times over for testing.') ] }),
    new DocxP({ numbering: { reference: 'bullets', level: 0 }, children: [new DocxRun('Bullet one')] }),
    new DocxP({ numbering: { reference: 'bullets', level: 1 }, children: [new DocxRun('Nested bullet')] }),
    new DocxP({ numbering: { reference: 'decimal', level: 0 }, children: [new DocxRun('First item')] }),
    new DocxP({ numbering: { reference: 'decimal', level: 0 }, children: [new DocxRun('Second item')] }),
    new DocxTable({
      columnWidths: [3000, 3000],
      rows: [
        new DocxRow({ children: [
          new DocxCell({ children: [new DocxP({ children: [new DocxRun({ text: 'R1C1', bold: true })] })] }),
          new DocxCell({ children: [new DocxP({ children: [new DocxRun('R1C2')] })] }),
        ] }),
        new DocxRow({ children: [
          new DocxCell({ children: [new DocxP({ children: [new DocxRun('R2C1')] })] }),
          new DocxCell({ children: [new DocxP({ children: [new DocxRun({ text: 'R2C2 big', size: 32 })] })] }),
        ] }),
      ],
    }),
    new DocxP({ children: [
      new DocxRun('Image follows: '),
      new ImageRun({ data: tinyPng, transformation: { width: 20, height: 20 } }),
    ] }),
    new DocxP({ children: [new DocxRun('Hello docx world.')] }),
  ] }],
});
w('sample.docx', Buffer.from(await DocxPacker.toBuffer(kdoc)));

// --- zip / tar / tar.gz / tgz ---
const zip = new JSZip();
zip.file('hello.txt', 'hello world');
zip.file('dir/nested.txt', 'nested!');
w('sample.zip', await zip.generateAsync({ type: 'nodebuffer' }));

function tarEntry(name, body) {
  const data = Buffer.from(body);
  const head = Buffer.alloc(512);
  head.write(name, 0);
  head.write('0000644', 100);
  head.write(data.length.toString(8).padStart(11, '0'), 124);
  head[156] = 48; // '0'
  head.write('ustar', 257);
  head.fill(32, 148, 156);
  let sum = 0;
  for (const b of head) sum += b;
  head.write(sum.toString(8).padStart(6, '0') + '\0 ', 148);
  const blocks = Math.ceil(data.length / 512);
  const out2 = Buffer.alloc(512 + blocks * 512);
  head.copy(out2, 0);
  data.copy(out2, 512);
  return out2;
}
const tar = Buffer.concat([tarEntry('hello.txt', 'hello world'), tarEntry('dir/nested.txt', 'nested!'), Buffer.alloc(1024)]);
w('sample.tar', tar);
w('sample.tar.gz', Buffer.from(gzip(tar)));
w('sample.tgz', Buffer.from(gzip(tar)));
console.log('done');
