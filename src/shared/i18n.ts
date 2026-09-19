import { useSyncExternalStore } from 'react';
import type { Language } from './types';
import en from './locales/en.json';
import id from './locales/id.json';

// Minimal key-based i18n (PRD §64). All UI text goes through `t(key)`.
const DICTS: Record<Language, Record<string, string>> = { en, id };

let lang: Language = 'en';
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function getLanguage(): Language {
  return lang;
}

export function setLanguage(next: Language) {
  if (next !== lang) {
    lang = next;
    document.documentElement.lang = next;
    emit();
  }
}

function lookup(key: string): string {
  return DICTS[lang][key] ?? DICTS.en[key] ?? key;
}

/** Supports {name} interpolation. */
export function t(key: string, params?: Record<string, string | number>): string {
  let s = lookup(key);
  if (params) {
    for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, String(v));
  }
  return s;
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useT(): (key: string, params?: Record<string, string | number>) => string {
  useSyncExternalStore(subscribe, () => lang);
  return t;
}

export function greetingKey(date = new Date()): string {
  const h = date.getHours();
  if (h < 11) return 'home.morning';
  if (h < 15) return 'home.afternoon';
  if (h < 19) return 'home.evening';
  return 'home.night';
}
