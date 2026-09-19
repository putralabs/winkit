import type { CancelToken, Progress } from './types';

// Controlled-concurrency batch queue (PRD §27). Default: 2 workers.
export async function processBatch<T>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number, token: CancelToken, report: (p: Progress) => void) => Promise<void>,
  token: CancelToken,
  onProgress: (done: number, total: number) => void,
): Promise<void> {
  const limit = Math.max(1, Math.min(concurrency, items.length || 1));
  let next = 0;
  let done = 0;
  const workers = Array.from({ length: limit }, async () => {
    while (!token.cancelled) {
      const i = next++;
      if (i >= items.length) return;
      await fn(items[i], i, token, (p) =>
        onProgress(Math.min(items.length, done + p.done / Math.max(1, p.total)), items.length),
      );
      done++;
      onProgress(done, items.length);
    }
  });
  await Promise.all(workers);
}
