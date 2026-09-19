import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { IArrowLeft } from '../components/icons';
import { useT } from '../shared/i18n';
import { DashboardApp } from '../dashboard/App';

function WebBar() {
  const t = useT();
  return (
    <div className="flex items-center gap-2 border-b border-border bg-card px-4 py-2 text-xs">
      <a href="./index.html" className="flex items-center gap-1 font-bold text-primary hover:underline">
        <IArrowLeft size={13} /> {t('web.back')}
      </a>
      <span className="text-muted-foreground">{t('web.tag')}</span>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <WebBar />
      <div className="min-h-0 flex-1">
        <ErrorBoundary>
          <DashboardApp />
        </ErrorBoundary>
      </div>
    </div>
  </StrictMode>,
);
