// Drawn icon system: one 1.9px stroke, currentColor, no glyphs, no emoji.
function base(path: React.ReactNode, size = 16) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
      {path}
    </svg>
  );
}

export const IHome = (p: { size?: number }) => base(<path d="M4 11l8-7 8 7M6 10v10h12V10" strokeLinecap="round" strokeLinejoin="round" />, p.size);
export const IFileText = (p: { size?: number }) => base(<><path d="M14 3H7a1 1 0 00-1 1v16a1 1 0 001 1h10a1 1 0 001-1V8l-4-5z" strokeLinejoin="round" /><path d="M14 3v5h4" strokeLinejoin="round" /></>, p.size);
export const IImage = (p: { size?: number }) => base(<><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="M4 18l5-5 3 3 3-3 5 5" strokeLinecap="round" strokeLinejoin="round" /></>, p.size);
export const IVideo = (p: { size?: number }) => base(<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M10 9.5l5 2.5-5 2.5v-5z" strokeLinejoin="round" /></>, p.size);
export const IAudio = (p: { size?: number }) => base(<><path d="M9 18V6l10-2v12" strokeLinecap="round" strokeLinejoin="round" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="16.5" cy="16" r="2.5" /></>, p.size);
export const IDoc = (p: { size?: number }) => base(<><path d="M6 3h9l4 4v14H6V3z" strokeLinejoin="round" /><path d="M9 12h7M9 15.5h7" strokeLinecap="round" /></>, p.size);
export const IArchive = (p: { size?: number }) => base(<><rect x="3" y="4" width="18" height="5" rx="1" /><path d="M5 9v10h14V9M10 13h4" strokeLinecap="round" strokeLinejoin="round" /></>, p.size);
export const IWrench = (p: { size?: number }) => base(<path d="M14.5 6.5a4 4 0 00-5.6 5L4 16.4V20h3.6l4.9-4.9a4 4 0 005-5.6l-2.8 2.8-2.4-.7-.7-2.4 2.9-2.7z" strokeLinejoin="round" />, p.size);
export const ICode = (p: { size?: number }) => base(<path d="M8 6l-5 6 5 6M16 6l5 6-5 6" strokeLinecap="round" strokeLinejoin="round" />, p.size);
export const IStar = (p: { size?: number }) => (
  <svg width={p.size ?? 18} height={p.size ?? 18} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9 2.9-6z" />
  </svg>
);
export const IStarLine = (p: { size?: number }) => base(<path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9 2.9-6z" strokeLinejoin="round" />, p.size);
export const IArrowLeft = (p: { size?: number }) => base(<path d="M19 12H5m6-7l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />, p.size);
export const IArrowRight = (p: { size?: number }) => base(<path d="M5 12h14m-6-7l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />, p.size);
export const IChevUp = (p: { size?: number }) => base(<path d="M6 15l6-6 6 6" strokeLinecap="round" strokeLinejoin="round" />, p.size);
export const IChevDown = (p: { size?: number }) => base(<path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />, p.size);
export const IX = (p: { size?: number }) => base(<path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />, p.size);
export const IRotateCw = (p: { size?: number }) => base(<><path d="M20 12a8 8 0 11-2.3-5.6" strokeLinecap="round" /><path d="M20 3v4h-4" strokeLinecap="round" strokeLinejoin="round" /></>, p.size);
export const ICopy = (p: { size?: number }) => base(<><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 012-2h10" strokeLinecap="round" /></>, p.size);
export const IClock = (p: { size?: number }) => base(<><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" strokeLinecap="round" strokeLinejoin="round" /></>, p.size);
export const IGear = (p: { size?: number }) => base(<><circle cx="12" cy="12" r="3.2" /><path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.8 1.8M16.7 16.7l1.8 1.8M18.5 5.5l-1.8 1.8M7.3 16.7l-1.8 1.8" strokeLinecap="round" /></>, p.size);
