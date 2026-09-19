// Platform adapter: one place that knows whether we run as an installed
// Chrome extension or as a plain website. All chrome.* access lives here
// (or behind the helpers below) so src/ stays portable across both targets.

export function isExtension(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.runtime?.id;
}

/** Extension dashboard URL vs. web app page. */
export function openAppPage(toolId?: string): void {
  const page = `dashboard.html${toolId ? `?tool=${toolId}` : ''}`;
  if (isExtension()) {
    void chrome.tabs.create({ url: chrome.runtime.getURL(page) });
    window.close();
    return;
  }
  window.open(`${page}`, '_blank');
}

export async function downloadFile(blob: Blob, filename: string): Promise<void> {
  const url = URL.createObjectURL(blob);
  try {
    if (isExtension() && chrome.downloads) {
      await chrome.downloads.download({ url, filename, saveAs: false });
    } else {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}

export async function notifyUser(message: string, respectSetting: () => Promise<boolean>): Promise<void> {
  try {
    if (!(await respectSetting())) return;
    if (isExtension() && chrome.notifications) {
      await chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'WinKit',
        message,
      });
      return;
    }
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification('WinKit', { body: message });
      } else if (Notification.permission === 'default') {
        const p = await Notification.requestPermission();
        if (p === 'granted') new Notification('WinKit', { body: message });
      }
    }
  } catch {
    // notifications must never break processing
  }
}
