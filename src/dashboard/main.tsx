import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { DashboardApp } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <DashboardApp />
    </ErrorBoundary>
  </StrictMode>,
);
