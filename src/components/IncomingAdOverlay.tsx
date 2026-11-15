import React from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { BannerAd320x50 } from './BannerAd320x50';

interface IncomingAdOverlayProps {
  open: boolean;
  progressPct: number;
}

export const IncomingAdOverlay: React.FC<IncomingAdOverlayProps> = ({
  open,
  progressPct,
}) => {
  if (!open) return null;

  const clampedPct = Math.max(0, Math.min(100, progressPct));
  const isFinished = clampedPct >= 100;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Warning: Incoming Ad"
      className="fixed inset-0 z-[90] bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
    >
      <div
        className={`w-full max-w-md rounded-2xl bg-gradient-to-b from-[#1B150A] via-[#100E13] to-[#08080B] border p-5 sm:p-6 text-center space-y-5 transition-all duration-300 ${
          isFinished
            ? 'border-emerald-400/80 shadow-[0_16px_60px_rgba(34,197,94,0.28)]'
            : 'border-[#E5C158]/70 shadow-[0_16px_60px_rgba(212,175,55,0.28)]'
        }`}
      >
        {isFinished ? (
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/70 text-emerald-300 mx-auto flex items-center justify-center shadow-lg shadow-emerald-500/25">
            <CheckCircle2 className="w-7 h-7 text-emerald-400" />
          </div>
        ) : (
          <div className="w-12 h-12 rounded-2xl gold-gradient-bg text-[#181307] mx-auto flex items-center justify-center shadow-lg shadow-[#D4AF37]/30 animate-pulse">
            <AlertTriangle className="w-6 h-6" />
          </div>
        )}

        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#D4AF37]">
            DRAMA WIN TORNEMENT Sponsor Break
          </p>
          <h2 className="text-xl sm:text-2xl font-display font-bold gold-gradient-text">
            {isFinished ? 'Ad Finished!' : 'Warning: Incoming Ad'}
          </h2>
          <p className="text-xs sm:text-sm text-[#DDD4C4] leading-relaxed">
            {isFinished
              ? 'Thank you for supporting our sponsors.'
              : 'Sponsor spotlight in progress — you will return to your drama automatically.'}
          </p>
        </div>

        {/* Dedicated 320x50 Ad Banner inside the Incoming Ad Overlay */}
        <div className="flex justify-center py-1">
          <BannerAd320x50 />
        </div>

        {/* Smooth Animated Golden Progress Bar (NO countdown numbers) */}
        <div className="space-y-2.5">
          <div
            role="progressbar"
            aria-valuenow={Math.round(clampedPct)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Sponsor break progress"
            className="h-3 w-full rounded-full bg-[#070709] border border-[#D4AF37]/30 overflow-hidden p-0.5"
          >
            <div
              className={`h-full rounded-full transition-[width] duration-150 ease-linear ${
                isFinished
                  ? 'bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.6)]'
                  : 'bg-gradient-to-r from-[#A88220] via-[#D4AF37] to-[#FCE7A2] shadow-[0_0_12px_rgba(243,211,122,0.5)]'
              }`}
              style={{ width: `${Math.max(3, clampedPct)}%` }}
            />
          </div>

          {isFinished ? (
            <div
              role="status"
              className="inline-flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-400/50 text-xs sm:text-sm font-bold text-emerald-300 shadow-[0_0_18px_rgba(52,211,153,0.2)]"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Ad Finished! Resuming drama...</span>
            </div>
          ) : (
            <p className="text-[11px] font-medium text-[#E8C96D] tracking-wide">
              Sponsored break playing...
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
