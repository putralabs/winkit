import JSZip from 'jszip';
import type { OutputFile } from './types';
import { downloadFile } from './platform';

// Single file → direct download. Multiple → Download All + Download ZIP (PRD §32).
export async function downloadBlob(blob: Blob, filename: string): Promise<void> {
  await downloadFile(blob, filename);
}

export async function downloadAll(files: OutputFile[]): Promise<void> {
  for (const f of files) {
    await downloadBlob(f.blob, f.name);
  }
}

export async function downloadZip(files: OutputFile[], zipName: string): Promise<void> {
  const zip = new JSZip();
  for (const f of files) zip.file(f.name, f.blob);
  const blob = await zip.generateAsync({ type: 'blob' });
  await downloadBlob(blob, zipName);
}

/** Revoke preview object URLs to free memory (PRD §76). */
export function revokeUrls(urls: string[]): void {
  for (const u of urls) URL.revokeObjectURL(u);
}
