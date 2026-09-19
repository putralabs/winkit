import { describe, expect, it } from 'vitest';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as pdfjs from 'pdfjs-dist';
import { mdToHtml, modelToBlocks, readDocxModel, renderDocxPdf, textToDocx, type DocxBlock } from './document';
import { newCancelToken } from '../shared/types';

const fixture = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'test', 'fixtures', 'sample.docx');
const load = async (): Promise<DocxBlock[]> => modelToBlocks(await readDocxModel({ path: fixture }));

describe('mdToHtml', () => {
  it('renders headings, lists and inline marks', async () => {
    const f = new File(['# Title\n\nHello **bold** and `code`.\n\n- one\n- two\n\n[link](https://x.test)'], 'a.md');
    const out = await mdToHtml(f, newCancelToken());
    expect(out.name).toBe('a.html');
    expect(await out.blob.text()).toContain('<h1>Title</h1>');
    expect(await out.blob.text()).toContain('<ul>');
    expect(await out.blob.text()).toContain('<strong>bold</strong>');
  });
});

describe('textToDocx', () => {
  it('packs lines into a docx blob', async () => {
    const f = new File(['line one\nline two'], 'a.txt');
    const out = await textToDocx(f, 'txt', newCancelToken());
    expect(out.name).toBe('a.docx');
    expect(out.size).toBeGreaterThan(1000);
  });
});

describe('modelToBlocks (kitchen-sink fixture)', () => {
  it('keeps heading sizes, alignment, bold and italic per run', async () => {
    const blocks = await load();
    const paras = blocks.filter((b) => b.kind === 'para');
    expect(paras[0]).toMatchObject({
      kind: 'para',
      para: { align: 'left', runs: [{ text: 'Fixture Heading One', bold: true, size: 16 }] },
    });
    expect(paras[3]).toMatchObject({
      kind: 'para',
      para: { align: 'center', runs: [{ text: 'Centered fourteen bold', bold: true, size: 14 }] },
    });
    expect(paras[4]).toMatchObject({
      kind: 'para',
      para: { align: 'right', runs: [{ text: 'Right italic', italic: true }] },
    });
    expect(paras[5]).toMatchObject({ kind: 'para', para: { align: 'justify' } });
  });

  it('keeps bullet/ordered lists with levels', async () => {
    const blocks = await load();
    const lists = blocks.filter((b) => b.kind === 'para' && b.para.list !== null);
    expect(lists.map((b) => (b.kind === 'para' ? b.para.list : null))).toEqual([
      { ordered: false, level: 0 },
      { ordered: false, level: 1 },
      { ordered: true, level: 0 },
      { ordered: true, level: 0 },
    ]);
  });

  it('keeps tables with per-cell formatting', async () => {
    const blocks = await load();
    const table = blocks.find((b) => b.kind === 'table');
    expect(table?.kind).toBe('table');
    if (table?.kind !== 'table') return;
    expect(table.rows).toHaveLength(2);
    expect(table.rows[0][0][0].runs).toEqual([
      { text: 'R1C1', bold: true, italic: false, underline: false, size: 11, font: 'helvetica' },
    ]);
    expect(table.rows[1][1][0].runs[0]).toMatchObject({ text: 'R2C2 big', size: 16 });
  });

  it('emits the inline image with natural size', async () => {
    const blocks = await load();
    const img = blocks.find((b) => b.kind === 'image');
    expect(img).toMatchObject({ kind: 'image', format: 'PNG' });
    if (img?.kind !== 'image') return;
    expect(img.widthMm).toBeGreaterThan(0);
    expect(img.heightMm).toBeGreaterThan(0);
    expect(img.data.length).toBeGreaterThan(50);
  });

  it('renders the full fixture to a real PDF', async () => {
    const blocks = await load();
    const out = renderDocxPdf('sample', blocks, newCancelToken());
    expect(out.name).toBe('sample.pdf');
    const head = new Uint8Array(await out.blob.slice(0, 5).arrayBuffer());
    expect(String.fromCharCode(...head)).toBe('%PDF-');
    expect(out.size).toBeGreaterThan(3000);
  });

  it('respects cancellation and empty input', async () => {
    const blocks = await load();
    const token = newCancelToken();
    token.cancelled = true;
    expect(() => renderDocxPdf('x', blocks, token)).toThrow('cancelled');
    expect(await modelToBlocks({ type: 'document', children: [] })).toEqual([]);
  });

  it('numbers ordered lists from 1 in the rendered PDF', async () => {
    const blocks = await load();
    const out = renderDocxPdf('sample', blocks, newCancelToken());
    const data = new Uint8Array(await out.blob.arrayBuffer());
    const pdf = await pdfjs.getDocument({ data, useWorkerFetch: false, isEvalSupported: false }).promise;
    try {
      const tc = await (await pdf.getPage(1)).getTextContent();
      const strs = (tc.items as Array<{ str: string }>).map((i) => i.str);
      // Prefix may merge into the item text; numbering must start at 1.
      expect(strs.some((s) => /(^|\s)1\.\s/.test(s))).toBe(true);
      expect(strs.some((s) => /(^|\s)2\.\s/.test(s))).toBe(true);
      expect(strs.some((s) => /(^|\s)3\.\s/.test(s))).toBe(false);
    } finally {
      await pdf.destroy();
    }
  });
});
