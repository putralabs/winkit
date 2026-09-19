import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

async function hasBinary(bin: string, probe: string[]): Promise<boolean> {
  try {
    await run(bin, probe, { timeout: 15000 });
    return true;
  } catch {
    return false;
  }
}

export interface Capabilities {
  ffmpeg: boolean;
  soffice: boolean;
  qpdf: boolean;
  /** tool ids this server instance can actually run right now */
  tools: string[];
}

export async function detectCapabilities(): Promise<Capabilities> {
  const [ffmpeg, soffice, qpdf] = await Promise.all([
    hasBinary('ffmpeg', ['-version']),
    hasBinary('soffice', ['--version']),
    hasBinary('qpdf', ['--version']),
  ]);
  const tools: string[] = [];
  if (ffmpeg) tools.push('video-transcode', 'video-subtitles');
  if (soffice) tools.push('doc-convert', 'pdf-to-word-cloud');
  if (qpdf) tools.push('pdf-encrypt', 'pdf-decrypt');
  return { ffmpeg, soffice, qpdf, tools };
}

export interface ToolParams {
  format?: string;
  quality?: string;
  maxWidth?: number;
  password?: string;
  fromLang?: string;
}

function extOf(name: string): string {
  return (name.toLowerCase().split('.').pop() ?? 'bin').replace(/[^a-z0-9]/g, '') || 'bin';
}

/**
 * Run one cloud tool. Throws with code 'unavailable' when the required
 * binary is missing, 'failed' when processing itself errors.
 * Pure local binaries only - no third-party calls, ever.
 */
export async function runTool(
  toolId: string,
  inputPath: string,
  inputName: string,
  outDir: string,
  params: ToolParams,
  onProgress: (done: number, total: number) => void,
): Promise<{ outPath: string; outName: string; mime: string }> {
  onProgress(0, 1);
  const base = inputName.replace(/\.[^.]+$/, '') || 'output';
  try {
    switch (toolId) {
      case 'video-transcode': {
        const format = params.format === 'webm' ? 'webm' : 'mp4';
        const crf = params.quality === 'high' ? '18' : params.quality === 'small' ? '28' : '23';
        const outName = `${base}.${format}`;
        const outPath = `${outDir}/${outName}`;
        const args = ['-y', '-i', inputPath];
        if (params.maxWidth && params.maxWidth > 0) args.push('-vf', `scale=${Math.floor(params.maxWidth)}:-2`);
        if (format === 'mp4') {
          args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', crf, '-c:a', 'aac', '-movflags', '+faststart', outPath);
        } else {
          args.push('-c:v', 'libvpx-vp9', '-crf', crf, '-b:v', '0', '-c:a', 'libopus', outPath);
        }
        await run('ffmpeg', args, { timeout: 600000 });
        return { outPath, outName, mime: format === 'mp4' ? 'video/mp4' : 'video/webm' };
      }
      case 'video-subtitles': {
        const outName = `${base}.srt`;
        const outPath = `${outDir}/${outName}`;
        await run('ffmpeg', ['-y', '-i', inputPath, '-map', '0:s:0', outPath], { timeout: 300000 });
        return { outPath, outName, mime: 'application/x-subrip' };
      }
      case 'doc-convert': {
        // soffice handles doc/docx/odt/txt/md → pdf|docx|txt|html
        const format = ['pdf', 'docx', 'txt', 'html'].includes(params.format ?? '') ? params.format! : 'pdf';
        await run('soffice', ['--headless', '--convert-to', format, '--outdir', outDir, inputPath], { timeout: 300000 });
        const outName = `${base}.${format}`;
        return { outPath: `${outDir}/${outName}`, outName, mime: 'application/octet-stream' };
      }
      case 'pdf-to-word-cloud': {
        await run('soffice', ['--headless', '--convert-to', 'docx', '--outdir', outDir, inputPath], { timeout: 300000 });
        const outName = `${base}.docx`;
        return { outPath: `${outDir}/${outName}`, outName, mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
      }
      case 'pdf-encrypt': {
        if (!params.password) throw Object.assign(new Error('password required'), { code: 'bad-request' });
        const outName = `${base}-encrypted.pdf`;
        const outPath = `${outDir}/${outName}`;
        await run('qpdf', [`--encrypt`, params.password, params.password, '128', '--', inputPath, outPath], { timeout: 120000 });
        return { outPath, outName, mime: 'application/pdf' };
      }
      case 'pdf-decrypt': {
        const outName = `${base}-decrypted.pdf`;
        const outPath = `${outDir}/${outName}`;
        const args = params.password
          ? ['--password=' + params.password, '--decrypt', inputPath, outPath]
          : ['--decrypt', inputPath, outPath];
        await run('qpdf', args, { timeout: 120000 });
        return { outPath, outName, mime: 'application/pdf' };
      }
      default:
        throw Object.assign(new Error(`unknown tool: ${toolId}`), { code: 'bad-request' });
    }
  } catch (e: unknown) {
    const err = e as NodeJS.ErrnoException & { code?: string };
    if (err?.code === 'ENOENT') throw Object.assign(new Error('processor binary missing'), { code: 'unavailable' });
    if (err?.code === 'bad-request' || err?.code === 'unavailable') throw e;
    throw Object.assign(new Error('processing failed'), { code: 'failed', cause: String(err?.message ?? e).slice(0, 300) });
  }
}

export { extOf };
