import React, { useState } from 'react';
import { Download, PlusSquare, Share, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface InstallAppWidgetProps {
  storageKey?: string;
}

export const InstallAppWidget: React.FC<InstallAppWidgetProps> = ({
  storageKey = 'dramawin_install_widget_dismissed_v1',
}) => {
  const { isInstallable, isInstalled, isIOS, inIframe, install } = usePWAInstall();
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    try {
      return window.localStorage.getItem(storageKey) === 'true';
    } catch {
      return false;
    }
  });
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled || dismissed) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(storageKey, 'true');
    } catch {
      // Ignore storage quota errors
    }
  };

  const handleInstallClick = async () => {
    if (isInstallable) {
      const outcome = await install();
      if (outcome === 'unavailable') {
        setShowGuide(true);
      }
      return;
    }
    setShowGuide((prev) => !prev);
  };

  return (
    <div className="rounded-2xl bg-gradient-to-r from-[#16120B] via-[#111116] to-[#15121B] border border-[#D4AF37]/40 px-4 py-3.5 shadow-[0_8px_28px_rgba(212,175,55,0.12)] space-y-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-[#09090b] border border-[#D4AF37]/60 flex items-center justify-center shrink-0 shadow-[0_0_16px_rgba(212,175,55,0.28)]">
            <Smartphone className="w-5 h-5 text-[#FCE7A2]" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-display font-bold text-[#F6F2E9] truncate">
              Install DramaWin App
            </h3>
            <p className="text-[11px] text-[#B8B0A0] truncate">
              {isInstallable
                ? 'Tap Install for one-tap Home Screen access.'
                : 'Add to your Home Screen for instant full-screen drama access.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => void handleInstallClick()}
            className="min-h-[38px] px-3.5 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-zinc-950 font-extrabold text-xs inline-flex items-center gap-1.5 shadow-[0_0_16px_rgba(251,191,36,0.35)] hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isInstallable ? 'Install App' : isIOS ? 'How to Install' : 'Install'}</span>
          </button>

          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss Install DramaWin App prompt"
            className="min-h-[36px] min-w-[36px] rounded-xl border border-white/[0.1] text-zinc-400 hover:text-white hover:bg-white/[0.06] flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {showGuide && (
        <div className="rounded-xl bg-[#09090b]/90 border border-[#D4AF37]/30 px-3.5 py-2.5 text-xs text-[#E8E1D3] flex flex-wrap items-center justify-between gap-2">
          {isIOS ? (
            <p className="flex flex-wrap items-center gap-1.5 leading-relaxed">
              <Share className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              <span>
                Tap <strong className="text-[#FCE7A2]">Share</strong> in Safari, then tap{' '}
                <strong className="text-[#FCE7A2]">Add to Home Screen</strong>.
              </span>
            </p>
          ) : (
            <p className="flex flex-wrap items-center gap-1.5 leading-relaxed">
              <PlusSquare className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              <span>
                {inIframe
                  ? 'Open the live site directly in Chrome to trigger one-tap install, or tap '
                  : 'Tap your browser menu ('}
                <strong className="text-[#FCE7A2]">⋮</strong>
                {inIframe
                  ? ' in your browser menu → Add to Home screen.'
                  : ') and select '}
                {!inIframe && (
                  <>
                    <strong className="text-[#FCE7A2]">Install app</strong> or{' '}
                    <strong className="text-[#FCE7A2]">Add to Home screen</strong>.
                  </>
                )}
              </span>
            </p>
          )}
          <button
            type="button"
            onClick={() => setShowGuide(false)}
            className="text-[11px] font-semibold text-amber-300 hover:text-amber-200 cursor-pointer"
          >
            Got it
          </button>
        </div>
      )}
    </div>
  );
};
