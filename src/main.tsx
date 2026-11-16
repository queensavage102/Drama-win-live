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
    const registerSW = () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
        // Ignore registration errors in unsupported/restricted contexts
      });
    };
    if (document.readyState === 'complete') {
      registerSW();
    } else {
      window.addEventListener('load', registerSW, { once: true });
    }
  }
}

createRoot(document.getElementById('root')!).render(<App />);
