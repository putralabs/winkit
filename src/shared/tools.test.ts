import { describe, expect, it } from 'vitest';
import en from './locales/en.json';
import id from './locales/id.json';
import { TOOLS, getTool, searchTools } from './tools';

const t = (key: string): string => (en as Record<string, string>)[key] ?? key;

describe('registry', () => {
  it('every tool has name+desc keys in both locales', () => {
    for (const tool of TOOLS) {
      expect((en as Record<string, string>)[tool.nameKey], tool.id).toBeTruthy();
      expect((en as Record<string, string>)[tool.descKey], tool.id).toBeTruthy();
      expect((id as Record<string, string>)[tool.nameKey], tool.id).toBeTruthy();
      expect((id as Record<string, string>)[tool.descKey], tool.id).toBeTruthy();
    }
  });

  it('text tools carry kind=text and empty accept', () => {
    const text = TOOLS.filter((x) => x.kind === 'text');
    expect(text.length).toBeGreaterThan(5);
    for (const x of text) expect(x.accept).toEqual([]);
  });
});

describe('searchTools (PRD §23)', () => {
  it('finds jpg tools for "jpg"', () => {
    const ids = searchTools('jpg', t).map((x) => x.id);
    expect(ids).toContain('pdf-to-jpg');
    expect(ids).toContain('video-to-jpg');
    expect(ids).toContain('png-to-jpg');
  });

  it('supports Indonesian synonyms', () => {
    const ids = searchTools('gambar', t).map((x) => x.id);
    expect(ids).toContain('image-to-webp');
    expect(ids).toContain('image-resize');
    expect(ids).toContain('image-crop');
  });

  it('returns nothing for gibberish, everything for empty', () => {
    expect(searchTools('zzzqqq', t)).toEqual([]);
    expect(searchTools('', t).length).toBe(TOOLS.length);
  });

  it('getTool resolves popular ids', () => {
    expect(getTool('pdf-to-jpg')?.category).toBe('pdf');
    expect(getTool('nope')).toBeUndefined();
  });
});
