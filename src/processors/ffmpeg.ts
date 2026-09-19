import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import type { CancelToken, OutputFile, Progress } from '../shared/types';
import { baseName } from '../shared/validation';

// FFmpeg only runs on the website target: it needs SharedArrayBuffer
// (multi-thread). Dev, static server, and hosting all send COOP/COEP, so
// crossOriginIsolated is always true there. Extension pages cannot receive
// those headers, so these tools are gated web-only in the registry.
//
// The multi-thread core wasm alone is over 25 MB, past static hosting file
// limits, so it is NOT bundled. It downloads once from CDN, then Cache
// Storage serves it (offline-capable after the first load).

// Pinned to the last bundled @ffmpeg/core-mt - keep in sync on upgrade.
const CORE_VER = '0.12.10';
const CORE_BASE = `https://cdn.jsdelivr.net/npm/@ffmpeg/core-mt@${CORE_VER}/dist/esm`;

/** CDN fetch with Cache Storage: first load needs internet, later loads do not. */
async function coreBlobUrl(name: string): Promise<string> {
  const url = `${CORE_BASE}/${name}`;
  try {
    const cache = await caches.open('winkit-ffmpeg-core');
    const hit = await cache.match(url);
    if (hit) return URL.createObjectURL(await hit.blob());
    const res = await fetch(url);
    if (!res.ok) throw new Error('fetch-core');
    await cache.put(url, res.clone());
    return URL.createObjectURL(await res.blob());
  } catch (e) {
    if ((e as Error)?.message === 'fetch-core') throw e;
    // No Cache Storage here: straight download, internet required.
    const res = await fetch(url);
    if (!res.ok) throw new Error('fetch-core');
    return URL.createObjectURL(await res.blob());
  }
}

let inst: FFmpeg | null = null;

export function ffmpegThreadMode(): 'multi' | 'single' {
  return typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated ? 'multi' : 'single';
}

async function ensureFFmpeg(): Promise<FFmpeg> {
  if (inst) return inst;
  if (ffmpegThreadMode() !== 'multi') throw new Error('needs-isolation');
  const ff = new FFmpeg();
  const [coreURL, wasmURL, workerURL] = await Promise.all([
    coreBlobUrl('ffmpeg-core.js'),
    coreBlobUrl('ffmpeg-core.wasm'),
    coreBlobUrl('ffmpeg-core.worker.js'),
  ]);
  await ff.load({ coreURL, wasmURL, workerURL });
  inst = ff;
  return ff;
}

function extOf(name: string): string {
  return (name.toLowerCase().split('.').pop() ?? 'mp4').replace(/[^a-z0-9]/g, '');
}

export interface ConvertOptions {
  format: 'mp4' | 'webm';
  quality: 'low' | 'medium' | 'high';
  maxWidth: number | null;
}

/** Transcode between MP4/WebM containers (H.264/AAC or VP9/Opus). */
export async function transcodeVideo(
  file: File,
  opts: ConvertOptions,
  token: CancelToken,
  onProgress: (p: Progress) => void,
): Promise<OutputFile> {
  const ff = await ensureFFmpeg();
  if (token.cancelled) throw new Error('cancelled');
  const abort = new AbortController();
  const poll = window.setInterval(() => {
    if (token.cancelled) abort.abort();
  }, 250);
  const onProg = ({ progress }: { progress: number }) => {
    const pct = Math.max(0, Math.min(1, progress));
    onProgress({ done: Math.round(pct * 100), total: 100 });
  };
  ff.on('progress', onProg);
  const inName = `in.${extOf(file.name)}`;
  const outName = `out.${opts.format}`;
  try {
    onProgress({ done: 0, total: 100 });
    await ff.writeFile(inName, await fetchFile(file));
    const args = ['-i', inName];
    if (opts.maxWidth && opts.maxWidth > 0) {
      args.push('-vf', `scale=${Math.floor(opts.maxWidth)}:-2`);
    }
    if (opts.format === 'mp4') {
      const crf = opts.quality === 'high' ? '18' : opts.quality === 'medium' ? '23' : '28';
      args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', crf, '-c:a', 'aac', '-movflags', '+faststart', outName);
    } else {
      const crf = opts.quality === 'high' ? '15' : opts.quality === 'medium' ? '25' : '35';
      args.push('-c:v', 'libvpx-vp9', '-crf', crf, '-b:v', '0', '-c:a', 'libopus', outName);
    }
    const code = await ff.exec(args, -1, { signal: abort.signal });
    if (code !== 0) throw new Error('encode');
    const data = (await ff.readFile(outName)) as Uint8Array;
    const blob = new Blob([new Uint8Array(data)], { type: opts.format === 'mp4' ? 'video/mp4' : 'video/webm' });
    onProgress({ done: 100, total: 100 });
    return { name: `${baseName(file.name)}.${opts.format}`, blob, size: blob.size };
  } catch (e) {
    if (token.cancelled || abort.signal.aborted) throw new Error('cancelled');
    throw e;
  } finally {
    window.clearInterval(poll);
    ff.off('progress', onProg);
    await ff.deleteFile(inName).catch(() => {});
    await ff.deleteFile(outName).catch(() => {});
  }
}

/** Trim a clip with stream copy (fast, no re-encode). Output keeps a sane container. */
export async function trimVideo(
  file: File,
  startSec: number,
  endSec: number | null,
  token: CancelToken,
  onProgress: (p: Progress) => void,
): Promise<OutputFile> {
  const ff = await ensureFFmpeg();
  if (token.cancelled) throw new Error('cancelled');
  const abort = new AbortController();
  const poll = window.setInterval(() => {
    if (token.cancelled) abort.abort();
  }, 250);
  const inName = `in.${extOf(file.name)}`;
  const keepExt = ['mp4', 'webm', 'mov', 'm4v', 'mkv'].includes(extOf(file.name));
  const outExt = keepExt ? (extOf(file.name) === 'mov' || extOf(file.name) === 'm4v' ? 'mp4' : extOf(file.name)) : 'mp4';
  const outName = `trim.${outExt}`;
  try {
    onProgress({ done: 0, total: 1 });
    await ff.writeFile(inName, await fetchFile(file));
    const args = ['-ss', String(Math.max(0, startSec)), '-i', inName];
    if (endSec !== null && endSec > startSec) args.push('-t', String(endSec - startSec));
    args.push('-c', 'copy', '-movflags', '+faststart', outName);
    const code = await ff.exec(args, -1, { signal: abort.signal });
    if (code !== 0) throw new Error('encode');
    const data = (await ff.readFile(outName)) as Uint8Array;
    const blob = new Blob([new Uint8Array(data)], { type: 'video/mp4' });
    onProgress({ done: 1, total: 1 });
    return { name: `${baseName(file.name)}-trim.${outExt}`, blob, size: blob.size };
  } catch (e) {
    if (token.cancelled || abort.signal.aborted) throw new Error('cancelled');
    throw e;
  } finally {
    window.clearInterval(poll);
    await ff.deleteFile(inName).catch(() => {});
    await ff.deleteFile(outName).catch(() => {});
  }
}
