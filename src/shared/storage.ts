import { DEFAULT_SETTINGS, type HistoryEntry, type ProcessingStatus, type Settings } from './types';

// chrome.storage.local first (PRD §49), localStorage fallback for web dev.
const hasChromeStorage =
  typeof chrome !== 'undefined' && !!chrome.storage?.local;

const mem = new Map<string, unknown>();

function lsGet(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as unknown) : undefined;
  } catch {
    return mem.get(key);
  }
}

function lsSet(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    mem.set(key, value);
  }
}

function lsRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    mem.delete(key);
  }
}

export async function storeGet<T>(key: string, fallback: T): Promise<T> {
  if (hasChromeStorage) {
    const out = await chrome.storage.local.get(key);
    return (out[key] as T) ?? fallback;
  }
  return (lsGet(key) as T) ?? fallback;
}

export async function storeSet(key: string, value: unknown): Promise<void> {
  if (hasChromeStorage) {
    await chrome.storage.local.set({ [key]: value });
    return;
  }
  lsSet(key, value);
}

const K = {
  settings: 'winkit.settings',
  favorites: 'winkit.favorites',
  history: 'winkit.history',
  recent: 'winkit.recent',
} as const;

export async function getSettings(): Promise<Settings> {
  const raw = await storeGet<Partial<Settings>>(K.settings, {});
  return { ...DEFAULT_SETTINGS, ...raw };
}

export async function saveSettings(s: Settings): Promise<void> {
  await storeSet(K.settings, s);
}

export async function getFavorites(): Promise<string[]> {
  return storeGet<string[]>(K.favorites, []);
}

export async function toggleFavorite(toolId: string): Promise<string[]> {
  const favs = await getFavorites();
  const next = favs.includes(toolId) ? favs.filter((f) => f !== toolId) : [...favs, toolId];
  await storeSet(K.favorites, next);
  return next;
}

export async function getHistory(): Promise<HistoryEntry[]> {
  return storeGet<HistoryEntry[]>(K.history, []);
}

/** History stores metadata only - never file contents (PRD §37). */
export async function addHistory(entry: Omit<HistoryEntry, 'id' | 'date'>): Promise<void> {
  const list = await getHistory();
  list.unshift({
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    date: Date.now(),
  });
  await storeSet(K.history, list.slice(0, 100));
}

export async function clearHistory(): Promise<void> {
  if (hasChromeStorage) await chrome.storage.local.remove(K.history);
  else lsRemove(K.history);
}

export async function recordStatus(
  toolId: string,
  fileName: string,
  status: ProcessingStatus,
  size: number,
  outputFormat: string,
): Promise<void> {
  await addHistory({ toolId, fileName, status, size, outputFormat });
}

export async function getRecentTools(): Promise<string[]> {
  return storeGet<string[]>(K.recent, []);
}

export async function pushRecentTool(toolId: string): Promise<void> {
  const list = await getRecentTools();
  await storeSet(K.recent, [toolId, ...list.filter((t) => t !== toolId)].slice(0, 8));
}

/** In-memory handoff of selected files when jumping tools (smart recommendations). */
let pendingFiles: File[] | null = null;

export function setPendingFiles(files: File[]): void {
  pendingFiles = files;
}

export function takePendingFiles(): File[] | null {
  const p = pendingFiles;
  pendingFiles = null;
  return p;
}
