import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import type { BeforeInstallPromptEvent } from './hooks/usePWAInstall';

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    window.__dramawinInstallPrompt = event as BeforeInstallPromptEvent;
    window.dispatchEvent(new Event('dramawin-pwa-prompt-ready'));
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => {
        registrations.forEach((registration) => {
          void registration.unregister();
        });
      })
      .catch(() => {
        // Ignore cleanup errors
      });
  }

  if ('caches' in window) {
    caches
      .keys()
      .then((keys) => {
        keys.forEach((key) => {
          void caches.delete(key);
        });
      })
      .catch(() => {
        // Ignore cache cleanup errors
      });
  }
}

createRoot(document.getElementById('root')!).render(<App />);
