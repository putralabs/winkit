import { useEffect, useRef, useState } from 'react';
import { Dropzone } from './Dropzone';
import { ProgressBar } from './ProgressBar';
import { Checkbox, NumberInput, Segmented, Slider, Steps, TextInput } from './ui';
import { IChevDown, IChevUp, ICopy, IArrowRight, IRotateCw, IStar, IX } from './icons';
import { t as translate, useT } from '../shared/i18n';
import { downloadAll, downloadBlob, downloadZip, revokeUrls } from '../shared/download';
import { cloudConfigured, runCloudJob } from '../shared/cloud';
import { processBatch } from '../shared/queue';
import { getSettings, pushRecentTool, recordStatus, takePendingFiles } from '../shared/storage';
import { notifyComplete } from '../shared/notify';
import { getTool } from '../shared/tools';
import { isExtension } from '../shared/platform';
import type { CancelToken, ImageOptions, OutputFile, Settings, ToolDef } from '../shared/types';
import { newCancelToken } from '../shared/types';
import { baseName, formatBytes, validateFile } from '../shared/validation';
import { IMAGE_PRESET_QUALITY, convertImage, formatFromFile } from '../processors/image';
import { PDF_RENDER_SCALE, compressPdf, getPdfPageCount, mergePdfs, organizePdf, renderPdf, splitPdf, watermarkPdf } from '../processors/pdf';
import { createZip, extractTar, extractZip } from '../processors/archive';
import { mediaToMp3, mediaToWav } from '../processors/audio';
import { docxToHtml, docxToPdf, docxToText, imagesToPdf, mdToHtml, pdfToHtml, pdfToText, pdfToWord, textToDocx, textToPdf } from '../processors/document';
import { cropImage, filterImage, rotateFlipImage, sharpenImage, stripMetadata } from '../processors/image-edit';
import { extractFrames, getVideoMeta, videoToGif, type FrameMode, type VideoMeta } from '../processors/video';

interface Props {
  tool: ToolDef;
  settings: Settings;
  onHistoryChange: () => void;
  onPickTool: (id: string, files: File[]) => void;
}

interface ProcMsg {
  key: string;
  params?: Record<string, string | number>;
}

const IMAGE_TOOLS = ['jpg-to-png', 'png-to-jpg', 'image-to-webp', 'image-resize', 'image-compress', 'svg-to-png'];
const PDF_RENDER = ['pdf-to-jpg', 'pdf-to-png', 'pdf-to-webp'];
const VIDEO_FRAMES = ['video-to-jpg', 'video-to-png'];
const VIDEO_TOOLS = [...VIDEO_FRAMES, 'video-to-gif', 'video-to-mp3'];
const AUDIO_MP3 = ['video-to-mp3', 'wav-to-mp3', 'm4a-to-mp3', 'audio-compress'];

/** Rule-based smart recommendations per file type (PRD §36) - no AI. */
function recommendationsFor(name: string): string[] {
  const lower = name.toLowerCase();
  const ext = '.' + lower.split('.').pop();
  if (ext === '.png') return ['image-to-webp', 'image-compress', 'image-resize', 'image-crop'];
  if (['.jpg', '.jpeg'].includes(ext)) return ['image-to-webp', 'image-compress', 'image-resize', 'jpg-to-png'];
  if (['.gif', '.bmp', '.webp', '.svg'].includes(ext)) return ['image-to-webp', 'image-resize', 'image-info'];
  if (ext === '.pdf') return ['pdf-compress', 'pdf-to-word', 'pdf-to-jpg', 'pdf-merge', 'pdf-split', 'pdf-organize'];
  if (['.mp4', '.webm', '.mov', '.m4v', '.mkv', '.avi'].includes(ext)) return ['video-to-jpg', 'video-to-gif', 'video-to-mp3'];
  if (ext === '.mp3') return ['audio-compress', 'mp3-to-wav'];
  if (ext === '.wav') return ['wav-to-mp3'];
  if (['.m4a', '.aac'].includes(ext)) return ['m4a-to-mp3'];
  if (ext === '.docx') return ['docx-to-txt', 'word-to-pdf', 'word-to-html'];
  if (ext === '.txt') return ['txt-to-pdf', 'txt-to-docx'];
  if (['.md', '.markdown'].includes(ext)) return ['md-to-pdf', 'md-to-html', 'txt-to-docx'];
  if (ext === '.zip') return ['extract-zip'];
  if (['.tar', '.tgz'].includes(ext) || lower.endsWith('.tar.gz')) return ['extract-tar'];
  return [];
}

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function TextSnippet({ blob }: { blob: Blob }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void blob.text().then((s) => {
      if (live) setText(s.slice(0, 800));
    });
    return () => {
      live = false;
    };
  }, [blob]);
  if (text === null) return null;
  return <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-muted/60 p-2 text-[11px]">{text}</pre>;
}

