import { openAppPage } from './platform';
import type { Theme } from './types';

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  const dark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  root.classList.toggle('dark', dark);
  root.style.colorScheme = dark ? 'dark' : 'light';
}

export function watchSystemTheme(theme: Theme, cb: () => void): () => void {
  if (theme !== 'system') return () => {};
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const fn = () => cb();
  mq.addEventListener('change', fn);
  return () => mq.removeEventListener('change', fn);
}

export function openDashboard(toolId?: string): void {
  openAppPage(toolId);
}
