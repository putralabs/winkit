import { describe, expect, it } from 'vitest';
import { loadPdfDoc } from './pdf';
import { PDFDocument } from 'pdf-lib';
import { parseSvgSize, targetSize } from './image';

describe('parseSvgSize', () => {
  it('reads width/height attributes', () => {
    expect(parseSvgSize('<svg width="800" height="600"></svg>')).toEqual({ w: 800, h: 600 });
  });

  it('derives ratio from viewBox', () => {
    expect(parseSvgSize('<svg viewBox="0 0 200 100"></svg>')).toEqual({ w: 1024, h: 512 });
    expect(parseSvgSize('<svg width="400" viewBox="0 0 200 100"></svg>')).toEqual({ w: 400, h: 200 });
  });

  it('returns null when no size info exists', () => {
    expect(parseSvgSize('<svg></svg>')).toBeNull();
    expect(parseSvgSize('not svg at all')).toBeNull();
  });
});

describe('targetSize', () => {
  it('keeps natural size when no target given', () => {
    expect(targetSize(800, 600, null, null, true)).toEqual({ w: 800, h: 600 });
  });

  it('scales one dimension by ratio', () => {
    expect(targetSize(800, 600, 400, null, true)).toEqual({ w: 400, h: 300 });
    expect(targetSize(800, 600, null, 300, true)).toEqual({ w: 400, h: 300 });
  });

  it('fits inside the box when both are set with keepRatio', () => {
    expect(targetSize(800, 600, 400, 400, true)).toEqual({ w: 400, h: 300 });
  });

  it('uses exact dimensions without keepRatio', () => {
    expect(targetSize(800, 600, 400, 400, false)).toEqual({ w: 400, h: 400 });
  });
});

describe('loadPdfDoc', () => {
  it('loads a normal PDF and rejects garbage as non-encrypted', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([200, 200]);
    const bytes = await doc.save();
    expect((await loadPdfDoc(bytes)).getPageCount()).toBe(1);
    try {
      await loadPdfDoc(new Uint8Array([1, 2, 3, 4]));
      expect.unreachable();
    } catch (e) {
      expect((e as Error).message).not.toBe('encrypted');
    }
  });
});
