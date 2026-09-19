import { describe, expect, it } from 'vitest';
import { gzip } from 'pako';
import { archiveBaseName, extractTar } from './archive';
import { newCancelToken } from '../shared/types';

function tarEntry(name: string, body: string): Uint8Array {
  const data = new TextEncoder().encode(body);
  const head = new Uint8Array(512);
  const write = (off: number, s: string, len: number) => {
    for (let i = 0; i < Math.min(s.length, len); i++) head[off + i] = s.charCodeAt(i);
  };
  write(0, name, 100);
  write(100, '0000644', 8);
  write(124, data.length.toString(8).padStart(11, '0'), 12);
  head[156] = '0'.charCodeAt(0);
  write(257, 'ustar', 6);
  // checksum with spaces
  for (let i = 148; i < 156; i++) head[i] = 32;
  let sum = 0;
  for (const b of head) sum += b;
  write(148, sum.toString(8).padStart(6, '0') + '\0 ', 8);
  const blocks = Math.ceil(data.length / 512);
  const out = new Uint8Array(512 + blocks * 512);
  out.set(head, 0);
  out.set(data, 512);
  return out;
}

function tarball(): Uint8Array {
  const a = tarEntry('hello.txt', 'hello world');
  const b = tarEntry('dir/nested.txt', 'nested!');
  const out = new Uint8Array(a.length + b.length + 1024);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

/** Copy into a fresh ArrayBuffer so the result satisfies BlobPart. */
function ab(u: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(u.byteLength));
  out.set(u);
  return out;
}

describe('extractTar', () => {
  it('unpacks plain .tar with flattened paths', async () => {
    const f = new File([ab(tarball())], 'a.tar', { type: 'application/x-tar' });
    const out = await extractTar(f, newCancelToken(), () => {});
    expect(out.map((o) => o.name).sort()).toEqual(['dir-nested.txt', 'hello.txt']);
    expect(await out.find((o) => o.name === 'hello.txt')!.blob.text()).toBe('hello world');
  });

  it('ungzips .tgz first', async () => {
    const gz = ab(gzip(tarball()));
    const f = new File([gz], 'a.tgz', { type: 'application/gzip' });
    const out = await extractTar(f, newCancelToken(), () => {});
    expect(out).toHaveLength(2);
  });

  it('rejects garbage with corrupted', async () => {
    const f = new File([new Uint8Array([1, 2, 3, 4])], 'a.tar');
    await expect(extractTar(f, newCancelToken(), () => {})).rejects.toThrow('corrupted');
  });
});

describe('archiveBaseName', () => {
  it('strips compound extensions', () => {
    expect(archiveBaseName('backup.tar.gz')).toBe('backup');
    expect(archiveBaseName('a.tgz')).toBe('a');
    expect(archiveBaseName('a.zip')).toBe('a');
  });
});
