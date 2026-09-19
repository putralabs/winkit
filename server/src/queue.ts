import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { detectCapabilities, runTool, type Capabilities, type ToolParams } from './tools.js';

export type JobStatus = 'queued' | 'processing' | 'ready' | 'failed';

export interface Job {
  id: string;
  toolId: string;
  inputName: string;
  status: JobStatus;
  progress: number;
  error?: string;
  outName?: string;
  mime?: string;
  createdAt: number;
  dir: string;
  params?: ToolParams;
}

interface Cfg {
  dataDir: string;
  ttlMs: number;
  concurrency: number;
}

const jobs = new Map<string, Job>();
let running = 0;

export async function initStore(dataDir: string): Promise<void> {
  await mkdir(dataDir, { recursive: true });
  // Best effort: clear stale dirs from a previous run.
  for (const name of await readdir(dataDir).catch(() => [] as string[])) {
    await rm(join(dataDir, name), { recursive: true, force: true });
  }
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

export async function createJob(cfg: Cfg, toolId: string, inputName: string, bytes: Buffer): Promise<Job> {
  const id = randomUUID();
  const dir = join(cfg.dataDir, id);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'input' + safeExt(inputName)), bytes);
  const job: Job = { id, toolId, inputName, status: 'queued', progress: 0, createdAt: Date.now(), dir };
  jobs.set(id, job);
  void pump(cfg);
  return job;
}

function safeExt(name: string): string {
  const ext = '.' + (name.toLowerCase().split('.').pop() ?? 'bin').replace(/[^a-z0-9]/g, '');
  return ext.length <= 8 ? ext : '.bin';
}

async function pump(cfg: Cfg): Promise<void> {
  if (running >= cfg.concurrency) return;
  const next = [...jobs.values()].find((j) => j.status === 'queued');
  if (!next) return;
  running++;
  next.status = 'processing';
  try {
    const files = await readdir(next.dir);
    const inputFile = files.find((f) => f.startsWith('input'))!;
    const params: ToolParams = next.params ?? {};
    const res = await runTool(next.toolId, join(next.dir, inputFile), next.inputName, next.dir, params, (done, total) => {
      next.progress = total > 0 ? done / total : 0;
    });
    next.outName = res.outName;
    next.mime = res.mime;
    next.status = 'ready';
    next.progress = 1;
  } catch (e: unknown) {
    next.status = 'failed';
    next.error = (e as Error).message ?? 'failed';
  } finally {
    running--;
    void pump(cfg);
  }
}

export async function readOutput(job: Job): Promise<{ bytes: Buffer; name: string; mime: string }> {
  if (job.status !== 'ready' || !job.outName) throw new Error('not ready');
  const bytes = await readFile(join(job.dir, job.outName));
  return { bytes, name: job.outName, mime: job.mime ?? 'application/octet-stream' };
}

/** Privacy core (PRD §51): destroy a job's files now. */
export async function destroyJob(cfg: Cfg, id: string): Promise<boolean> {
  const job = jobs.get(id);
  if (!job) return false;
  jobs.delete(id);
  await rm(job.dir, { recursive: true, force: true }).catch(() => {});
  void pump(cfg);
  return true;
}

/** Automatic deletion of expired jobs (TTL sweeper). */
export function startSweeper(cfg: Cfg, everyMs = 60000): void {
  setInterval(async () => {
    const now = Date.now();
    for (const [id, job] of jobs) {
      if (now - job.createdAt > cfg.ttlMs) await destroyJob(cfg, id);
    }
    // Also sweep orphaned dirs with old mtimes.
    for (const name of await readdir(cfg.dataDir).catch(() => [] as string[])) {
      const p = join(cfg.dataDir, name);
      try {
        const st = await stat(p);
        if (now - st.mtimeMs > cfg.ttlMs) await rm(p, { recursive: true, force: true });
      } catch { /* gone */ }
    }
  }, everyMs).unref();
}

// Params ride on the job object without a schema change.
export function setParams(job: Job, params: ToolParams): void {
  job.params = params;
}

export type { Capabilities };
export { detectCapabilities };
