import { GIFEncoder, applyPalette, quantize } from 'gifenc';
import type { CancelToken, OutputFile, Progress } from '../shared/types';
import { baseName } from '../shared/validation';

// Browser decode reality (Chrome, local <video>/WebAudio - no server):
// mp4/H.264 ✓ · webm/VP9 ✓ · mov/H.264 ✓ (usually) · m4v ✓ ·
// mkv codec-dependent · avi ✗ (container unsupported).
// Anything the element cannot decode surfaces as honest err.undecodable
// (wired in ToolRunner), never err.corrupted.

export interface VideoMeta {
  duration: number;
  width: number;
  height: number;
}

export type FrameMode = 'single' | 'interval' | 'count' | 'custom';

export interface FrameOptions {
  format: 'jpg' | 'png';
  quality: number;
  mode: FrameMode;
  singleTime: number;
  intervalSec: number;
  count: number;
  timestamps: string;
  maxWidth: number | null;
}

export interface GifOptions {
  intervalSec: number;
  maxFrames: number;
  width: number;
}

function loadVideo(file: File): Promise<{ video: HTMLVideoElement; cleanup: () => void }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.muted = true;
    video.preload = 'auto';
    const cleanup = () => {
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(url);
    };
    const fail = () => {
      cleanup();
      reject(new Error('decode'));
    };
    video.onloadedmetadata = () => resolve({ video, cleanup });
    video.onerror = fail;
    video.src = url;
  });
}

export async function getVideoMeta(file: File): Promise<VideoMeta> {
  const { video, cleanup } = await loadVideo(file);
  try {
    const duration = await ensureDuration(video);
    return { duration, width: video.videoWidth, height: video.videoHeight };
  } finally {
    cleanup();
  }
}

/**
 * Fragmented/odd MP4s report `Infinity` duration until a far seek forces the
 * browser to resolve real metadata. Resolves finite seconds or throws 'decode'.
 */
function ensureDuration(video: HTMLVideoElement): Promise<number> {
  if (Number.isFinite(video.duration) && video.duration > 0) return Promise.resolve(video.duration);
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('decode')), 15_000);
    const onChange = () => {
      if (Number.isFinite(video.duration) && video.duration > 0) {
        window.clearTimeout(timer);
        video.removeEventListener('durationchange', onChange);
        video.currentTime = 0;
        resolve(video.duration);
      }
    };
    video.addEventListener('durationchange', onChange);
    video.onerror = () => {
      window.clearTimeout(timer);
      video.removeEventListener('durationchange', onChange);
      reject(new Error('decode'));
    };
    video.currentTime = 1e7;
  });
}

function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('decode')), 15_000);
    const done = () => {
      window.clearTimeout(timer);
      video.onseeked = null;
      video.onerror = null;
      resolve();
    };
    video.onseeked = done;
    video.onerror = () => {
      window.clearTimeout(timer);
      reject(new Error('decode'));
    };
    video.currentTime = Math.min(Math.max(0, time), (Number.isFinite(video.duration) ? video.duration : time) - 0.05);
  });
}

/** Parse "5, 12.5, 1:30" into seconds. */
export function parseTimestamps(raw: string, duration: number): number[] {
  const out: number[] = [];
  for (const part of raw.split(',')) {
    const s = part.trim();
    if (!s) continue;
    let sec: number;
    if (s.includes(':')) {
      const [m, rest] = s.split(':');
      sec = Number(m) * 60 + Number(rest);
    } else {
      sec = Number(s);
    }
    if (Number.isFinite(sec) && sec >= 0 && sec <= duration) out.push(sec);
  }
  return [...new Set(out)].sort((a, b) => a - b);
}

export function frameTimes(mode: FrameMode, duration: number, single: number, interval: number, count: number, custom: string): number[] {
  if (mode === 'single') return [Math.min(Math.max(0, single), Math.max(0, duration - 0.05))];
  if (mode === 'interval') {
    const step = Math.max(0.2, interval);
    const times: number[] = [];
    for (let t = 0; t < duration - 0.05 && times.length < 500; t += step) times.push(t);
    return times.length > 0 ? times : [0];
  }
  if (mode === 'count') {
    const n = Math.max(1, Math.min(200, Math.floor(count)));
    if (n === 1) return [0];
    return Array.from({ length: n }, (_, i) => (duration * i) / (n - 1));
  }
  const parsed = parseTimestamps(custom, duration);
  return parsed.length > 0 ? parsed : [0];
}

