import React, { useEffect, useState } from 'react';
import { CalendarCheck2, Check, CheckCircle2, Coins, Crown, Sparkles, X } from 'lucide-react';
import {
  CHECKIN_AD_DURATION_SECONDS,
  STREAK_DAYS,
  getCurrentWeekKey,
  getTodayWeekdayKey,
} from '../constants';
import { PlayerPrivate, WeekDayKey } from '../types';
import { BannerAd320x50 } from './BannerAd320x50';

interface DailyCheckInBoxProps {
  privateState: PlayerPrivate;
  onCompleteCheckIn: (dayKey: WeekDayKey, rewardCoins: number) => Promise<void>;
}

export const DailyCheckInBox: React.FC<DailyCheckInBoxProps> = ({
  privateState,
  onCompleteCheckIn,
}) => {
  const todayWeekday = getTodayWeekdayKey();
  const currentWeek = getCurrentWeekKey();
  const claimedDays =
    privateState.weekKey === currentWeek ? privateState.claimedDays || [] : [];

  const [adModalDay, setAdModalDay] = useState<{
    key: WeekDayKey;
    label: string;
    reward: number;
  } | null>(null);
  const [adProgressPct, setAdProgressPct] = useState(0);
  const [collecting, setCollecting] = useState(false);

  useEffect(() => {
    if (!adModalDay) {
      setAdProgressPct(0);
      return;
    }

    const durationMs = CHECKIN_AD_DURATION_SECONDS * 1000;
    const startedAt = Date.now();
    setAdProgressPct(2);

    const interval = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const pct = Math.min(100, (elapsed / durationMs) * 100);
      setAdProgressPct(pct);
      if (pct >= 100) {
        window.clearInterval(interval);
      }
    }, 100);

    return () => window.clearInterval(interval);
  }, [adModalDay]);

  const handleOpenCheckInAd = (day: { key: WeekDayKey; label: string; reward: number }) => {
    if (claimedDays.includes(day.key)) return;
    if (day.key !== todayWeekday) return;
    setAdModalDay(day);
  };

  const handleCollectCoins = async () => {
    if (!adModalDay || adProgressPct < 100 || collecting) return;
    setCollecting(true);
    try {
      await onCompleteCheckIn(adModalDay.key, adModalDay.reward);
      setAdModalDay(null);
    } finally {
      setCollecting(false);
    }
  };

  const isAdFinished = adProgressPct >= 100;

  return (
    <>
      <section
        id="daily-checkin-box"
        aria-label="Monday to Sunday Daily Check-In"
        className="obsidian-card rounded-2xl p-4 sm:p-6 space-y-4 border border-[#D4AF37]/40 shadow-[0_8px_32px_rgba(212,175,55,0.12)] scroll-mt-24"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <CalendarCheck2 className="w-4 h-4 text-[#D4AF37]" />
              <h2 className="text-base sm:text-lg font-display font-bold text-[#F6F2E9]">
                Mon–Sun Daily Check-In Bonus
              </h2>
            </div>
            <p className="text-xs text-[#A69F91]">
              Tap <strong className="text-[#FCE7A2]">Check In</strong> on today’s card to watch the sponsor banner &amp; collect 100–300 coins.
            </p>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#15120A] border border-[#D4AF37]/35 font-mono-num text-xs font-bold text-[#FCE7A2]">
            <span>{claimedDays.length} / 7 Checked In</span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
          {STREAK_DAYS.map((day) => {
            const isClaimed = claimedDays.includes(day.key);
            const isToday = day.key === todayWeekday;
            const isSunday = day.key === 'Sun';

            return (
              <div
                key={day.key}
                className={`rounded-xl p-3 border flex flex-col justify-between gap-2.5 transition-all ${
                  isSunday ? 'col-span-2 sm:col-span-1' : ''
                } ${
                  isClaimed
                    ? 'bg-emerald-950/30 border-emerald-500/50 shadow-[0_0_16px_rgba(34,197,94,0.12)]'
                    : isToday
                      ? 'bg-gradient-to-b from-[#2A200A] to-[#131008] border-[#FCE7A2] shadow-[0_0_24px_rgba(212,175,55,0.24)]'
                      : 'bg-[#0B0B10] border-white/[0.08] opacity-80'
                }`}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1 min-w-0">
                    <span
                      className={`text-xs font-bold uppercase tracking-wide ${
                        isClaimed
                          ? 'text-emerald-300'
                          : isToday
                            ? 'text-[#FCE7A2]'
                            : 'text-[#C4BDB0]'
                      }`}
                    >
                      {day.key}
                    </span>
                    {isSunday && !isClaimed && (
                      <Crown className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
                    )}
                  </div>

                  {isClaimed ? (
                    <span
                      aria-label={`${day.label} checked in`}
                      className="w-5 h-5 rounded-full bg-emerald-500 text-[#052010] flex items-center justify-center shrink-0 shadow-sm shadow-emerald-500/40"
                    >
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </span>
                  ) : isToday ? (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#181307] gold-gradient-bg px-1.5 py-0.5 rounded">
                      Today
                    </span>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <div className="font-mono-num text-sm font-extrabold text-[#FCE7A2] flex items-center gap-1">
                    <Coins className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
                    <span>+{day.reward}</span>
                  </div>

                  {isClaimed ? (
                    <div className="min-h-[34px] rounded-lg bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 text-[11px] font-bold flex items-center justify-center gap-1">
                      <Check className="w-3.5 h-3.5" />
                      <span>Collected</span>
                    </div>
                  ) : isToday ? (
                    <button
                      type="button"
                      onClick={() => handleOpenCheckInAd(day)}
                      className="w-full min-h-[38px] px-2.5 rounded-lg gold-gradient-bg text-[#181307] text-xs font-extrabold tracking-wide hover:brightness-105 active:scale-[0.97] transition-all shadow-md shadow-[#D4AF37]/25 cursor-pointer"
                    >
                      Check In
                    </button>
                  ) : (
                    <div className="min-h-[34px] rounded-lg bg-[#14141B] border border-white/[0.06] text-[#7A746A] text-[11px] font-medium flex items-center justify-center">
                      {isSunday ? 'Sunday Bonus' : 'Locked'}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Daily Check-In Sponsor Ad Popup (320x50 Banner + 20s Smooth Golden Progress Bar, NO Countdown Numbers) */}
      {adModalDay && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Daily Check-In Sponsor Ad for ${adModalDay.label}`}
          className="fixed inset-0 z-[95] bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-gradient-to-b from-[#1B150A] via-[#100E13] to-[#08080B] border border-[#E5C158]/70 p-5 sm:p-6 text-center space-y-5 shadow-[0_16px_60px_rgba(212,175,55,0.3)] relative">
            <button
              type="button"
              onClick={() => setAdModalDay(null)}
              aria-label="Cancel daily check-in"
              className="absolute top-3.5 right-3.5 min-h-[36px] min-w-[36px] rounded-lg border border-white/[0.12] flex items-center justify-center text-[#A69F91] hover:text-[#F6F2E9]"
            >
              <X className="w-4 h-4" />
            </button>

            {isAdFinished ? (
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/70 text-emerald-300 mx-auto flex items-center justify-center shadow-lg shadow-emerald-500/25">
                <CheckCircle2 className="w-7 h-7 text-emerald-400" />
              </div>
            ) : (
              <div className="w-12 h-12 rounded-2xl gold-gradient-bg text-[#181307] mx-auto flex items-center justify-center shadow-lg shadow-[#D4AF37]/30">
                <Sparkles className="w-6 h-6" />
              </div>
            )}

            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#D4AF37]">
                {adModalDay.label} Check-In Reward
              </p>
              <h3 className="text-xl sm:text-2xl font-display font-bold gold-gradient-text">
                {isAdFinished ? 'Ad Finished! Reward Ready' : 'Sponsored Check-In Break'}
              </h3>
              <p className="text-xs sm:text-sm text-[#DDD4C4]">
                {isAdFinished
                  ? `Tap below to collect your +${adModalDay.reward} Coins and mark ${adModalDay.key} complete.`
                  : `Your +${adModalDay.reward} Coins will unlock as soon as the golden bar finishes filling.`}
              </p>
            </div>

            {/* Dedicated 320x50 Sponsor Ad Banner */}
            <div className="flex justify-center py-1">
              <BannerAd320x50 />
            </div>

            {/* Smooth Animated Golden Progress Bar (NO countdown numbers) */}
            <div className="space-y-3">
              <div
                role="progressbar"
                aria-valuenow={Math.round(adProgressPct)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Check-in sponsor reward progress"
                className="h-3.5 w-full rounded-full bg-[#070709] border border-[#D4AF37]/35 overflow-hidden p-0.5"
              >
                <div
                  className={`h-full rounded-full transition-[width] duration-150 ease-linear ${
                    isAdFinished
                      ? 'bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.6)]'
                      : 'bg-gradient-to-r from-[#A88220] via-[#D4AF37] to-[#FCE7A2] shadow-[0_0_12px_rgba(243,211,122,0.5)]'
                  }`}
                  style={{ width: `${Math.max(3, adProgressPct)}%` }}
                />
              </div>

              {isAdFinished ? (
                <button
                  type="button"
                  disabled={collecting}
                  onClick={() => void handleCollectCoins()}
                  className="w-full min-h-[48px] px-5 rounded-xl gold-gradient-bg text-[#181307] font-extrabold text-sm inline-flex items-center justify-center gap-2 shadow-lg shadow-[#D4AF37]/30 hover:brightness-105 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-60"
                >
                  <Coins className="w-4 h-4" />
                  <span>
                    {collecting ? 'Collecting...' : `Collect +${adModalDay.reward} Coins`}
                  </span>
                </button>
              ) : (
                <p className="text-xs font-medium text-[#E8C96D]">
                  Unlocking +{adModalDay.reward} Coins...
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
