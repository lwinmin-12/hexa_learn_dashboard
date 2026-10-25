import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { AppProviders } from './app/providers';
import { USE_MOCKS } from './lib/constants';
import './index.css';

async function start() {
  if (USE_MOCKS) {
    const { worker } = await import('./mocks/browser');
    await worker.start({ onUnhandledRequest: 'bypass' });
  }
  const root = document.getElementById('root');
  if (!root) throw new Error('Root element is missing.');
  createRoot(root).render(<StrictMode><AppProviders><App /></AppProviders></StrictMode>);
}

void start();
