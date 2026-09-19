import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';
import { setLanguage } from '../shared/i18n';
import { getSettings } from '../shared/storage';
import { applyTheme } from '../shared/theme';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { PopupApp } from './App';

void getSettings().then((s) => {
  setLanguage(s.language);
  applyTheme(s.theme);
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <PopupApp />
      </ErrorBoundary>
    </StrictMode>,
  );
});
