import { describe, expect, it } from 'vitest';
import {
  base64Decode,
  base64Encode,
  convertTimestamp,
  genUuids,
  hashText,
  jsonMinify,
  jsonPretty,
  jsonValidate,
  testRegex,
  urlDecode,
  urlEncode,
} from '../processors/textops';

describe('json', () => {
  it('pretty-prints, minifies and validates', () => {
    expect(jsonPretty('{"b":2,"a":1}')).toBe('{\n  "b": 2,\n  "a": 1\n}');
    expect(jsonMinify('{ "a" : [1, 2] }')).toBe('{"a":[1,2]}');
    expect(jsonValidate('{"ok":true}')).toEqual({ ok: true });
    expect(jsonValidate('{nope').ok).toBe(false);
  });
});

describe('base64 / url', () => {
  it('round-trips unicode text', () => {
    const s = 'halo ✓ 世界';
    expect(base64Decode(base64Encode(s))).toBe(s);
    expect(urlDecode(urlEncode(s))).toBe(s);
  });

  it('rejects broken base64', () => {
    expect(() => base64Decode('!!!not-base64!!!')).toThrow();
  });
});

describe('hash', () => {
  it('matches known vectors', async () => {
    expect(await hashText('abc', 'md5')).toBe('900150983cd24fb0d6963f7d28e17f72');
    expect(await hashText('abc', 'sha256')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(await hashText('abc', 'sha1')).toHaveLength(40);
    expect(await hashText('abc', 'sha512')).toHaveLength(128);
  });
});

describe('uuid / timestamp / regex', () => {
  it('generates well-formed UUIDs', () => {
    const lines = genUuids(3).split('\n');
    expect(lines).toHaveLength(3);
    for (const l of lines) {
      expect(l).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    }
  });

  it('converts epoch 0 and ISO both ways', () => {
    expect(convertTimestamp('0')).toContain('1970');
    expect(convertTimestamp('2026-01-01T00:00:00Z')).toContain('ms:');
  });

  it('finds regex matches with indices', () => {
    const hits = testRegex('(\\w+)@(\\w+)', 'g', 'mail a@b and c@d');
    expect(hits.map((h) => h.match)).toEqual(['a@b', 'c@d']);
    expect(hits[0].index).toBe(5);
  });

  it('throws on invalid pattern', () => {
    expect(() => testRegex('([', 'g', 'x')).toThrow();
  });
});