function drawFrame(video: HTMLVideoElement, maxWidth: number | null): { canvas: HTMLCanvasElement; w: number; h: number } {
  const natW = video.videoWidth;
  const natH = video.videoHeight;
  let w = natW;
  let h = natH;
  if (maxWidth && maxWidth > 0 && natW > maxWidth) {
    w = maxWidth;
    h = Math.max(1, Math.round((natH * maxWidth) / natW));
  }
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('encode');
  ctx.drawImage(video, 0, 0, w, h);
  return { canvas, w, h };
}

function canvasBlob(canvas: HTMLCanvasElement, format: 'jpg' | 'png', quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (format === 'jpg') {
      const ctx = canvas.getContext('2d');
      // flatten handled by caller painting white first
      void ctx;
    }
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('encode'))),
      format === 'jpg' ? 'image/jpeg' : 'image/png',
      format === 'jpg' ? quality / 100 : undefined,
    );
  });
}

/** Extract frames locally via <video> + canvas. Cancellable between frames. */
export async function extractFrames(
  file: File,
  opts: FrameOptions,
  token: CancelToken,
  onProgress: (p: Progress) => void,
): Promise<{ outputs: OutputFile[]; meta: VideoMeta }> {
  const { video, cleanup } = await loadVideo(file);
  try {
    const meta: VideoMeta = { duration: await ensureDuration(video), width: video.videoWidth, height: video.videoHeight };
    const times = frameTimes(opts.mode, meta.duration, opts.singleTime, opts.intervalSec, opts.count, opts.timestamps);
    const outputs: OutputFile[] = [];
    for (let i = 0; i < times.length; i++) {
      if (token.cancelled) throw new Error('cancelled');
      onProgress({ done: i, total: times.length, messageKey: 'proc.renderingPage', messageParams: { done: i + 1, total: times.length } });
      await seekTo(video, times[i]);
      if (token.cancelled) throw new Error('cancelled');
      const { canvas, w, h } = drawFrame(video, opts.maxWidth);
      if (opts.format === 'jpg') {
        // putImageData overwrites (no alpha blend): composite onto white first.
        const ctx = canvas.getContext('2d')!;
        const img = ctx.getImageData(0, 0, w, h);
        const d = img.data;
        for (let i = 0; i < d.length; i += 4) {
          const a = d[i + 3] / 255;
          d[i] = d[i] * a + 255 * (1 - a);
          d[i + 1] = d[i + 1] * a + 255 * (1 - a);
          d[i + 2] = d[i + 2] * a + 255 * (1 - a);
          d[i + 3] = 255;
        }
        ctx.putImageData(img, 0, 0);
      }
      const blob = await canvasBlob(canvas, opts.format, opts.quality);
      canvas.width = 0;
      outputs.push({
        name: `${baseName(file.name)}-${String(i + 1).padStart(3, '0')}.${opts.format}`,
        blob,
        size: blob.size,
        width: w,
        height: h,
      });
      onProgress({ done: i + 1, total: times.length });
    }
    return { outputs, meta };
  } finally {
    cleanup();
  }
}

/** Build an animated GIF from sampled frames (gifenc, pure local). */
export async function videoToGif(
  file: File,
  opts: GifOptions,
  token: CancelToken,
  onProgress: (p: Progress) => void,
): Promise<OutputFile> {
  const { video, cleanup } = await loadVideo(file);
  try {
    const duration = await ensureDuration(video);
    const step = Math.max(0.2, opts.intervalSec);
    const times: number[] = [];
    for (let t = 0; t < duration - 0.05 && times.length < opts.maxFrames; t += step) times.push(t);
    if (times.length === 0) times.push(0);
    const gif = GIFEncoder();
    let w = 0;
    let h = 0;
    for (let i = 0; i < times.length; i++) {
      if (token.cancelled) throw new Error('cancelled');
      onProgress({ done: i, total: times.length, messageKey: 'proc.processingFile', messageParams: { done: i + 1, total: times.length } });
      await seekTo(video, times[i]);
      const { canvas, w: cw, h: ch } = drawFrame(video, opts.width);
      w = cw;
      h = ch;
      const ctx = canvas.getContext('2d')!;
      const data = ctx.getImageData(0, 0, w, h).data;
      // Yield so the UI stays responsive during quantization.
      await new Promise((r) => setTimeout(r, 0));
      const palette = quantize(data, 256);
      const index = applyPalette(data, palette);
      gif.writeFrame(index, w, h, { palette, delay: Math.round(step * 1000) });
      canvas.width = 0;
      onProgress({ done: i + 1, total: times.length });
    }
    gif.finish();
    const bytes = gif.bytes();
    // slice(): bytes may be a view into a larger pool - copy first.
    const blob = new Blob([bytes.slice().buffer as ArrayBuffer], { type: 'image/gif' });
    return { name: `${baseName(file.name)}.gif`, blob, size: blob.size, width: w, height: h };
  } finally {
    cleanup();
  }
}
