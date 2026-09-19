import type { CancelToken, ImageFormat, OutputFile, Progress } from '../shared/types';
import { baseName } from '../shared/validation';
import { canvasToBlob, formatFromFile, loadBitmap } from './image';

export interface CropOptions {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Crop to an explicit pixel rectangle (clamped to the image bounds). */
export async function cropImage(
  file: File,
  opts: CropOptions,
  token: CancelToken,
  natural?: { width: number; height: number },
): Promise<{ output: OutputFile; natural: { width: number; height: number } }> {
  const { source, width, height, cleanup } = await loadBitmap(file);
  try {
    if (token.cancelled) throw new Error('cancelled');
    const nat = natural ?? { width, height };
    const x = Math.max(0, Math.min(Math.floor(opts.x), width - 1));
    const y = Math.max(0, Math.min(Math.floor(opts.y), height - 1));
    const w = Math.max(1, Math.min(Math.floor(opts.w), width - x));
    const h = Math.max(1, Math.min(Math.floor(opts.h), height - y));
    const format = formatFromFile(file);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('encode');
    if (format !== 'png') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
    }
    ctx.drawImage(source, x, y, w, h, 0, 0, w, h);
    const blob = await canvasToBlob(canvas, format, 92);
    canvas.width = 0;
    return { output: { name: `${baseName(file.name)}-crop.${format === 'jpg' ? 'jpg' : format}`, blob, size: blob.size, width: w, height: h }, natural: nat };
  } finally {
    cleanup();
  }
}

export interface RotateOptions {
  angle: 0 | 90 | 180 | 270;
  flipH: boolean;
  flipV: boolean;
}

/** Rotate + flip via canvas transforms (lossless dimensions, re-encoded). */
export async function rotateFlipImage(
  file: File,
  opts: RotateOptions,
  token: CancelToken,
  onProgress: (p: Progress) => void,
): Promise<OutputFile> {
  onProgress({ done: 0, total: 1 });
  const { source, width, height, cleanup } = await loadBitmap(file);
  try {
    if (token.cancelled) throw new Error('cancelled');
    const swap = opts.angle === 90 || opts.angle === 270;
    const w = swap ? height : width;
    const h = swap ? width : height;
    const format = formatFromFile(file);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('encode');
    if (format !== 'png') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
    }
    ctx.translate(w / 2, h / 2);
    ctx.rotate((opts.angle * Math.PI) / 180);
    ctx.scale(opts.flipH ? -1 : 1, opts.flipV ? -1 : 1);
    ctx.drawImage(source, -width / 2, -height / 2, width, height);
    const blob = await canvasToBlob(canvas, format, 92);
    canvas.width = 0;
    onProgress({ done: 1, total: 1 });
    return { name: `${baseName(file.name)}-rotated.${format === 'jpg' ? 'jpg' : format}`, blob, size: blob.size, width: w, height: h };
  } finally {
    cleanup();
  }
}

export interface FilterOptions {
  grayscale: boolean;
  /** percent, 100 = unchanged */
  brightness: number;
  contrast: number;
  saturate: number;
  /** px, 0 = off */
  blur: number;
}

/** Brightness/contrast/saturate/blur/grayscale via canvas filter (local). */
export async function filterImage(
  file: File,
  opts: FilterOptions,
  token: CancelToken,
  onProgress: (p: Progress) => void,
): Promise<OutputFile> {
  onProgress({ done: 0, total: 1 });
  const { source, width, height, cleanup } = await loadBitmap(file);
  try {
    if (token.cancelled) throw new Error('cancelled');
    const format = formatFromFile(file);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('encode');
    if (!('filter' in ctx)) throw new Error('unsupported');
    if (format !== 'png') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
    }
    const parts = [
      opts.grayscale ? 'grayscale(100%)' : '',
      `brightness(${opts.brightness}%)`,
      `contrast(${opts.contrast}%)`,
      `saturate(${opts.saturate}%)`,
      opts.blur > 0 ? `blur(${opts.blur}px)` : '',
    ].filter(Boolean);
    ctx.filter = parts.join(' ');
    ctx.drawImage(source, 0, 0);
    ctx.filter = 'none';
    const blob = await canvasToBlob(canvas, format, 90);
    canvas.width = 0;
    onProgress({ done: 1, total: 1 });
    return { name: `${baseName(file.name)}-filtered.${format === 'jpg' ? 'jpg' : format}`, blob, size: blob.size, width, height };
  } finally {
    cleanup();
  }
}

/**
 * Strip metadata (EXIF etc.): canvas re-encode never carries metadata.
 * Output keeps the same format.
 */
export async function stripMetadata(
  file: File,
  token: CancelToken,
  onProgress: (p: Progress) => void,
): Promise<{ output: OutputFile; savedBytes: number }> {
  onProgress({ done: 0, total: 1 });
  const { source, width, height, cleanup } = await loadBitmap(file);
  try {
    if (token.cancelled) throw new Error('cancelled');
    const format: ImageFormat = formatFromFile(file);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('encode');
    if (format !== 'png') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
    }
    ctx.drawImage(source, 0, 0);
    const blob = await canvasToBlob(canvas, format, 92);
    canvas.width = 0;
    onProgress({ done: 1, total: 1 });
    const ext = format === 'jpg' ? 'jpg' : format;
    return {
      output: { name: `${baseName(file.name)}-clean.${ext}`, blob, size: blob.size, width, height },
      savedBytes: Math.max(0, file.size - blob.size),
    };
  } finally {
    cleanup();
  }
}

/** Sharpen via 3×3 convolution kernel (local, amount 1–100). */
export async function sharpenImage(
  file: File,
  amount: number,
  token: CancelToken,
  onProgress: (p: Progress) => void,
): Promise<OutputFile> {
  onProgress({ done: 0, total: 2 });
  const { source, width, height, cleanup } = await loadBitmap(file);
  try {
    if (token.cancelled) throw new Error('cancelled');
    const format = formatFromFile(file);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('encode');
    ctx.drawImage(source, 0, 0);
    const img = ctx.getImageData(0, 0, width, height);
    const src = img.data;
    const dst = new Uint8ClampedArray(src);
    const k = Math.max(1, Math.min(100, amount)) / 100;
    const c = 1 + 4 * k;
    onProgress({ done: 1, total: 2 });
    for (let y = 1; y < height - 1; y++) {
      if (token.cancelled) throw new Error('cancelled');
      for (let x = 1; x < width - 1; x++) {
        const i = (y * width + x) * 4;
        for (let ch = 0; ch < 3; ch++) {
          dst[i + ch] =
            src[i + ch] * c -
            k * (src[i - 4 + ch] + src[i + 4 + ch] + src[i - width * 4 + ch] + src[i + width * 4 + ch]);
        }
      }
      if (y % 256 === 0) await new Promise((r) => setTimeout(r, 0));
    }
    ctx.putImageData(new ImageData(dst, width, height), 0, 0);
    const blob = await canvasToBlob(canvas, format, 92);
    canvas.width = 0;
    onProgress({ done: 2, total: 2 });
    const ext = format === 'jpg' ? 'jpg' : format;
    return { name: `${baseName(file.name)}-sharp.${ext}`, blob, size: blob.size, width, height };
  } finally {
    cleanup();
  }
}
