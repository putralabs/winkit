// WinKit shared types - mirrors PRD §45 (Processor interface) and §28 (job states).

export type JobState =
  | 'waiting'
  | 'preparing'
  | 'processing'
  | 'finalizing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type ImageFormat = 'jpg' | 'png' | 'webp';
export type PdfImageFormat = 'jpg' | 'png' | 'webp';

export interface OutputFile {
  name: string;
  blob: Blob;
  size: number;
  width?: number;
  height?: number;
  pages?: number;
}

export interface Progress {
  done: number;
  total: number;
  messageKey?: string;
  messageParams?: Record<string, string | number>;
}

export interface CancelToken {
  cancelled: boolean;
}

export function newCancelToken(): CancelToken {
  return { cancelled: false };
}

export interface ImageOptions {
  format: ImageFormat;
  /** 1-100, ignored for PNG (lossless) */
  quality: number;
  /** target width in px, null = original */
  width: number | null;
  /** target height in px, null = original */
  height: number | null;
  keepRatio: boolean;
}

export interface PdfRenderOptions {
  format: PdfImageFormat;
  quality: number;
  /** render scale: low=1, balanced=1.5, high=2 */
  scale: number;
  fromPage: number | null;
  toPage: number | null;
}

export type ProcessingStatus = 'completed' | 'failed' | 'cancelled';

export interface HistoryEntry {
  id: string;
  toolId: string;
  fileName: string;
  date: number;
  status: ProcessingStatus;
  size: number;
  outputFormat: string;
}

export type Theme = 'system' | 'light' | 'dark';
export type Language = 'en' | 'id';

export interface Settings {
  theme: Theme;
  language: Language;
  /** concurrent workers for batch processing (PRD §27) */
  workers: number;
  preferLocal: boolean;
  askBeforeCloud: boolean;
  notifications: boolean;
  animations: boolean;
  /** cloud scaffold endpoint, e.g. http://127.0.0.1:8787 - empty = cloud off */
  cloudUrl: string;
  cloudKey: string;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  language: 'en',
  workers: 2,
  preferLocal: true,
  askBeforeCloud: true,
  notifications: true,
  animations: true,
  cloudUrl: '',
  cloudKey: '',
};

export type ToolCategory = 'pdf' | 'images' | 'video' | 'audio' | 'documents' | 'archives' | 'utilities' | 'developer';

export interface ToolDef {
  id: string;
  category: ToolCategory;
  /** accepted extensions, e.g. ['.jpg', '.jpeg', '.png'] */
  accept: string[];
  multiple: boolean;
  /** 'file' tools process files; 'text' tools process pasted text (default: 'file') */
  kind?: 'file' | 'text';
  /** true = website target only (e.g. needs SharedArrayBuffer) */
  webOnly?: boolean;
  /** i18n keys */
  nameKey: string;
  descKey: string;
}