export function ToolRunner({ tool, settings, onHistoryChange, onPickTool }: Props) {
  const t = useT();
  const [files, setFiles] = useState<File[]>([]);
  const [fileErrors, setFileErrors] = useState<{ name: string; error: string }[]>([]);
  // image phase-1 config
  const [quality, setQuality] = useState(80);
  const [preset, setPreset] = useState<'max' | 'balanced' | 'smallest' | 'custom'>('balanced');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [keepRatio, setKeepRatio] = useState(true);
  // pdf config
  const [renderQ, setRenderQ] = useState<'low' | 'medium' | 'high'>('medium');
  const [pagesMode, setPagesMode] = useState<'all' | 'range'>('all');
  const [from, setFrom] = useState('1');
  const [to, setTo] = useState('');
  const [pageCount, setPageCount] = useState<number | null>(null);
  // video config
  const [frameMode, setFrameMode] = useState<FrameMode>('interval');
  const [singleTime, setSingleTime] = useState('5');
  const [intervalSec, setIntervalSec] = useState('5');
  const [frameCount, setFrameCount] = useState('10');
  const [timestamps, setTimestamps] = useState('');
  const [frameMaxWidth, setFrameMaxWidth] = useState('');
  const [gifMaxFrames, setGifMaxFrames] = useState('30');
  const [gifWidth, setGifWidth] = useState('480');
  const [videoMeta, setVideoMeta] = useState<VideoMeta | null>(null);
  // audio config
  const [bitrate, setBitrate] = useState(128);
  // crop config
  const [cropX, setCropX] = useState('0');
  const [cropY, setCropY] = useState('0');
  const [cropW, setCropW] = useState('');
  const [cropH, setCropH] = useState('');
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  // rotate / filters
  const [angle, setAngle] = useState<'0' | '90' | '180' | '270'>('90');
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturate, setSaturate] = useState(100);
  const [blur, setBlur] = useState(0);
  const [grayscale, setGrayscale] = useState(false);
  // pdf advanced + ocr
  const [wmText, setWmText] = useState('WinKit');
  const [wmOpacity, setWmOpacity] = useState(25);
  const [ocrLang, setOcrLang] = useState<'eng' | 'ind'>('eng');
  const [vcFormat, setVcFormat] = useState<'mp4' | 'webm'>('mp4');
  const [vcQuality, setVcQuality] = useState<'low' | 'medium' | 'high'>('medium');
  const [vcMaxWidth, setVcMaxWidth] = useState('');
  const [trimStart, setTrimStart] = useState('0');
  const [trimEnd, setTrimEnd] = useState('');
  const [sharpenAmt, setSharpenAmt] = useState(40);
  const [orgOrder, setOrgOrder] = useState<number[]>([]);
  const [orgRot, setOrgRot] = useState<Record<number, number>>({});
  // run state
  const [running, setRunning] = useState(false);
  const [prog, setProg] = useState({ done: 0, total: 0 });
  const [procMsg, setProcMsg] = useState<ProcMsg | null>(null);
  const [outputs, setOutputs] = useState<OutputFile[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [savedTotal, setSavedTotal] = useState(0);
  const [consent, setConsent] = useState<null | (() => void)>(null);
  const [cloudOn, setCloudOn] = useState(false);
  const tokenRef = useRef<CancelToken>(newCancelToken());

  useEffect(() => {
    void cloudConfigured().then(setCloudOn);
  }, []);

  // Revoke the previous batch's preview URLs whenever outputs change or on unmount.
  useEffect(() => () => revokeUrls(previewUrls), [previewUrls]);

  // PDF page count for render/split UI.
  useEffect(() => {
    setPageCount(null);
    if ((tool.id === 'pdf-split' || tool.id === 'pdf-organize' || PDF_RENDER.includes(tool.id)) && files.length > 0) {
      let alive = true;
      getPdfPageCount(files[0])
        .then((n) => {
          if (!alive) return;
          setPageCount(n);
          setTo((prev) => (prev === '' ? String(n) : prev));
        })
        .catch((e) => {
          if (!alive) return;
          const msg = (e as Error)?.message;
          setFileErrors([{ name: files[0].name, error: msg === 'encrypted' ? 'err.encrypted' : 'err.corrupted' }]);
        });
      return () => {
        alive = false;
      };
    }
  }, [tool.id, files]);

  // Video metadata for frame tools.
  useEffect(() => {
    setVideoMeta(null);
    if (VIDEO_TOOLS.includes(tool.id) && files.length > 0) {
      let alive = true;
      getVideoMeta(files[0])
        .then((m) => {
          if (alive) setVideoMeta(m);
        })
        .catch(() => {
          if (alive) setFileErrors([{ name: files[0].name, error: 'err.undecodable' }]);
        });
      return () => {
        alive = false;
      };
    }
  }, [tool.id, files]);

  // Natural size + prefill for crop.
  useEffect(() => {
    setNatural(null);
    if (tool.id === 'image-crop' && files.length > 0) {
      let alive = true;
      createImageBitmap(files[0])
        .then((bmp) => {
          if (!alive) {
            bmp.close();
            return;
          }
          setNatural({ w: bmp.width, h: bmp.height });
          setCropX('0');
          setCropY('0');
          setCropW(String(bmp.width));
          setCropH(String(bmp.height));
          bmp.close();
        })
        .catch(() => {});
      return () => {
        alive = false;
      };
    }
  }, [tool.id, files]);

  // Init organize page list once the page count is known.
  useEffect(() => {
    if (tool.id === 'pdf-organize' && pageCount !== null) {
      setOrgOrder(Array.from({ length: pageCount }, (_, i) => i + 1));
      setOrgRot({});
    }
  }, [tool.id, pageCount]);

  // Incoming files from smart recommendations (another tool instance).
  useEffect(() => {
    const p = takePendingFiles();
    if (p && p.length > 0) {
      setOutputs([]);
      setFileErrors([]);
      setError(null);
      setCancelled(false);
      setDownloaded(false);
      setFiles(tool.multiple ? p.slice(0, 20) : p.slice(0, 1));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool.id]);

  const addFiles = (incoming: File[]) => {
    reset();
    setFiles(tool.multiple ? [...files, ...incoming].slice(0, 20) : incoming.slice(0, 1));
  };

  function reset() {
    revokeUrls(previewUrls);
    setPreviewUrls([]);
    setOutputs([]);
    setFileErrors([]);
    setError(null);
    setCancelled(false);
    setDownloaded(false);
    setSavedTotal(0);
    setProg({ done: 0, total: 0 });
    setProcMsg(null);
  }

  const clearAll = () => {
    reset();
    setFiles([]);
  };

  const applyPreset = (p: 'max' | 'balanced' | 'smallest' | 'custom') => {
    setPreset(p);
    if (p !== 'custom') setQuality(IMAGE_PRESET_QUALITY[p]);
  };

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= files.length) return;
    const next = [...files];
    [next[i], next[j]] = [next[j], next[i]];
    setFiles(next);
  };

  const orgMove = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= orgOrder.length) return;
    const next = [...orgOrder];
    [next[i], next[j]] = [next[j], next[i]];
    setOrgOrder(next);
  };

  const orgRotate = (i: number) =>
    setOrgRot((prev) => ({ ...prev, [orgOrder[i]]: ((prev[orgOrder[i]] ?? 0) + 1) % 4 }));

  const orgDup = (i: number) => setOrgOrder((prev) => [...prev.slice(0, i + 1), prev[i], ...prev.slice(i + 1)]);

  const orgDel = (i: number) => setOrgOrder((prev) => prev.filter((_, j) => j !== i));

  const imageOpts = (file: File): ImageOptions => {
    const w = width.trim() === '' ? null : Math.max(1, Math.floor(Number(width)));
    const h = height.trim() === '' ? null : Math.max(1, Math.floor(Number(height)));
    switch (tool.id) {
      case 'jpg-to-png':
      case 'svg-to-png':
        return { format: 'png', quality: 100, width: null, height: null, keepRatio: true };
      case 'png-to-jpg':
        return { format: 'jpg', quality, width: null, height: null, keepRatio: true };
      case 'image-resize':
        return { format: formatFromFile(file), quality: 92, width: w, height: h, keepRatio };
      case 'image-compress':
        return { format: formatFromFile(file), quality, width: null, height: null, keepRatio: true };
      default:
        return { format: 'webp', quality, width: w, height: h, keepRatio };
    }
  };

  /** Cloud retry for pdf-to-word (PRD §20 complex path): explicit consent, then upload. */
  const runCloud = async () => {
    if (files.length === 0 || running) return;
    const token = newCancelToken();
    tokenRef.current = token;
    setRunning(true);
    setError(null);
    setCancelled(false);
    try {
      const r = await runCloudJob('pdf-to-word-cloud', files[0], {}, token, (p) => {
        setProg({ done: p.done, total: p.total });
        setProcMsg({ key: 'proc.processingFile', params: { done: p.done, total: p.total } });
      });
      const out: OutputFile = { name: r.name, blob: r.blob, size: r.blob.size };
      setOutputs([out]);
      setPreviewUrls([]);
      await recordStatus(tool.id, files[0].name, 'completed', out.size, 'docx');
      onHistoryChange();
      setDownloaded(false);
      void notifyComplete(`${t(tool.nameKey)} - ${t('proc.filesCreated', { n: 1 })}`);
    } catch (e) {
      const msg = (e as Error).message;
      if (msg === 'cancelled' || token.cancelled) {
        setCancelled(true);
        await recordStatus(tool.id, files[0].name, 'cancelled', files[0].size, 'docx');
      } else if (msg === 'cloud-unconfigured') {
        setError('cloud.notConfigured');
      } else {
        setError('cloud.unavailable');
        await recordStatus(tool.id, files[0].name, 'failed', files[0].size, 'docx');
      }
      onHistoryChange();
    } finally {
      setRunning(false);
      setProcMsg(null);
    }
  };

  const askCloud = () => {
    if (settings.askBeforeCloud) setConsent(() => runCloud);
    else void runCloud();
  };

  const start = async () => {
    if (files.length === 0 || running) return;
    reset();
    const token = newCancelToken();
    tokenRef.current = token;
    setRunning(true);
    await pushRecentTool(tool.id);

    const valid: File[] = [];
    const errs: { name: string; error: string }[] = [];
    for (const f of files) {
      const v = await validateFile(f, tool.accept);
      if (v.ok) valid.push(f);
      else errs.push({ name: f.name, error: v.error });
    }
    setFileErrors(errs);
    if (valid.length === 0) {
      setRunning(false);
      setError(errs.length > 0 ? errs[0].error : 'proc.noOutput');
      return;
    }

    const out: OutputFile[] = [];
    let saved = 0;
    let batchError: string | null = null;
    const ok = (toolId: string, name: string, size: number, fmt: string) =>
      recordStatus(toolId, name, 'completed', size, fmt);
    const bad = (name: string, size: number, fmt: string) =>
      recordStatus(tool.id, name, token.cancelled ? 'cancelled' : 'failed', size, fmt);
    const isCancel = (e: unknown) => token.cancelled || (e as Error).message === 'cancelled';

    try {
      if (IMAGE_TOOLS.includes(tool.id)) {
        const workers = (await getSettings()).workers || settings.workers;
        await processBatch(
          valid,
          workers,
          async (file, _index, tok, report) => {
            const opts = imageOpts(file);
            try {
              const r = await convertImage(file, opts, tok, (p) => report(p));
              if (
                tool.id === 'image-compress' &&
                opts.width === null &&
                opts.height === null &&
                formatFromFile(file) === opts.format &&
                r.size >= file.size
              ) {
                // Re-encode didn't pay off (typical for PNG): hand back the
                // original instead of a bigger "compressed" file.
                const orig: OutputFile = { name: file.name, blob: file, size: file.size, width: r.width, height: r.height };
                out.push(orig);
                await ok(tool.id, file.name, orig.size, opts.format);
              } else {
                out.push(r);
                await ok(tool.id, file.name, r.size, opts.format);
              }
            } catch (e) {
              if (isCancel(e)) throw new Error('cancelled');
              await bad(file.name, file.size, opts.format);
            }
          },
          token,
          (done, total) => {
            setProg({ done, total });
            setProcMsg({ key: 'proc.processingFile', params: { done: Math.floor(done), total } });
          },
        );
      } else if (VIDEO_FRAMES.includes(tool.id)) {
        const file = valid[0];
        const format = tool.id === 'video-to-jpg' ? 'jpg' : 'png';
        const mw = frameMaxWidth.trim() === '' ? null : Math.max(1, Math.floor(Number(frameMaxWidth)));
        const { outputs: frames } = await extractFrames(
          file,
          {
            format,
            quality,
            mode: frameMode,
            singleTime: Number(singleTime) || 0,
            intervalSec: Number(intervalSec) || 5,
            count: Number(frameCount) || 10,
            timestamps,
            maxWidth: mw,
          },
          token,
          (p) => {
            setProg({ done: p.done, total: p.total });
            setProcMsg(p.messageKey ? { key: p.messageKey, params: p.messageParams } : null);
          },
        );
        out.push(...frames);
        await ok(tool.id, file.name, file.size, format);
      } else if (tool.id === 'video-to-gif') {
        const file = valid[0];
        const r = await videoToGif(
          file,
          { intervalSec: Number(intervalSec) || 2, maxFrames: Math.max(1, Math.floor(Number(gifMaxFrames)) || 30), width: Math.max(64, Math.floor(Number(gifWidth)) || 480) },
          token,
          (p) => {
            setProg({ done: p.done, total: p.total });
            setProcMsg(p.messageKey ? { key: p.messageKey, params: p.messageParams } : null);
          },
        );
        out.push(r);
        await ok(tool.id, file.name, r.size, 'gif');
      } else if (AUDIO_MP3.includes(tool.id)) {
        const workers = (await getSettings()).workers || settings.workers;
        await processBatch(
          valid,
          workers,
          async (file, _index, tok, report) => {
            try {
              const { output } = await mediaToMp3(file, bitrate, tok, (p) => report(p));
              out.push(output);
              await ok(tool.id, file.name, output.size, 'mp3');
            } catch (e) {
              if (isCancel(e)) throw new Error('cancelled');
              await bad(file.name, file.size, 'mp3');
            }
          },
          token,
          (done, total) => {
            setProg({ done, total });
            setProcMsg({ key: 'proc.processingFile', params: { done: Math.floor(done), total } });
          },
        );
        if (out.length === 0 && !token.cancelled) batchError = 'err.undecodable';
      } else if (tool.id === 'mp3-to-wav') {
        const workers = (await getSettings()).workers || settings.workers;
        await processBatch(
          valid,
          workers,
          async (file, _index, tok, report) => {
            report({ done: 0, total: 1 });
            try {
              const { output } = await mediaToWav(file, tok);
              out.push(output);
              await ok(tool.id, file.name, output.size, 'wav');
            } catch (e) {
              if (isCancel(e)) throw new Error('cancelled');
              await bad(file.name, file.size, 'wav');
            }
            report({ done: 1, total: 1 });
          },
          token,
          (done, total) => {
            setProg({ done, total });
            setProcMsg({ key: 'proc.processingFile', params: { done: Math.floor(done), total } });
          },
        );
        if (out.length === 0 && !token.cancelled) batchError = 'err.undecodable';
      } else if (tool.id === 'image-to-pdf') {
        const r = await imagesToPdf(valid, token, (p) => {
          setProg({ done: p.done, total: p.total });
          setProcMsg({ key: 'proc.processingFile', params: { done: p.done, total: p.total } });
        });
        out.push(r);
        for (const f of valid) await ok(tool.id, f.name, r.size, 'pdf');
      } else if (tool.id === 'txt-to-docx') {
        const workers = (await getSettings()).workers || settings.workers;
        await processBatch(
          valid,
          workers,
          async (file, _index, tok, report) => {
            report({ done: 0, total: 1 });
            try {
              const r = await textToDocx(file, /\.md$|\.markdown$/i.test(file.name) ? 'md' : 'txt', tok);
              out.push(r);
              await ok(tool.id, file.name, r.size, 'docx');
            } catch (e) {
              if (isCancel(e)) throw new Error('cancelled');
              await bad(file.name, file.size, 'docx');
            }
            report({ done: 1, total: 1 });
          },
          token,
          (done, total) => {
            setProg({ done, total });
            setProcMsg({ key: 'proc.processingFile', params: { done: Math.floor(done), total } });
          },
        );
      } else if (tool.id === 'md-to-html' || tool.id === 'word-to-html' || tool.id === 'pdf-to-html') {
        const workers = (await getSettings()).workers || settings.workers;
        await processBatch(
          valid,
          workers,
          async (file, _index, tok, report) => {
            report({ done: 0, total: 1 });
            try {
              const r =
                tool.id === 'md-to-html'
                  ? await mdToHtml(file, tok)
                  : tool.id === 'word-to-html'
                    ? await docxToHtml(file, tok)
                    : await pdfToHtml(file, tok);
              out.push(r);
              await ok(tool.id, file.name, r.size, 'html');
            } catch (e) {
              if (isCancel(e)) throw new Error('cancelled');
              await bad(file.name, file.size, 'html');
            }
            report({ done: 1, total: 1 });
          },
          token,
          (done, total) => {
            setProg({ done, total });
            setProcMsg({ key: 'proc.processingFile', params: { done: Math.floor(done), total } });
          },
        );
      } else if (tool.id === 'image-sharpen') {
        const workers = (await getSettings()).workers || settings.workers;
        await processBatch(
          valid,
          workers,
          async (file, _index, tok, report) => {
            try {
              const r = await sharpenImage(file, sharpenAmt, tok, (p) => report(p));
              out.push(r);
              await ok(tool.id, file.name, r.size, r.name.split('.').pop() ?? 'img');
            } catch (e) {
              if (isCancel(e)) throw new Error('cancelled');
              await bad(file.name, file.size, 'img');
            }
          },
          token,
          (done, total) => {
            setProg({ done, total });
            setProcMsg({ key: 'proc.processingFile', params: { done: Math.floor(done), total } });
          },
        );
      } else if (tool.id === 'pdf-organize') {
        const order0 = orgOrder.map((n) => n - 1).filter((i) => i >= 0 && (pageCount === null || i < pageCount));
        if (order0.length === 0) throw new Error('range');
        const rots: Record<number, number> = {};
        for (const [k, v] of Object.entries(orgRot)) rots[Number(k) - 1] = v;
        const r = await organizePdf(valid[0], { order: order0, rotations: rots }, token, (p) => {
          setProg({ done: p.done, total: p.total });
          setProcMsg({ key: 'proc.processingFile', params: { done: p.done, total: p.total } });
        });
        out.push(r);
        await ok(tool.id, valid[0].name, r.size, 'pdf');
      } else if (tool.id === 'pdf-ocr-text') {
        const { pdfOcrText } = await import('../processors/ocr');
        const r = await pdfOcrText(valid[0], ocrLang, token, (p) => {
          setProg({ done: p.done, total: p.total });
          setProcMsg({ key: 'proc.processingFile', params: { done: Math.floor(p.done), total: p.total } });
        });
        out.push(r);
        await ok(tool.id, valid[0].name, r.size, 'txt');
      } else if (tool.id === 'video-convert' || tool.id === 'video-trim') {
        const { transcodeVideo, trimVideo } = await import('../processors/ffmpeg');
        if (tool.id === 'video-convert') {
          const mw = vcMaxWidth.trim() === '' ? null : Math.max(1, Math.floor(Number(vcMaxWidth)));
          const r = await transcodeVideo(valid[0], { format: vcFormat, quality: vcQuality, maxWidth: mw }, token, (p) => {
            setProg({ done: p.done, total: p.total });
            setProcMsg({ key: 'proc.processingFile', params: { done: p.done, total: p.total } });
          });
          out.push(r);
          await ok(tool.id, valid[0].name, r.size, vcFormat);
        } else {
          const s = Math.max(0, Number(trimStart) || 0);
          const e = trimEnd.trim() === '' ? null : Number(trimEnd);
          if (e !== null && !(e > s)) throw new Error('range');
          const r = await trimVideo(valid[0], s, e, token, (p) => {
            setProg({ done: p.done, total: p.total });
          });
          out.push(r);
          await ok(tool.id, valid[0].name, r.size, r.name.split('.').pop() ?? 'mp4');
        }
      } else if (tool.id === 'create-zip') {
        const r = await createZip(valid, `${baseName(valid[0].name)}-files`, token, (p) => {
          setProg({ done: p.done, total: p.total });
          setProcMsg(p.messageKey ? { key: p.messageKey, params: p.messageParams } : null);
        });
        out.push(r);
        for (const f of valid) await ok(tool.id, f.name, f.size, 'zip');
      } else if (tool.id === 'extract-zip' || tool.id === 'extract-tar') {
        const file = valid[0];
        const results =
          tool.id === 'extract-zip'
            ? await extractZip(file, token, (p) => {
                setProg({ done: p.done, total: p.total });
                setProcMsg({ key: 'proc.processingFile', params: { done: p.done, total: p.total } });
              })
            : await extractTar(file, token, (p) => {
                setProg({ done: p.done, total: p.total });
                setProcMsg({ key: 'proc.processingFile', params: { done: p.done, total: p.total } });
              });
        if (results.length === 0) throw new Error('empty');
        out.push(...results);
        await ok(tool.id, file.name, file.size, tool.id === 'extract-zip' ? 'zip' : 'tar');
      } else if (tool.id === 'pdf-to-text') {
        const r = await pdfToText(valid[0], token);
        out.push(r);
        await ok(tool.id, valid[0].name, r.size, 'txt');
      } else if (tool.id === 'txt-to-pdf' || tool.id === 'md-to-pdf') {
        const workers = (await getSettings()).workers || settings.workers;
        await processBatch(
          valid,
          workers,
          async (file, _index, tok, report) => {
            report({ done: 0, total: 1 });
            try {
              const r = await textToPdf(file, tool.id === 'md-to-pdf' ? 'md' : 'txt', tok);
              out.push(r);
              await ok(tool.id, file.name, r.size, 'pdf');
            } catch (e) {
              if (isCancel(e)) throw new Error('cancelled');
              await bad(file.name, file.size, 'pdf');
            }
            report({ done: 1, total: 1 });
          },
          token,
          (done, total) => {
            setProg({ done, total });
            setProcMsg({ key: 'proc.processingFile', params: { done: Math.floor(done), total } });
          },
        );
      } else if (tool.id === 'docx-to-txt') {
        const workers = (await getSettings()).workers || settings.workers;
        await processBatch(
          valid,
          workers,
          async (file, _index, tok, report) => {
            report({ done: 0, total: 1 });
            try {
              const r = await docxToText(file, tok);
              out.push(r);
              await ok(tool.id, file.name, r.size, 'txt');
            } catch (e) {
              if (isCancel(e)) throw new Error('cancelled');
              await bad(file.name, file.size, 'txt');
            }
            report({ done: 1, total: 1 });
          },
          token,
          (done, total) => {
            setProg({ done, total });
            setProcMsg({ key: 'proc.processingFile', params: { done: Math.floor(done), total } });
          },
        );
      } else if (tool.id === 'pdf-to-word') {
        const r = await pdfToWord(valid[0], token, (p) => {
          setProg({ done: p.done, total: p.total });
        });
        out.push(r);
        await ok(tool.id, valid[0].name, r.size, 'docx');
      } else if (tool.id === 'word-to-pdf') {
        const r = await docxToPdf(valid[0], token);
        out.push(r);
        await ok(tool.id, valid[0].name, r.size, 'pdf');
      } else if (tool.id === 'image-crop') {
        const file = valid[0];
        const { output } = await cropImage(
          file,
          { x: Math.floor(Number(cropX)) || 0, y: Math.floor(Number(cropY)) || 0, w: Math.floor(Number(cropW)) || 0, h: Math.floor(Number(cropH)) || 0 },
          token,
        );
        if ((output.width ?? 0) <= 0 || (output.height ?? 0) <= 0) throw new Error('range');
        out.push(output);
        await ok(tool.id, file.name, output.size, output.name.split('.').pop() ?? 'img');
      } else if (tool.id === 'image-rotate') {
        const workers = (await getSettings()).workers || settings.workers;
        await processBatch(
          valid,
          workers,
          async (file, _index, tok, report) => {
            try {
              const r = await rotateFlipImage(file, { angle: Number(angle) as 0 | 90 | 180 | 270, flipH, flipV }, tok, (p) => report(p));
              out.push(r);
              await ok(tool.id, file.name, r.size, r.name.split('.').pop() ?? 'img');
            } catch (e) {
              if (isCancel(e)) throw new Error('cancelled');
              await bad(file.name, file.size, 'img');
            }
          },
          token,
          (done, total) => {
            setProg({ done, total });
            setProcMsg({ key: 'proc.processingFile', params: { done: Math.floor(done), total } });
          },
        );
      } else if (tool.id === 'image-filters') {
        const workers = (await getSettings()).workers || settings.workers;
        await processBatch(
          valid,
          workers,
          async (file, _index, tok, report) => {
            try {
              const r = await filterImage(file, { grayscale, brightness, contrast, saturate, blur }, tok, (p) => report(p));
              out.push(r);
              await ok(tool.id, file.name, r.size, r.name.split('.').pop() ?? 'img');
            } catch (e) {
              if (isCancel(e)) throw new Error('cancelled');
              await bad(file.name, file.size, 'img');
            }
          },
          token,
          (done, total) => {
            setProg({ done, total });
            setProcMsg({ key: 'proc.processingFile', params: { done: Math.floor(done), total } });
          },
        );
      } else if (tool.id === 'image-strip-metadata') {
        const workers = (await getSettings()).workers || settings.workers;
        await processBatch(
          valid,
          workers,
          async (file, _index, tok, report) => {
            try {
              const { output, savedBytes } = await stripMetadata(file, tok, (p) => report(p));
              out.push(output);
              saved += savedBytes;
              await ok(tool.id, file.name, output.size, output.name.split('.').pop() ?? 'img');
            } catch (e) {
              if (isCancel(e)) throw new Error('cancelled');
              await bad(file.name, file.size, 'img');
            }
          },
          token,
          (done, total) => {
            setProg({ done, total });
            setProcMsg({ key: 'proc.processingFile', params: { done: Math.floor(done), total } });
          },
        );
      } else if (tool.id === 'pdf-watermark' || tool.id === 'pdf-compress') {
        const workers = (await getSettings()).workers || settings.workers;
        const text = wmText.trim() === '' ? 'WinKit' : wmText.trim();
        await processBatch(
          valid,
          workers,
          async (file, _index, tok, report) => {
            report({ done: 0, total: 1 });
            try {
              const r =
                tool.id === 'pdf-watermark'
                  ? await watermarkPdf(file, text, wmOpacity / 100, tok, (p) => report(p))
                  : await compressPdf(file, tok);
              out.push(r);
              await ok(tool.id, file.name, r.size, 'pdf');
            } catch (e) {
              if (isCancel(e)) throw new Error('cancelled');
              await bad(file.name, file.size, 'pdf');
            }
            report({ done: 1, total: 1 });
          },
          token,
          (done, total) => {
            setProg({ done, total });
            setProcMsg({ key: 'proc.processingFile', params: { done: Math.floor(done), total } });
          },
        );
      } else if (tool.id === 'ocr-image-to-text') {
        await processBatch(
          valid,
          1,
          async (file, _index, tok, report) => {
            try {
              const { ocrImage } = await import('../processors/ocr');
              const r = await ocrImage(file, ocrLang, tok, (p) => report(p));
              out.push(r);
              await ok(tool.id, file.name, r.size, 'txt');
            } catch (e) {
              if (isCancel(e)) throw new Error('cancelled');
              await bad(file.name, file.size, 'txt');
            }
          },
          token,
          (done, total) => {
            setProg({ done, total });
            setProcMsg({ key: 'proc.processingFile', params: { done: Math.floor(done), total } });
          },
        );
      } else if (PDF_RENDER.includes(tool.id)) {
        const file = valid[0];
        const format = tool.id === 'pdf-to-jpg' ? 'jpg' : tool.id === 'pdf-to-png' ? 'png' : 'webp';
        const results = await renderPdf(
          file,
          { format, quality, scale: PDF_RENDER_SCALE[renderQ], fromPage: pagesMode === 'all' ? null : Number(from), toPage: pagesMode === 'all' ? null : Number(to) },
          token,
          (p) => {
            setProg({ done: p.done, total: p.total });
            setProcMsg(p.messageKey ? { key: p.messageKey, params: p.messageParams } : null);
          },
        );
        out.push(...results);
        await ok(tool.id, file.name, file.size, format);
      } else if (tool.id === 'pdf-merge') {
        setProcMsg({ key: 'proc.merging' });
        const r = await mergePdfs(valid, token, (p) => setProg({ done: p.done, total: p.total }));
        out.push(r);
        for (const f of valid) await ok(tool.id, f.name, f.size, 'pdf');
      } else {
        const file = valid[0];
        const f = Math.max(1, Math.floor(Number(from)));
        const tt = Math.min(pageCount ?? Number(to), Math.floor(Number(to)));
        if (!Number.isFinite(f) || !Number.isFinite(tt) || f > tt) throw new Error('range');
        setProcMsg({ key: 'proc.merging' });
        const r = await splitPdf(file, f, tt, token);
        out.push(r);
        await ok(tool.id, file.name, r.size, 'pdf');
      }
      // Silent all-fail batch (per-file errors went to history only): say so.
      if (out.length === 0 && !token.cancelled) setError(batchError ?? 'proc.failed');
    } catch (e) {
      const msg = (e as Error).message;
      if (msg === 'cancelled' || token.cancelled) {
        setCancelled(true);
        for (const f of valid) {
          if (!out.some((o) => o.name.startsWith(baseName(f.name)))) await bad(f.name, f.size, tool.id);
        }
      } else if (msg === 'range') {
        setError('err.invalidRange');
      } else if (msg === 'decode') {
        setError('err.undecodable');
      } else if (msg === 'encrypted') {
        setError('err.encrypted');
      } else if (msg === 'unsupported') {
        setError('err.unsupported');
      } else if (msg === 'offline') {
        setError('err.offline');
      } else if (msg === 'empty') {
        setError('proc.noOutput');
      } else {
        setError('proc.failed');
      }
    } finally {
      setRunning(false);
      setProcMsg(null);
      out.sort((a, b) => a.name.localeCompare(b.name));
      setOutputs(out);
      setSavedTotal(saved);
      setPreviewUrls(out.filter((o) => o.blob.type.startsWith('image/')).map((o) => URL.createObjectURL(o.blob)));
      onHistoryChange();
      if (out.length > 0 && !token.cancelled) {
        void notifyComplete(`${t(tool.nameKey)} - ${t('proc.filesCreated', { n: out.length })}`);
      }
    }
  };

  const phase = files.length === 0 ? 0 : running ? 2 : outputs.length > 0 || error || cancelled ? 3 : 1;
  const stepCurrent = downloaded ? 4 : phase;
  const totalSize = files.reduce((n, f) => n + f.size, 0);
  const addInputRef = useRef<HTMLInputElement>(null);
  const showQuality = ['png-to-jpg', 'image-to-webp', 'image-compress', 'pdf-to-jpg', 'video-to-jpg', 'pdf-to-webp'].includes(tool.id);
  const showResize = ['image-to-webp', 'image-resize'].includes(tool.id);
  const isPdf = tool.category === 'pdf';
  const isVideo = VIDEO_TOOLS.includes(tool.id);
  const isolated = typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated;
  const textOutputs = outputs.filter((o) => o.blob.type.startsWith('text/'));
  // Non-blocking memory heads-up; video frames live fully in RAM.
  const sizeWarn = totalSize > (isVideo ? 500 * 1024 * 1024 : 200 * 1024 * 1024);
  const needsTranscodeHint =
    isVideo &&
    !isExtension() &&
    videoMeta === null &&
    fileErrors.some((e) => e.error === 'err.undecodable') &&
    files.some((f) => /\.(avi|mkv)$/i.test(f.name));

  const startLabel =
    tool.id === 'pdf-merge' ? t('proc.startMerge') : tool.id === 'pdf-split' ? t('proc.startSplit') : t('proc.start');

  return (
    <div className="mx-auto w-full max-w-2xl">
      <Steps current={stepCurrent} />

      {files.length === 0 ? (
        <div className="mt-4">
          <Dropzone accept={tool.accept} multiple={tool.multiple} onFiles={addFiles} />
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {/* Step 1 - files */}
          <section aria-label={t('cfg.files')} className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
              <span className="wk-mono wk-nums flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-[11px] font-bold text-primary" aria-hidden="true">01</span>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold leading-tight">
                  {t('cfg.files')} <span className="wk-mono wk-nums text-muted-foreground">({files.length})</span>
                </h3>
                <p className="wk-mono wk-nums text-[11px] text-muted-foreground">{formatBytes(totalSize)} total</p>
              </div>
              {!running && (
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    onClick={() => addInputRef.current?.click()}
                    className="cursor-pointer rounded-lg border border-border px-2.5 py-1.5 text-xs font-bold transition-colors hover:border-primary hover:text-primary"
                  >
                    + {t('drop.browse')}
                  </button>
                  <button
                    onClick={clearAll}
                    className="cursor-pointer rounded-lg px-2 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-destructive"
                  >
                    {t('common.clear')}
                  </button>
                  <input
                    ref={addInputRef}
                    type="file"
                    className="hidden"
                    accept={tool.accept.join(',')}
                    multiple={tool.multiple}
                    onChange={(e) => {
                      if (e.target.files) addFiles(Array.from(e.target.files));
                      e.target.value = '';
                    }}
                  />
                </div>
              )}
            </div>
            {(pageCount !== null || videoMeta !== null || natural !== null) && (
              <div className="border-b border-border bg-muted/40 px-4 py-1.5">
                <p className="wk-mono wk-nums truncate text-[11px] font-bold text-muted-foreground">
                  {pageCount !== null && isPdf && t('cfg.pagesCount', { n: pageCount })}
                  {videoMeta !== null && isVideo && t('vid.info', { duration: fmtDuration(videoMeta.duration), w: videoMeta.width, h: videoMeta.height })}
                  {natural !== null && tool.id === 'image-crop' && `${t('cfg.naturalSize')}: ${natural.w}×${natural.h}`}
                </p>
              </div>
            )}
            <ul className="max-h-44 space-y-1 overflow-auto p-2">
              {files.map((f, i) => {
                const failed = fileErrors.some((e) => e.name === f.name);
                return (
                  <li
                    key={`${f.name}-${i}`}
                    className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs transition-colors ${
                      failed ? 'border border-destructive/40 bg-destructive/5' : 'bg-muted/60'
                    }`}
                  >
                    <span className="wk-mono wk-nums w-6 shrink-0 text-right font-bold text-muted-foreground" aria-hidden="true">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{f.name}</span>
                      <span className="wk-mono wk-nums text-[11px] text-muted-foreground">{formatBytes(f.size)}</span>
                    </span>
                    {failed && (
                      <span className="shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-bold text-destructive">
                        {t('status.failed')}
                      </span>
                    )}
                    {(tool.id === 'pdf-merge' || tool.id === 'create-zip') && !running && (
                      <>
                        <button onClick={() => move(i, -1)} aria-label={t('cfg.moveUp')} className="flex cursor-pointer items-center rounded p-1 transition-colors hover:bg-muted"><IChevUp size={14} /></button>
                        <button onClick={() => move(i, 1)} aria-label={t('cfg.moveDown')} className="flex cursor-pointer items-center rounded p-1 transition-colors hover:bg-muted"><IChevDown size={14} /></button>
                      </>
                    )}
                    {!running && (
                      <button onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label={t('cfg.remove')} className="flex cursor-pointer items-center rounded p-1 transition-colors hover:bg-muted hover:text-destructive"><IX size={14} /></button>
                    )}
                  </li>
                );
              })}
            </ul>
            {fileErrors.length > 0 && (
              <ul className="space-y-1 border-t border-border px-2 py-2">
                {fileErrors.map((e) => (
                  <li key={e.name} className="rounded-lg bg-destructive/5 px-2.5 py-1.5 text-xs text-destructive" role="alert">
                    <span className="font-semibold">{e.name}:</span> {t(e.error)}
                  </li>
                ))}
              </ul>
            )}
            {needsTranscodeHint && (
              <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3">
                <p className="w-full text-xs text-muted-foreground">{t('video.aviHint')}</p>
                <button
                  onClick={() => onPickTool('video-convert', files)}
                  className="flex cursor-pointer items-center gap-1 rounded-full bg-card px-2.5 py-1 text-xs font-semibold text-primary shadow-sm transition-all duration-150 hover:-translate-y-px hover:shadow"
                >
                  <IArrowRight size={12} /> {t(getTool('video-convert')!.nameKey)}
                </button>
              </div>
            )}
          </section>
          {!running && outputs.length === 0 && !error && !cancelled && files.length > 0 && (() => {
            const recs = recommendationsFor(files[0].name)
              .filter((id) => id !== tool.id && getTool(id))
              .slice(0, 5);
            if (recs.length === 0) return null;
            return (
              <section aria-label={t('rec.title')} className="rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary" aria-hidden="true"><IStar size={13} /></span>
                  <h3 className="text-xs font-bold">{t('rec.title')}</h3>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {recs.map((id) => (
                    <button
                      key={id}
                      onClick={() => onPickTool(id, files)}
                      className="flex cursor-pointer items-center gap-1 rounded-full bg-card px-2.5 py-1 text-xs font-semibold text-primary shadow-sm transition-all duration-150 hover:-translate-y-px hover:shadow"
                    >
                      <IArrowRight size={12} /> {t(getTool(id)!.nameKey)}
                    </button>
                  ))}
                </div>
              </section>
            );
          })()}

          {!running && outputs.length === 0 && (
            <section aria-label={t('step.configure')} className="space-y-3 rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 border-b border-border pb-2">
                <span className="wk-mono wk-nums flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-[11px] font-bold text-primary" aria-hidden="true">02</span>
                <h3 className="text-sm font-bold">{t('step.configure')}</h3>
              </div>
              {showQuality && (
                <>
                  <Segmented
                    label={t('cfg.quality')}
                    value={preset}
                    onChange={applyPreset}
                    options={[
                      { value: 'max', label: t('cfg.presetMax') },
                      { value: 'balanced', label: t('cfg.presetBalanced') },
                      { value: 'smallest', label: t('cfg.presetSmallest') },
                      { value: 'custom', label: t('cfg.presetCustom') },
                    ]}
                  />
                  <Slider value={quality} min={1} max={100} onChange={(v) => { setQuality(v); setPreset('custom'); }} label={t('cfg.quality')} />
                </>
              )}
              {showResize && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <NumberInput value={width} onChange={setWidth} label={`${t('cfg.width')} (px, ${t('common.original')})`} min={1} />
                    <NumberInput value={height} onChange={setHeight} label={`${t('cfg.height')} (px, ${t('common.original')})`} min={1} />
                  </div>
                  <Checkbox checked={keepRatio} onChange={setKeepRatio} label={t('cfg.keepRatio')} />
                </>
              )}
              {PDF_RENDER.includes(tool.id) && (
                <>
                  <Segmented
                    label={t('cfg.renderQuality')}
                    value={renderQ}
                    onChange={setRenderQ}
                    options={[
                      { value: 'low', label: t('cfg.qualityLow') },
                      { value: 'medium', label: t('cfg.qualityMedium') },
                      { value: 'high', label: t('cfg.qualityHigh') },
                    ]}
                  />
                  <Segmented
                    label={t('cfg.pages')}
                    value={pagesMode}
                    onChange={setPagesMode}
                    options={[
                      { value: 'all', label: t('cfg.pagesAll') },
                      { value: 'range', label: t('cfg.pagesRange') },
                    ]}
                  />
                  {pagesMode === 'range' && (
                    <div className="grid grid-cols-2 gap-2">
                      <NumberInput value={from} onChange={setFrom} label={t('cfg.from')} min={1} />
                      <NumberInput value={to} onChange={setTo} label={t('cfg.to')} min={1} />
                    </div>
                  )}
                </>
              )}
              {tool.id === 'pdf-split' && pageCount !== null && (
                <div className="grid grid-cols-2 gap-2">
                  <NumberInput value={from} onChange={setFrom} label={`${t('cfg.from')} (1–${pageCount})`} min={1} />
                  <NumberInput value={to} onChange={setTo} label={`${t('cfg.to')} (1–${pageCount})`} min={1} />
                </div>
              )}
              {VIDEO_FRAMES.includes(tool.id) && (
                <>
                  <Segmented
                    label={t('cfg.extraction')}
                    value={frameMode}
                    onChange={setFrameMode}
                    options={[
                      { value: 'single', label: t('cfg.singleFrame') },
                      { value: 'interval', label: t('cfg.everyX') },
                      { value: 'count', label: t('cfg.numFrames') },
                      { value: 'custom', label: t('cfg.customTimes') },
                    ]}
                  />
                  {frameMode === 'single' && <NumberInput value={singleTime} onChange={setSingleTime} label={t('cfg.timeSec')} min={0} />}
                  {frameMode === 'interval' && <NumberInput value={intervalSec} onChange={setIntervalSec} label={t('cfg.intervalSec')} min={1} />}
                  {frameMode === 'count' && <NumberInput value={frameCount} onChange={setFrameCount} label={t('cfg.frameCount')} min={1} />}
                  {frameMode === 'custom' && <TextInput value={timestamps} onChange={setTimestamps} label={t('cfg.timestamps')} placeholder="5, 12.5, 1:30" />}
                  <NumberInput value={frameMaxWidth} onChange={setFrameMaxWidth} label={`${t('cfg.maxWidth')}`} min={1} />
                </>
              )}
              {tool.id === 'video-to-gif' && (
                <>
                  <NumberInput value={intervalSec} onChange={setIntervalSec} label={t('cfg.intervalSec')} min={1} />
                  <div className="grid grid-cols-2 gap-2">
                    <NumberInput value={gifMaxFrames} onChange={setGifMaxFrames} label={t('cfg.gifMaxFrames')} min={1} />
                    <NumberInput value={gifWidth} onChange={setGifWidth} label={t('cfg.gifWidth')} min={64} />
                  </div>
                </>
              )}
              {AUDIO_MP3.includes(tool.id) && (
                <Segmented
                  label={t('cfg.bitrate')}
                  value={String(bitrate)}
                  onChange={(v) => setBitrate(Number(v))}
                  options={[
                    { value: '96', label: '96 kbps' },
                    { value: '128', label: '128 kbps' },
                    { value: '192', label: '192 kbps' },
                    { value: '320', label: '320 kbps' },
                  ]}
                />
              )}
              {tool.id === 'image-crop' && (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <NumberInput value={cropX} onChange={setCropX} label={t('cfg.cropX')} min={0} />
                  <NumberInput value={cropY} onChange={setCropY} label={t('cfg.cropY')} min={0} />
                  <NumberInput value={cropW} onChange={setCropW} label={t('cfg.cropW')} min={1} />
                  <NumberInput value={cropH} onChange={setCropH} label={t('cfg.cropH')} min={1} />
                </div>
              )}
              {tool.id === 'image-rotate' && (
                <>
                  <Segmented
                    label={t('cfg.angle')}
                    value={angle}
                    onChange={setAngle}
                    options={[
                      { value: '0', label: '0°' },
                      { value: '90', label: '90°' },
                      { value: '180', label: '180°' },
                      { value: '270', label: '270°' },
                    ]}
                  />
                  <div className="flex gap-4">
                    <Checkbox checked={flipH} onChange={setFlipH} label={t('cfg.flipH')} />
                    <Checkbox checked={flipV} onChange={setFlipV} label={t('cfg.flipV')} />
                  </div>
                </>
              )}
              {tool.id === 'image-filters' && (
                <>
                  <Checkbox checked={grayscale} onChange={setGrayscale} label={t('cfg.grayscale')} />
                  <Slider value={brightness} min={50} max={150} onChange={setBrightness} label={t('cfg.brightness')} />
                  <Slider value={contrast} min={50} max={150} onChange={setContrast} label={t('cfg.contrast')} />
                  <Slider value={saturate} min={0} max={200} onChange={setSaturate} label={t('cfg.saturate')} />
                  <Slider value={blur} min={0} max={10} onChange={setBlur} label={t('cfg.blur')} unit="px" />
                </>
              )}
              {tool.id === 'pdf-watermark' && (
                <>
                  <TextInput value={wmText} onChange={setWmText} label={t('cfg.watermarkText')} placeholder="WinKit" />
                  <Slider value={wmOpacity} min={5} max={80} onChange={setWmOpacity} label={t('cfg.opacity')} />
                </>
              )}
              {tool.id === 'ocr-image-to-text' || tool.id === 'pdf-ocr-text' ? (
                <>
                  <Segmented
                    label={t('cfg.ocrLang')}
                    value={ocrLang}
                    onChange={setOcrLang}
                    options={[
                      { value: 'eng', label: 'English' },
                      { value: 'ind', label: 'Indonesia' },
                    ]}
                  />
                  <p className="text-xs text-muted-foreground">{t('cfg.noteOcr')}</p>
                </>
              ) : null}
              {tool.id === 'word-to-pdf' && <p className="text-xs text-muted-foreground">{t('cfg.noteWordPdf')}</p>}
              {tool.id === 'video-convert' && (
                <>
                  <Segmented
                    label={t('cfg.outputFormat')}
                    value={vcFormat}
                    onChange={setVcFormat}
                    options={[
                      { value: 'mp4', label: 'MP4 (H.264)' },
                      { value: 'webm', label: 'WebM (VP9)' },
                    ]}
                  />
                  <Segmented
                    label={t('cfg.renderQuality')}
                    value={vcQuality}
                    onChange={setVcQuality}
                    options={[
                      { value: 'low', label: t('cfg.qualityLow') },
                      { value: 'medium', label: t('cfg.qualityMedium') },
                      { value: 'high', label: t('cfg.qualityHigh') },
                    ]}
                  />
                  <NumberInput value={vcMaxWidth} onChange={setVcMaxWidth} label={t('cfg.maxWidth')} min={1} />
                  <p className="text-xs text-muted-foreground">
                    {t('cfg.threadMode')}: <span className="font-bold text-primary">{t(isolated ? 'ff.multi' : 'ff.single')}</span>
                    {' · '}{t('cfg.noteFfmpeg')}
                  </p>
                </>
              )}
              {tool.id === 'video-trim' && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <NumberInput value={trimStart} onChange={setTrimStart} label={t('cfg.trimStart')} min={0} />
                    <NumberInput value={trimEnd} onChange={setTrimEnd} label={t('cfg.trimEnd')} min={0} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('cfg.threadMode')}: <span className="font-bold text-primary">{t(isolated ? 'ff.multi' : 'ff.single')}</span>
                    {' · '}{t('cfg.noteFfmpeg')}
                  </p>
                </>
              )}
              {tool.id === 'image-sharpen' && (
                <Slider value={sharpenAmt} min={1} max={100} onChange={setSharpenAmt} label={t('cfg.sharpen')} />
              )}
              {tool.id === 'pdf-organize' && orgOrder.length > 0 && (
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <p className="text-sm font-medium">{t('cfg.pages')} ({orgOrder.length})</p>
                    <button
                      onClick={() => {
                        if (pageCount !== null) {
                          setOrgOrder(Array.from({ length: pageCount }, (_, i) => i + 1));
                          setOrgRot({});
                        }
                      }}
                      className="cursor-pointer rounded px-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      {t('cfg.resetPages')}
                    </button>
                  </div>
                  <ul className="max-h-48 space-y-1 overflow-auto">
                    {orgOrder.map((p, i) => (
                      <li key={`${p}-${i}`} className="flex items-center gap-1 rounded-lg bg-muted/60 px-2 py-1 text-xs">
                        <span className="wk-mono wk-nums w-14 shrink-0 font-bold">p{p}{orgRot[p] ? ` +${orgRot[p] * 90}` : ''}</span>
                        <span className="flex-1" />
                        <button onClick={() => orgRotate(i)} title={t('cfg.rotatePage')} aria-label={t('cfg.rotatePage')} className="flex cursor-pointer items-center px-1"><IRotateCw size={13} /></button>
                        <button onClick={() => orgDup(i)} title={t('cfg.duplicate')} aria-label={t('cfg.duplicate')} className="flex cursor-pointer items-center px-1"><ICopy size={13} /></button>
                        <button onClick={() => orgMove(i, -1)} aria-label={t('cfg.moveUp')} className="flex cursor-pointer items-center px-1"><IChevUp size={13} /></button>
                        <button onClick={() => orgMove(i, 1)} aria-label={t('cfg.moveDown')} className="flex cursor-pointer items-center px-1"><IChevDown size={13} /></button>
                        <button onClick={() => orgDel(i)} title={t('cfg.deletePage')} aria-label={t('cfg.deletePage')} className="flex cursor-pointer items-center px-1 hover:text-destructive"><IX size={13} /></button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          {!running && outputs.length === 0 && !error && !cancelled && (
            <>
              {sizeWarn && files.length > 0 && (
                <p className="mb-2 rounded-xl border border-accent/40 bg-accent/5 px-4 py-2.5 text-xs text-muted-foreground" role="status">
                  {t('err.tooLarge')}
                </p>
              )}
              <button
                onClick={start}
                className="w-full cursor-pointer rounded-xl bg-accent px-4 py-3 text-sm font-bold text-black transition-opacity duration-200 hover:opacity-90"
              >
                {startLabel}
              </button>
            </>
          )}

          {running && (
            <div className="space-y-3 rounded-xl border border-border bg-card p-4">
              <ProgressBar percent={prog.total ? (prog.done / prog.total) * 100 : 0} label={procMsg ? translate(procMsg.key, procMsg.params) : t('proc.processing')} />
              <button
                onClick={() => {
                  tokenRef.current.cancelled = true;
                }}
                className="w-full cursor-pointer rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:border-destructive hover:text-destructive"
              >
                {t('common.cancel')}
              </button>
            </div>
          )}

          {cancelled && !running && (
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <p className="text-sm">{t('proc.cancelled')}</p>
              <button onClick={start} className="mt-2 cursor-pointer rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">
                {t('common.tryAgain')}
              </button>
            </div>
          )}

          {error && !running && (
            <div className="rounded-xl border border-destructive/40 bg-card p-4 text-center">
              <p className="text-sm text-destructive" role="alert">{t(error)}</p>
              <button onClick={start} className="mt-2 cursor-pointer rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">
                {t('common.tryAgain')}
              </button>
            </div>
          )}

          {outputs.length > 0 && !running && (
            <div className="wk-pop space-y-3 rounded-2xl border border-primary/30 bg-card p-4">
              <div className="flex items-center gap-2 border-b border-border pb-2">
                <span className="wk-mono wk-nums flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-[11px] font-bold text-primary" aria-hidden="true">04</span>
                <h3 className="text-sm font-bold">{t('step.preview')} · {t('step.download')}</h3>
              </div>
              <p className="text-sm font-bold text-primary">
                ✓ {tool.id === 'pdf-merge' ? t('proc.mergeComplete') : tool.id === 'pdf-split' ? t('proc.splitComplete') : t('proc.complete')}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('proc.filesCreated', { n: outputs.length })}
                {savedTotal > 0 && <> · {t('proc.saved', { n: formatBytes(savedTotal) })}</>}
              </p>
              {previewUrls.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {outputs
                    .filter((o) => o.blob.type.startsWith('image/'))
                    .slice(0, 6)
                    .map((o, i) => (
                      <figure key={o.name} className="overflow-hidden rounded-lg border border-border">
                        <img src={previewUrls[i]} alt={o.name} className="aspect-square w-full object-cover" loading="lazy" />
                        <figcaption className="truncate px-1 py-0.5 text-[10px] text-muted-foreground">{o.name}</figcaption>
                      </figure>
                    ))}
                </div>
              )}
              {textOutputs.length > 0 && textOutputs.slice(0, 2).map((o) => <TextSnippet key={o.name} blob={o.blob} />)}
              <ul className="max-h-32 space-y-1 overflow-auto">
                {outputs.map((o) => (
                  <li key={o.name} className="flex items-center justify-between gap-2 rounded-lg bg-muted/60 px-2 py-1.5 text-xs">
                    <span className="min-w-0 flex-1 truncate">
                      {o.name}
                      <span className="wk-mono wk-nums ml-2 text-muted-foreground">
                        {formatBytes(o.size)}
                        {o.width ? ` · ${o.width}×${o.height}` : ''}
                        {o.pages ? ` · ${o.pages}p` : ''}
                      </span>
                    </span>
                    <button onClick={() => { void downloadBlob(o.blob, o.name); setDownloaded(true); }} className="shrink-0 cursor-pointer font-semibold text-primary">
                      {t('common.download')}
                    </button>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                {outputs.length === 1 ? (
                  <button onClick={() => { void downloadBlob(outputs[0].blob, outputs[0].name); setDownloaded(true); }} className="flex-1 cursor-pointer rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-black transition-opacity hover:opacity-90">
                    {t('common.download')}
                  </button>
                ) : (
                  <>
                    <button onClick={() => { void downloadAll(outputs); setDownloaded(true); }} className="flex-1 cursor-pointer rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-black transition-opacity hover:opacity-90">
                      {t('common.downloadAll')}
                    </button>
                    <button onClick={() => { void downloadZip(outputs, `${baseName(files[0].name)}-winkit.zip`); setDownloaded(true); }} className="flex-1 cursor-pointer rounded-xl border border-primary px-4 py-2.5 text-sm font-bold text-primary">
                      {t('common.downloadZip')}
                    </button>
                  </>
                )}
              </div>
              {tool.id === 'pdf-to-word' && cloudOn && (
                <button
                  onClick={askCloud}
                  className="w-full cursor-pointer rounded-xl border border-border px-4 py-2.5 text-xs font-bold text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  ☁ {t('cloud.tryCloud')}
                </button>
              )}
            </div>
          )}
          {consent !== null && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4" onClick={() => setConsent(null)} role="presentation">
              <div
                className="wk-pop w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label={t('cloud.consentT')}
              >
                <h3 className="text-sm font-black">☁ {t('cloud.consentT')}</h3>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{t('cloud.consentB')}</p>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => setConsent(null)}
                    className="flex-1 cursor-pointer rounded-xl border border-border px-4 py-2.5 text-sm font-bold"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    onClick={() => {
                      const fn = consent;
                      setConsent(null);
                      void fn();
                    }}
                    className="flex-1 cursor-pointer rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-black"
                  >
                    {t('cloud.continue')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
