import { describe, expect, it } from 'vitest';
import { processBatch } from './queue';
import { newCancelToken } from './types';

function deferred<T = void>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('processBatch (PRD §27)', () => {
  it('caps concurrency at the worker limit', async () => {
    let live = 0;
    let peak = 0;
    const gates = Array.from({ length: 5 }, () => deferred());
    const run = processBatch([0, 1, 2, 3, 4], 2, async (_item, index, _tok, report) => {
      live++;
      peak = Math.max(peak, live);
      report({ done: 0, total: 1 });
      await gates[index].promise;
      live--;
    }, newCancelToken(), () => {});
    // Let two workers start, then release one wave at a time.
    await new Promise((r) => setTimeout(r, 20));
    expect(peak).toBeLessThanOrEqual(2);
    for (const g of gates) g.resolve();
    await run;
    expect(peak).toBe(2);
  });

  it('stops feeding new items once cancelled', async () => {
    const token = newCancelToken();
    const seen: number[] = [];
    await processBatch([0, 1, 2, 3], 1, async (item, _i, tok) => {
      seen.push(item);
      if (item === 0) tok.cancelled = true;
    }, token, () => {});
    expect(seen).toEqual([0]);
  });
});
