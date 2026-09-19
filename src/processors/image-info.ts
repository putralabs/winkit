import exifr from 'exifr';

export interface ImageInfo {
  name: string;
  size: number;
  width: number;
  height: number;
  format: string;
  mime: string;
  exif: { tag: string; value: string }[];
}

/** Image information viewer (PRD §15.4): file props + dimensions + EXIF. */
export async function inspectImage(file: File): Promise<ImageInfo> {
  const ext = (file.name.toLowerCase().split('.').pop() ?? '').toUpperCase();
  let width = 0;
  let height = 0;
  try {
    const bmp = await createImageBitmap(file);
    width = bmp.width;
    height = bmp.height;
    bmp.close();
  } catch {
    // dimensions stay 0 for undecodable inputs
  }
  const exif: { tag: string; value: string }[] = [];
  try {
    const tags = (await exifr.parse(file)) as Record<string, unknown> | undefined;
    if (tags) {
      for (const [k, v] of Object.entries(tags)) {
        if (v === null || v === undefined || typeof v === 'object') continue;
        exif.push({ tag: k, value: String(v) });
        if (exif.length >= 40) break;
      }
    }
  } catch {
    // no EXIF - normal for PNG/WebP/screenshots
  }
  return { name: file.name, size: file.size, width, height, format: ext || '-', mime: file.type || '-', exif };
}
