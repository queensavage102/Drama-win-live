import React, { useEffect, useRef, useState } from 'react';
import {
  Clapperboard,
  Coins,
  Crown,
  Gift,
  Shield,
  Trophy,
  User,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { BRAND_NAME } from '../constants';
import { AppTab } from '../types';

interface TopHeaderProps {
  coins: number;
  sundayBonusZar: number;
  muted: boolean;
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  onToggleMute: () => void;
  onOpenAdmin: () => void;
}

const TOP_NAV_TABS: {
  id: AppTab;
  label: string;
  Icon: React.FC<{ className?: string }>;
}[] = [
  { id: 'watch', label: 'Series', Icon: Clapperboard },
  { id: 'vault', label: 'Check-In & Gifts', Icon: Gift },
  { id: 'leaderboard', label: 'Leaderboard', Icon: Trophy },
  { id: 'me', label: 'Me', Icon: User },
];

export const TopHeader: React.FC<TopHeaderProps> = ({
  coins,
  sundayBonusZar,
  muted,
  activeTab,
  onSelectTab,
  onToggleMute,
  onOpenAdmin,
}) => {
  const [displayCoins, setDisplayCoins] = useState(coins);
  const [glowActive, setGlowActive] = useState(false);
  const [floatingDelta, setFloatingDelta] = useState<{ id: number; amount: number } | null>(null);
  const prevCoinsRef = useRef(coins);
  const displayCoinsRef = useRef(coins);

  useEffect(() => {
    displayCoinsRef.current = displayCoins;
  }, [displayCoins]);

  useEffect(() => {
    const previous = prevCoinsRef.current;
    prevCoinsRef.current = coins;

    if (coins === displayCoinsRef.current) return;

    const delta = coins - previous;
    if (delta > 0) {
      setGlowActive(true);
      const badgeId = Date.now();
      setFloatingDelta({ id: badgeId, amount: delta });
      const glowTimer = window.setTimeout(() => setGlowActive(false), 900);
      const badgeTimer = window.setTimeout(() => {
        setFloatingDelta((curr) => (curr?.id === badgeId ? null : curr));
      }, 1500);

      const startVal = displayCoinsRef.current;
      const startTime = performance.now();
      const duration = 560;
      let rafId = 0;

      const step = (now: number) => {
        const t = Math.min(1, (now - startTime) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        const nextVal = Math.round(startVal + (coins - startVal) * eased);
        setDisplayCoins(nextVal);
        if (t < 1) {
          rafId = requestAnimationFrame(step);
        }
      };
      rafId = requestAnimationFrame(step);

      return () => {
        window.clearTimeout(glowTimer);
        window.clearTimeout(badgeTimer);
        cancelAnimationFrame(rafId);
      };
    }

    setDisplayCoins(coins);
  }, [coins]);

  return (
    <header className="sticky top-0 z-30 bg-[#070709]/95 backdrop-blur-md border-b border-[#D4AF37]/25 shadow-[0_8px_24px_rgba(0,0,0,0.65)]">
      {/* Main Brand Header Bar */}
      <div className="max-w-5xl mx-auto h-[54px] px-3 sm:px-6 flex items-center justify-between gap-2 sm:gap-3">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 shrink">
          <Crown className="w-4 h-4 text-[#D4AF37] shrink-0" />
          <span className="font-display text-xs sm:text-sm md:text-base font-bold tracking-tight text-[#F6F2E9] truncate">
            {BRAND_NAME}
          </span>
        </div>

        <div className="relative shrink-0">
          <div
            className={`gold-gradient-bg text-[#181307] rounded-full px-2.5 sm:px-3 py-1 flex items-center gap-1.5 transition-all duration-300 ${
              glowActive
                ? 'ring-2 ring-[#FFF5CA] shadow-[0_0_24px_rgba(252,231,162,0.75)] scale-[1.04]'
                : 'shadow-sm shadow-[#D4AF37]/20'
            }`}
          >
            <Coins className="w-3.5 h-3.5 shrink-0" />
            <span className="font-mono-num text-[11px] sm:text-xs font-extrabold whitespace-nowrap">
              {displayCoins.toLocaleString()} Coins
            </span>
            <span className="hidden sm:inline text-[#181307]/45 text-xs" aria-hidden="true">
              ·
            </span>
            <span className="hidden sm:inline font-mono-num text-xs font-semibold whitespace-nowrap">
              +R{sundayBonusZar} Pool
            </span>
          </div>

          {floatingDelta && (
            <span
              key={floatingDelta.id}
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-7 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-[#181307] border border-[#FCE7A2]/80 text-[#FCE7A2] font-mono-num text-[11px] font-extrabold whitespace-nowrap shadow-lg animate-bounce"
            >
              +{floatingDelta.amount.toLocaleString()} 🪙
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onToggleMute}
            aria-pressed={!muted}
            aria-label={muted ? 'Sound Off — tap to turn sound on' : 'Sound On — tap to turn sound off'}
            className={`min-h-[38px] px-2.5 rounded-lg border text-[11px] sm:text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
              muted
                ? 'border-white/[0.12] bg-[#121217] text-[#8D867A] hover:text-[#F6F2E9]'
                : 'border-[#D4AF37]/40 bg-[#17130A] text-[#FCE7A2] hover:border-[#D4AF37]/70'
            }`}
          >
            {muted ? (
              <>
                <VolumeX className="w-3.5 h-3.5 text-[#8D867A]" />
                <span className="hidden xs:inline">Sound Off</span>
              </>
            ) : (
              <>
                <Volume2 className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span className="hidden xs:inline">Sound On</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onOpenAdmin}
            className="min-h-[38px] px-2.5 sm:px-3 rounded-lg border border-[#D4AF37]/30 bg-[#121217] text-[#E8C96D] hover:bg-[#1A1A22] hover:border-[#D4AF37]/60 text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Shield className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Admin</span>
          </button>
        </div>
      </div>

      {/* 4 Top Navigation Tabs strictly beneath DRAMA WIN TORNEMENT Header */}
      <nav
        aria-label="Primary sections"
        className="border-t border-white/[0.07] bg-[#09090D]"
      >
        <div className="max-w-5xl mx-auto px-2 sm:px-6 py-1.5 grid grid-cols-4 gap-1.5">
          {TOP_NAV_TABS.map(({ id, label, Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onSelectTab(id)}
                aria-current={isActive ? 'page' : undefined}
                className={`min-h-[44px] px-2 py-1.5 rounded-xl flex items-center justify-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'gold-gradient-bg text-[#181307] shadow-md shadow-[#D4AF37]/25 font-extrabold'
                    : 'text-[#A69F91] hover:text-[#F6F2E9] hover:bg-white/[0.04] font-semibold'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? 'text-[#181307]' : 'text-[#D4AF37]'
                  }`}
                />
                <span className="text-[11px] sm:text-xs tracking-tight truncate">
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </header>
  );
};
