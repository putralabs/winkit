import { getSettings } from './storage';
import type { CancelToken, Progress } from './types';

// Cloud processing client (PRD §50–51) against the scaffold server.
// Local-first is untouched: cloud runs only when the user explicitly
// chooses it per file, after the §51 consent dialog (unless they disabled
// ask-before-cloud). Nothing uploads silently, ever.

export interface CloudJob {
  id: string;
  toolId: string;
  status: 'uploading' | 'processing' | 'ready' | 'failed';
}

export interface CloudAdapter {
  submit(toolId: string, files: File[]): Promise<CloudJob>;
  download(job: CloudJob): Promise<Blob>;
  cancel(job: CloudJob): Promise<void>;
}

export interface CloudResult {
  blob: Blob;
  name: string;
}

/** Cloud tools the scaffold server can run (subset of registry ids). */
export const CLOUD_TOOL_MAP: Record<string, string> = {
  'video-convert': 'video-transcode',
  'video-trim': 'video-transcode',
  'pdf-to-word': 'pdf-to-word-cloud',
  'word-to-pdf': 'doc-convert',
  'pdf-compress': 'doc-convert',
};

export async function cloudConfigured(): Promise<boolean> {
  const s = await getSettings();
  return s.cloudUrl.trim().length > 0;
}

function base(): Promise<{ url: string; key: string }> {
  return getSettings().then((s) => ({
    url: s.cloudUrl.trim().replace(/\/+$/, ''),
    key: s.cloudKey,
  }));
}

async function api(path: string, init: RequestInit, key: string): Promise<Response> {
  const res = await fetch(path, {
    ...init,
    headers: { ...(init.headers ?? {}), ...(key ? { 'X-API-Key': key } : {}) },
  });
  if (res.status === 401) throw new Error('cloud-auth');
  return res;
}

/**
 * Full lifecycle: Upload → poll → Download → server auto-deletes.
 * Throws 'cloud-offline' | 'cloud-auth' | 'cloud-failed:<msg>' | 'cancelled'.
 */
export async function runCloudJob(
  serverTool: string,
  file: File,
  params: Record<string, string>,
  token: CancelToken,
  onProgress: (p: Progress) => void,
): Promise<CloudResult> {
  const { url, key } = await base();
  if (!url) throw new Error('cloud-unconfigured');
  onProgress({ done: 0, total: 100 });

  const form = new FormData();
  form.append('file', file, file.name);
  if (params.password) form.append('password', params.password);
  const qs = new URLSearchParams({ tool: serverTool, ...params }).toString();
  let res: Response;
  try {
    res = await api(`${url}/v1/jobs?${qs}`, { method: 'POST', body: form, signal: abortOn(token) }, key);
  } catch (e) {
    if (token.cancelled) throw new Error('cancelled');
    throw new Error('cloud-offline');
  }
  if (!res.ok) throw new Error('cloud-failed:submit');
  const { id } = (await res.json()) as { id: string };
  if (token.cancelled) {
    await api(`${url}/v1/jobs/${id}`, { method: 'DELETE' }, key).catch(() => {});
    throw new Error('cancelled');
  }

  // Poll status until ready/failed.
  for (let i = 0; i < 600; i++) {
    if (token.cancelled) {
      await api(`${url}/v1/jobs/${id}`, { method: 'DELETE' }, key).catch(() => {});
      throw new Error('cancelled');
    }
    await sleep(1000);
    let st: Response;
    try {
      st = await api(`${url}/v1/jobs/${id}`, {}, key);
    } catch {
      throw new Error('cloud-offline');
    }
    if (st.status === 404) throw new Error('cloud-failed:gone');
    const body = (await st.json()) as { status: string; progress: number; error?: string };
    onProgress({ done: 5 + Math.round((body.progress ?? 0) * 90), total: 100 });
    if (body.status === 'ready') break;
    if (body.status === 'failed') throw new Error(`cloud-failed:${body.error ?? 'processing'}`);
  }

  const dl = await api(`${url}/v1/jobs/${id}/download`, {}, key);
  if (!dl.ok) throw new Error('cloud-failed:download');
  const blob = await dl.blob();
  const disp = dl.headers.get('content-disposition') ?? '';
  const m = disp.match(/filename="([^"]+)"/);
  onProgress({ done: 100, total: 100 });
  return { blob, name: m?.[1] ?? `${file.name}.out` };
}

function abortOn(token: CancelToken): AbortSignal {
  const c = new AbortController();
  const t = window.setInterval(() => {
    if (token.cancelled) {
      c.abort();
      window.clearInterval(t);
    }
  }, 200);
  window.setTimeout(() => window.clearInterval(t), 300000);
  return c.signal;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function fetchCapabilities(): Promise<{ tools: string[]; ffmpeg: boolean; soffice: boolean; qpdf: boolean } | null> {
  try {
    const { url, key } = await base();
    if (!url) return null;
    const res = await api(`${url}/v1/capabilities`, {}, key);
    if (!res.ok) return null;
    return (await res.json()) as { tools: string[]; ffmpeg: boolean; soffice: boolean; qpdf: boolean };
  } catch {
    return null;
  }
}
