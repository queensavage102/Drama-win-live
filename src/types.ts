import { Timestamp } from 'firebase/firestore';

export type AppTab = 'watch' | 'vault' | 'leaderboard' | 'me';

export type WeekDayKey = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

export interface StreakDaySpec {
  key: WeekDayKey;
  label: string;
  reward: number;
}

export interface LeaderboardPlayer {
  uid: string;
  username: string;
  coins: number;
  weeklyCoins: number;
  qualified: boolean;
  streakCount: number;
  sundayBonusZar?: number;
  isPublic: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface PlayerPrivate {
  uid: string;
  contact: string;
  dailyGiftLastClaimed: string;
  weekKey: string;
  claimedDays: WeekDayKey[];
  watchedEpisodeIds: string[];
  lastKeepWatchingDate: string;
  lastBannerClaimAt: number;
  lastActivityDate?: string;
  lastMysteryPickDate?: string;
  openedMysteryBoxesDate?: string;
  openedMysteryBoxesToday?: number[];
  streakActivityDates?: string[];
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface DramaEpisode {
  id: string;
  title: string;
  series: string;
  seriesId?: string;
  category?: string;
  episodeLabel: string;
  duration: string;
  rewardCoins: number;
  coverImage: string;
  thumbnailUrl?: string;
  synopsis: string;
  sponsorUrl: string;
  youtubeUrl?: string;
  videoUrl?: string;
  sortOrder: number;
  isPublic: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface AppConfig {
  sponsorAdUrl: string;
  embeddedAdHtml?: string;
  poolPrizeZar: number;
  rolloverAmountZar?: number;
  poolWeekKey?: string;
  weekStartTimestamp?: number;
  lastPoolWinnerSummary?: string;
  lastWinnerUids?: string[];
  mysteryWinningBoxes?: number;
  r5WinnerUsername?: string;
  nextPickWinsR5?: boolean;
  liveTickerEnabled?: boolean;
  liveTickerNames?: string[];
  poolTargetCoins: number;
  qualificationThreshold: number;
  episodesSeeded: boolean;
  isPublic: boolean;
  updatedAt?: Timestamp;
}

export interface MysteryWinnerRecord {
  id: string;
  uid: string;
  username: string;
  contact: string;
  voucherCode: string;
  amountZar: number;
  boxNumber: number;
  createdAt?: Timestamp;
  createdAtMs?: number;
}

export type TransactionType = 'earn' | 'spend' | 'adjustment';

export type TransactionCategory =
  | 'daily-gift'
  | 'streak'
  | 'episode'
  | 'ad-break'
  | 'keep-watching'
  | 'banner'
  | 'mystery-box'
  | 'mystery-entry'
  | 'admin-adjustment';

export interface CoinTransaction {
  id: string;
  uid: string;
  type: TransactionType;
  category: TransactionCategory | string;
  title: string;
  amount: number;
  balanceAfter: number;
  createdAt?: Timestamp;
  createdAtMs?: number;
}

export interface ToastNotice {
  id: string;
  message: string;
  coinsAwarded?: number;
  tone?: 'gold' | 'neutral' | 'error' | 'reminder';
  actionLabel?: string;
  onAction?: () => void;
}
