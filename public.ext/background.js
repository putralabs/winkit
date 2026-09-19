// WinKit background service worker (vanilla, no bundling so the
// manifest path stays static). Handles install bookkeeping + context menus.
const DASHBOARD = 'dashboard.html';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'winkit-convert-image',
    title: 'WinKit: Convert image',
    contexts: ['image'],
  });
  chrome.contextMenus.create({
    id: 'winkit-extract-frame',
    title: 'WinKit: Extract video frames',
    contexts: ['video'],
  });
  chrome.contextMenus.create({
    id: 'winkit-extract-audio',
    title: 'WinKit: Extract audio (MP3)',
    contexts: ['video', 'audio'],
  });
  chrome.contextMenus.create({
    id: 'winkit-open-dashboard',
    title: 'WinKit: Open dashboard',
    contexts: ['page', 'selection', 'image', 'link'],
  });
});

function openDashboard(tool) {
  const url = chrome.runtime.getURL(DASHBOARD) + (tool ? `?tool=${tool}` : '');
  chrome.tabs.create({ url });
}

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === 'winkit-convert-image') openDashboard('image-to-webp');
  else if (info.menuItemId === 'winkit-extract-frame') openDashboard('video-to-jpg');
  else if (info.menuItemId === 'winkit-extract-audio') openDashboard('video-to-mp3');
  else openDashboard();
});

chrome.action.onClicked.addListener(() => openDashboard());
