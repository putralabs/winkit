import md5 from 'blueimp-md5';

// Pure, local text utilities for the Developer tools (PRD §22). No network.

export function jsonPretty(input: string): string {
  return JSON.stringify(JSON.parse(input), null, 2);
}

export function jsonMinify(input: string): string {
  return JSON.stringify(JSON.parse(input));
}

export function jsonValidate(input: string): { ok: true } | { ok: false; error: string } {
  try {
    JSON.parse(input);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

const enc = new TextEncoder();
const dec = new TextDecoder();

export function base64Encode(input: string): string {
  const bytes = enc.encode(input);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export function base64Decode(input: string): string {
  const clean = input.trim().replace(/\s+/g, '');
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return dec.decode(bytes);
}

export function urlEncode(input: string): string {
  return encodeURIComponent(input);
}

export function urlDecode(input: string): string {
  return decodeURIComponent(input.replace(/\+/g, ' '));
}

export type HashAlgo = 'md5' | 'sha1' | 'sha256' | 'sha512';

export async function hashText(input: string, algo: HashAlgo): Promise<string> {
  if (algo === 'md5') return md5(input);
  const map: Record<string, string> = { sha1: 'SHA-1', sha256: 'SHA-256', sha512: 'SHA-512' };
  const digest = await crypto.subtle.digest(map[algo], enc.encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function genUuids(count: number): string {
  const n = Math.max(1, Math.min(100, Math.floor(count) || 1));
  return Array.from({ length: n }, () => crypto.randomUUID()).join('\n');
}

export function convertTimestamp(input: string): string {
  const s = input.trim();
  if (s === '') {
    const now = Date.now();
    return `ms: ${now}\ns: ${Math.floor(now / 1000)}\niso: ${new Date(now).toISOString()}`;
  }
  if (/^-?\d+$/.test(s)) {
    const n = Number(s);
    // Heuristic: < 1e12 = seconds, else milliseconds.
    const ms = Math.abs(n) < 1e12 ? n * 1000 : n;
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) throw new Error('bad-timestamp');
    return `iso: ${d.toISOString()}\nlocal: ${d.toLocaleString()}\nms: ${d.getTime()}\ns: ${Math.floor(d.getTime() / 1000)}`;
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw new Error('bad-timestamp');
  return `ms: ${d.getTime()}\ns: ${Math.floor(d.getTime() / 1000)}\niso: ${d.toISOString()}`;
}

export interface RegexHit {
  match: string;
  index: number;
}

export function testRegex(pattern: string, flags: string, text: string): RegexHit[] {
  const safeFlags = [...new Set(flags.replace(/[^gimsuy]/g, '').split(''))].join('');
  const re = new RegExp(pattern, safeFlags.includes('g') ? safeFlags : safeFlags + 'g');
  const out: RegexHit[] = [];
  let m: RegExpExecArray | null;
  for (let guard = 0; guard < 500; guard++) {
    m = re.exec(text);
    if (!m) break;
    out.push({ match: m[0] === '' ? '(empty)' : m[0], index: m.index });
    if (m[0] === '') re.lastIndex++;
    if (out.length >= 100) break;
  }
  return out;
}
