import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';
import { getSettings } from '../shared/storage';
import { applyTheme } from '../shared/theme';
import { setLanguage } from '../shared/i18n';
import { Landing } from './landing';

void getSettings().then((s) => {
  setLanguage(s.language);
  applyTheme(s.theme);
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Landing />
    </StrictMode>,
  );
});
