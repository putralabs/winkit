import type { CancelToken, OutputFile, Progress } from '../shared/types';
import { baseName } from '../shared/validation';

export interface AudioMeta {
  duration: number;
  sampleRate: number;
  channels: number;
}

let ctx: AudioContext | null = null;

function audioCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** Decode any browser-supported media (mp3/wav/m4a/mp4/...) to PCM. Throws 'decode' on failure. */
export async function decodeMedia(file: File): Promise<{ left: Float32Array; right: Float32Array | null; meta: AudioMeta }> {
  const buf = await file.arrayBuffer();
  let audio: AudioBuffer;
  try {
    audio = await audioCtx().decodeAudioData(buf);
  } catch {
    throw new Error('decode');
  }
  const channels = audio.numberOfChannels;
  const left = audio.getChannelData(0);
  const right = channels > 1 ? audio.getChannelData(1) : null;
  return { left, right, meta: { duration: audio.duration, sampleRate: audio.sampleRate, channels } };
}

function floatTo16(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

async function yieldUi(): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
}

/** Encode PCM to MP3 with lamejs, chunked with progress. Fully local. */
export async function pcmToMp3(
  left: Float32Array,
  right: Float32Array | null,
  sampleRate: number,
  bitrate: number,
  token: CancelToken,
  onProgress: (p: Progress) => void,
): Promise<Blob> {
  const lame = (await import('lamejs')).default;
  const channels = right ? 2 : 1;
  const enc = new lame.Mp3Encoder(channels, sampleRate, bitrate);
  const l16 = floatTo16(left);
  const r16 = right ? floatTo16(right) : null;
  const parts: BlobPart[] = [];
  const CHUNK = 1152 * 64;
  const total = Math.ceil(l16.length / CHUNK);
  for (let i = 0; i < total; i++) {
    if (token.cancelled) throw new Error('cancelled');
    const s = i * CHUNK;
    const l = l16.subarray(s, s + CHUNK);
    const r = r16 ? r16.subarray(s, s + CHUNK) : undefined;
    const data = r ? enc.encodeBuffer(l, r) : enc.encodeBuffer(l);
    if (data.length > 0) parts.push(new Uint8Array(data));
    onProgress({ done: i + 1, total: total + 1 });
    if (i % 8 === 0) await yieldUi();
  }
  const end = enc.flush();
  if (end.length > 0) parts.push(new Uint8Array(end));
  onProgress({ done: total + 1, total: total + 1 });
  return new Blob(parts, { type: 'audio/mpeg' });
}

/** Encode PCM to 16-bit WAV. Fully local. */
export function pcmToWav(left: Float32Array, right: Float32Array | null, sampleRate: number): Blob {
  const channels = right ? 2 : 1;
  const l16 = floatTo16(left);
  const r16 = right ? floatTo16(right) : null;
  const frames = l16.length;
  const buf = new ArrayBuffer(44 + frames * channels * 2);
  const v = new DataView(buf);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  v.setUint32(4, 36 + frames * channels * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, channels, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * channels * 2, true);
  v.setUint16(32, channels * 2, true);
  v.setUint16(34, 16, true);
  writeStr(36, 'data');
  v.setUint32(40, frames * channels * 2, true);
  let off = 44;
  for (let i = 0; i < frames; i++) {
    v.setInt16(off, l16[i], true);
    off += 2;
    if (r16) {
      v.setInt16(off, r16[i], true);
      off += 2;
    }
  }
  return new Blob([buf], { type: 'audio/wav' });
}

export async function mediaToMp3(
  file: File,
  bitrate: number,
  token: CancelToken,
  onProgress: (p: Progress) => void,
): Promise<{ output: OutputFile; meta: AudioMeta }> {
  const { left, right, meta } = await decodeMedia(file);
  if (token.cancelled) throw new Error('cancelled');
  const blob = await pcmToMp3(left, right, meta.sampleRate, bitrate, token, onProgress);
  return { output: { name: `${baseName(file.name)}.mp3`, blob, size: blob.size }, meta };
}

export async function mediaToWav(
  file: File,
  token: CancelToken,
): Promise<{ output: OutputFile; meta: AudioMeta }> {
  const { left, right, meta } = await decodeMedia(file);
  if (token.cancelled) throw new Error('cancelled');
  const blob = pcmToWav(left, right, meta.sampleRate);
  return { output: { name: `${baseName(file.name)}.wav`, blob, size: blob.size }, meta };
}
