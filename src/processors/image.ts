import type { CancelToken, ImageFormat, ImageOptions, OutputFile, Progress } from '../shared/types';
import { baseName } from '../shared/validation';

const MIME: Record<ImageFormat, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

function extOf(format: ImageFormat): string {
  return format === 'jpg' ? 'jpg' : format;
}

/**
 * Intrinsic size of an SVG without width/height: width/height attrs, else
 * viewBox ratio at 1024 wide, else square fallback. Pure - unit-tested.
 */
export function parseSvgSize(svgText: string): { w: number; h: number } | null {
  const attr = (name: string): number | null => {
    const m = svgText.match(new RegExp(`${name}\\s*=\\s*["']\\s*([\\d.]+)`, 'i'));
    const n = m ? Number(m[1]) : NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const w = attr('width');
  const h = attr('height');
  if (w && h) return { w: Math.floor(w), h: Math.floor(h) };
  const vb = svgText.match(/viewBox\s*=\s*["']\s*[\d.]+\s+[\d.]+\s+([\d.]+)\s+([\d.]+)\s*["']/i);
  const vw = vb ? Number(vb[1]) : NaN;
  const vh = vb ? Number(vb[2]) : NaN;
  if (Number.isFinite(vw) && Number.isFinite(vh) && vw > 0 && vh > 0) {
    if (w) return { w, h: Math.max(1, Math.round((w * vh) / vw)) };
    if (h) return { w: Math.max(1, Math.round((h * vw) / vh)), h };
    return { w: 1024, h: Math.max(1, Math.round((1024 * vh) / vw)) };
  }
  return null;
}

export async function loadBitmap(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; cleanup: () => void }> {
  // createImageBitmap is fast and keeps EXIF orientation handling to the decoder.
  try {
    const bmp = await createImageBitmap(file);
    return { source: bmp, width: bmp.width, height: bmp.height, cleanup: () => bmp.close() };
  } catch {
    // Fallback for SVG and exotic inputs.
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('decode'));
        el.src = url;
      });
      let width = img.naturalWidth || img.width;
      let height = img.naturalHeight || img.height;
      if ((!width || !height) && /\.svg$/i.test(file.name)) {
        // Dimension-less SVG: <img> reports 0 - derive from the markup.
        const size = parseSvgSize(await file.text().catch(() => '')) ?? { w: 1024, h: 1024 };
        width = size.w;
        height = size.h;
      }
      if (!width || !height) throw new Error('decode');
      return { source: img, width, height, cleanup: () => URL.revokeObjectURL(url) };
    } catch {
      URL.revokeObjectURL(url);
      throw new Error('decode');
    }
  }
}

export function targetSize(
  naturalW: number,
  naturalH: number,
  width: number | null,
  height: number | null,
  keepRatio: boolean,
): { w: number; h: number } {
  let w = width && width > 0 ? Math.floor(width) : naturalW;
  let h = height && height > 0 ? Math.floor(height) : naturalH;
  if (keepRatio) {
    if (width && width > 0 && (!height || height <= 0)) {
      h = Math.max(1, Math.round((naturalH * w) / naturalW));
    } else if (height && height > 0 && (!width || width <= 0)) {
      w = Math.max(1, Math.round((naturalW * h) / naturalH));
    } else if (width && height && width > 0 && height > 0) {
      const s = Math.min(w / naturalW, h / naturalH);
      w = Math.max(1, Math.round(naturalW * s));
      h = Math.max(1, Math.round(naturalH * s));
    }
  }
  return { w: Math.max(1, w), h: Math.max(1, h) };
}

export function canvasToBlob(canvas: HTMLCanvasElement, format: ImageFormat, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    // Quality is ignored for PNG (lossless) by the platform.
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('encode'))),
      MIME[format],
      format === 'png' ? undefined : quality / 100,
    );
  });
}

/** Local-first image conversion via Canvas API. Throws on decode/encode failure. */
export async function convertImage(
  file: File,
  opts: ImageOptions,
  token: CancelToken,
  onProgress: (p: Progress) => void,
): Promise<OutputFile> {
  if (token.cancelled) throw new Error('cancelled');
  onProgress({ done: 0, total: 1 });
  const { source, width, height, cleanup } = await loadBitmap(file);
  try {
    if (token.cancelled) throw new Error('cancelled');
    const { w, h } = targetSize(width, height, opts.width, opts.height, opts.keepRatio);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('encode');
    // JPG/WebP have no alpha: flatten onto white instead of black.
    if (opts.format !== 'png') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
    }
    ctx.drawImage(source, 0, 0, w, h);
    const blob = await canvasToBlob(canvas, opts.format, opts.quality);
    canvas.width = 0;
    canvas.height = 0;
    onProgress({ done: 1, total: 1 });
    return { name: `${baseName(file.name)}.${extOf(opts.format)}`, blob, size: blob.size, width: w, height: h };
  } finally {
    cleanup();
  }
}

export function formatFromFile(file: File): ImageFormat {
  const ext = file.name.toLowerCase().split('.').pop();
  if (ext === 'png') return 'png';
  if (ext === 'webp') return 'webp';
  return 'jpg';
}

export const IMAGE_PRESET_QUALITY: Record<'max' | 'balanced' | 'smallest', number> = {
  max: 95,
  balanced: 80,
  smallest: 60,
};
