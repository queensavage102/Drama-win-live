import {
  CURATED_DEFAULT_EPISODES,
  DEFAULT_LIVE_TICKER_NAMES,
  DEFAULT_POOL_PRIZE_ZAR,
  DEFAULT_POOL_TARGET_COINS,
  DEFAULT_QUALIFICATION_THRESHOLD,
  DEFAULT_SPONSOR_URL,
  LEGACY_BROKEN_SERIES_NAMES,
  MYSTERY_ENTRY_COST,
  SAST_OFFSET_MS,
  SEEDED_TOURNAMENT_PLAYERS,
  getCurrentWeekKey,
  getMondayStartTimestampSAST,
  getTodayDateKey,
  getYouTubeThumbnailUrl,
  isLegacyBrokenEpisode,
  sanitizeExternalUrl,
  sanitizeMediaUrl,
} from '../constants';
import {
  AppConfig,
  CoinTransaction,
  DramaEpisode,
  LeaderboardPlayer,
  MysteryWinnerRecord,
  PlayerPrivate,
  TransactionCategory,
  WeekDayKey,
} from '../types';
import { BoxOutcome } from '../components/MysteryVaultCard';

const GUEST_PLAYER_KEY = 'dramawin_guest_player_v1';
const GUEST_PRIVATE_KEY = 'dramawin_guest_private_v1';
const GUEST_LEADERBOARD_KEY = 'dramawin_local_leaderboard_v1';
const GUEST_TX_KEY = 'dramawin_local_transactions_v1';
const LOCAL_EPISODES_KEY = 'dramawin_episodes';
const LOCAL_SECTIONS_KEY = 'dramawin_sections_v1';
const LOCAL_CONFIG_KEY = 'dramawin_app_config_v1';
const LOCAL_WINNERS_KEY = 'dramawin_mystery_winners_v1';

export const DEFAULT_LOCAL_APP_CONFIG: AppConfig = {
  sponsorAdUrl: DEFAULT_SPONSOR_URL,
  embeddedAdHtml: '',
  poolPrizeZar: DEFAULT_POOL_PRIZE_ZAR,
  rolloverAmountZar: 0,
  poolWeekKey: getCurrentWeekKey(),
  weekStartTimestamp: getMondayStartTimestampSAST(),
  lastPoolWinnerSummary: '',
  lastWinnerUids: [],
  mysteryWinningBoxes: 0,
  r5WinnerUsername: '',
  nextPickWinsR5: false,
  liveTickerEnabled: true,
  liveTickerNames: DEFAULT_LIVE_TICKER_NAMES,
  poolTargetCoins: DEFAULT_POOL_TARGET_COINS,
  qualificationThreshold: DEFAULT_QUALIFICATION_THRESHOLD,
  episodesSeeded: true,
  isPublic: true,
};

function safeReadJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined' || !window.localStorage) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWriteJson(key: string, value: unknown): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors
  }
}

export function getOrCreateGuestSession(): {
  player: LeaderboardPlayer;
  privateProfile: PlayerPrivate;
} {
  const currentWeek = getCurrentWeekKey();
  const savedPlayer = safeReadJson<LeaderboardPlayer | null>(GUEST_PLAYER_KEY, null);
  const savedPrivate = safeReadJson<PlayerPrivate | null>(GUEST_PRIVATE_KEY, null);

  if (savedPlayer && savedPrivate && savedPlayer.uid === savedPrivate.uid) {
    // Ensure weekly reset check matches current week if week rolled
    const normalizedPrivate: PlayerPrivate = {
      ...savedPrivate,
      claimedDays:
        savedPrivate.weekKey === currentWeek ? savedPrivate.claimedDays || [] : [],
      weekKey: currentWeek,
      openedMysteryBoxesToday:
        savedPrivate.openedMysteryBoxesDate === getTodayDateKey()
          ? savedPrivate.openedMysteryBoxesToday || []
          : [],
      openedMysteryBoxesDate: getTodayDateKey(),
      streakActivityDates: savedPrivate.streakActivityDates || [],
    };
    safeWriteJson(GUEST_PRIVATE_KEY, normalizedPrivate);
    return { player: savedPlayer, privateProfile: normalizedPrivate };
  }

  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  const uid = `guest-${Date.now().toString(36)}-${suffix.toLowerCase()}`;
  const player: LeaderboardPlayer = {
    uid,
    username: `Player_${suffix}`,
    coins: 0,
    weeklyCoins: 0,
    qualified: false,
    streakCount: 0,
    sundayBonusZar: 0,
    isPublic: true,
  };
  const privateProfile: PlayerPrivate = {
    uid,
    contact: 'Instant Play',
    dailyGiftLastClaimed: '',
    weekKey: currentWeek,
    claimedDays: [],
    watchedEpisodeIds: [],
    lastKeepWatchingDate: '',
    lastBannerClaimAt: 0,
    lastActivityDate: '',
    lastMysteryPickDate: '',
    openedMysteryBoxesDate: getTodayDateKey(),
    openedMysteryBoxesToday: [],
    streakActivityDates: [],
  };

  safeWriteJson(GUEST_PLAYER_KEY, player);
  safeWriteJson(GUEST_PRIVATE_KEY, privateProfile);
  upsertLocalLeaderboardPlayer(player);
  return { player, privateProfile };
}

export function loadLocalLeaderboard(currentPlayer: LeaderboardPlayer): LeaderboardPlayer[] {
  const list = safeReadJson<LeaderboardPlayer[]>(GUEST_LEADERBOARD_KEY, []);
  const map = new Map<string, LeaderboardPlayer>();

  // Always seed active tournament players unless already overridden in local storage
  SEEDED_TOURNAMENT_PLAYERS.forEach((seed) => {
    map.set(seed.uid, {
      uid: seed.uid,
      username: seed.username,
      coins: seed.coins,
      weeklyCoins: seed.weeklyCoins,
      qualified: seed.weeklyCoins >= DEFAULT_QUALIFICATION_THRESHOLD,
      streakCount: seed.streakCount,
      sundayBonusZar: 0,
      isPublic: true,
    });
  });

  list.forEach((p) => {
    if (p?.uid) {
      map.set(p.uid, {
        ...p,
        qualified: (p.weeklyCoins || 0) >= DEFAULT_QUALIFICATION_THRESHOLD,
      });
    }
  });
  map.set(currentPlayer.uid, {
    ...currentPlayer,
    qualified: (currentPlayer.weeklyCoins || 0) >= DEFAULT_QUALIFICATION_THRESHOLD,
  });

  const sorted = Array.from(map.values()).sort(
    (a, b) => (b.weeklyCoins || 0) - (a.weeklyCoins || 0)
  );
  safeWriteJson(GUEST_LEADERBOARD_KEY, sorted);
  return sorted;
}

export function updateLocalGuestUsername(
  player: LeaderboardPlayer,
  rawUsername: string
): LeaderboardPlayer {
  const cleaned = rawUsername.trim().slice(0, 32);
  if (cleaned.length < 2) {
    throw new Error('Player name must be at least 2 characters.');
  }
  const updated: LeaderboardPlayer = {
    ...player,
    username: cleaned,
  };
  safeWriteJson(GUEST_PLAYER_KEY, updated);
  upsertLocalLeaderboardPlayer(updated);
  return updated;
}

export function resetLocalPlayerCoins(player: LeaderboardPlayer): {
  player: LeaderboardPlayer;
  leaderboard: LeaderboardPlayer[];
} {
  const updated: LeaderboardPlayer = {
    ...player,
    coins: 0,
    weeklyCoins: 0,
    qualified: false,
  };
  safeWriteJson(GUEST_PLAYER_KEY, updated);
  const leaderboard = upsertLocalLeaderboardPlayer(updated);
  return { player: updated, leaderboard };
}

export function upsertLocalLeaderboardPlayer(player: LeaderboardPlayer): LeaderboardPlayer[] {
  const list = safeReadJson<LeaderboardPlayer[]>(GUEST_LEADERBOARD_KEY, []);
  const map = new Map<string, LeaderboardPlayer>();
  SEEDED_TOURNAMENT_PLAYERS.forEach((seed) => {
    map.set(seed.uid, {
      uid: seed.uid,
      username: seed.username,
      coins: seed.coins,
      weeklyCoins: seed.weeklyCoins,
      qualified: seed.weeklyCoins >= DEFAULT_QUALIFICATION_THRESHOLD,
      streakCount: seed.streakCount,
      sundayBonusZar: 0,
      isPublic: true,
    });
  });
  list.forEach((p) => {
    if (p?.uid) map.set(p.uid, p);
  });
  map.set(player.uid, player);

  const sorted = Array.from(map.values()).sort(
    (a, b) => (b.weeklyCoins || 0) - (a.weeklyCoins || 0)
  );
  safeWriteJson(GUEST_LEADERBOARD_KEY, sorted);
  return sorted;
}

export function loadLocalTransactions(uid: string): CoinTransaction[] {
  const raw = safeReadJson<CoinTransaction[]>(GUEST_TX_KEY, []);
  return raw
    .filter((tx) => tx.uid === uid)
    .sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
}

export function loadLocalAppConfig(): AppConfig {
  const saved = safeReadJson<Partial<AppConfig> | null>(LOCAL_CONFIG_KEY, null);
  const merged: AppConfig = {
    ...DEFAULT_LOCAL_APP_CONFIG,
    ...(saved || {}),
  };
  if (!merged.sponsorAdUrl || !merged.sponsorAdUrl.trim()) {
    merged.sponsorAdUrl = DEFAULT_SPONSOR_URL;
  }
  // Migrate legacy 500 coin threshold caches up to 500,000 coins
  if (!merged.qualificationThreshold || merged.qualificationThreshold < DEFAULT_QUALIFICATION_THRESHOLD) {
    merged.qualificationThreshold = DEFAULT_QUALIFICATION_THRESHOLD;
    safeWriteJson(LOCAL_CONFIG_KEY, merged);
  }
  return merged;
}

export function saveLocalAppConfig(next: AppConfig): AppConfig {
  safeWriteJson(LOCAL_CONFIG_KEY, next);
  return next;
}

export function loadLocalMysteryWinners(): MysteryWinnerRecord[] {
  return safeReadJson<MysteryWinnerRecord[]>(LOCAL_WINNERS_KEY, []);
}

export function loadLocalSections(episodes: DramaEpisode[]): string[] {
  const saved = safeReadJson<string[]>(LOCAL_SECTIONS_KEY, []);
  const activeEpisodeSeries = new Set(
    episodes
      .filter((ep) => !isLegacyBrokenEpisode(ep))
      .map((ep) => ep.series?.trim())
      .filter((s): s is string => Boolean(s))
  );
  const set = new Set<string>();
  saved.forEach((s) => {
    const clean = typeof s === 'string' ? s.trim() : '';
    if (!clean || clean === 'Rang Ngao (แรงเงา) [ENG SUB]') return;
    if (LEGACY_BROKEN_SERIES_NAMES.includes(clean) && !activeEpisodeSeries.has(clean)) return;
    set.add(clean);
  });
  activeEpisodeSeries.forEach((clean) => set.add(clean));
  const result = Array.from(set);
  safeWriteJson(LOCAL_SECTIONS_KEY, result);
  return result;
}

export function saveLocalSection(sectionName: string): string[] {
  const trimmed = sectionName.trim().slice(0, 60);
  if (!trimmed) return safeReadJson<string[]>(LOCAL_SECTIONS_KEY, []);
  const existing = safeReadJson<string[]>(LOCAL_SECTIONS_KEY, []);
  if (!existing.includes(trimmed)) {
    const next = [...existing, trimmed];
    safeWriteJson(LOCAL_SECTIONS_KEY, next);
    return next;
  }
  return existing;
}

export function renameLocalSection(
  oldName: string,
  newName: string
): { sections: string[]; episodes: DramaEpisode[] } {
  const cleanOld = oldName.trim();
  const cleanNew = newName.trim().slice(0, 60);
  const currentEpisodes = loadLocalEpisodes();
  if (!cleanOld || !cleanNew || cleanOld === cleanNew) {
    return { sections: loadLocalSections(currentEpisodes), episodes: currentEpisodes };
  }

  const existingSections = loadLocalSections(currentEpisodes);
  const mappedSections = Array.from(
    new Set(existingSections.map((s) => (s === cleanOld ? cleanNew : s)))
  );
  safeWriteJson(LOCAL_SECTIONS_KEY, mappedSections);

  const updatedEpisodes = currentEpisodes.map((ep) =>
    ep.series === cleanOld ? { ...ep, series: cleanNew } : ep
  );
  saveLocalEpisodes(updatedEpisodes);

  return { sections: mappedSections, episodes: updatedEpisodes };
}

export function deleteLocalSection(
  sectionName: string,
  removeEpisodes = true
): { sections: string[]; episodes: DramaEpisode[] } {
  const currentEpisodes = loadLocalEpisodes();
  const nextEpisodes = removeEpisodes
    ? currentEpisodes.filter((ep) => ep.series !== sectionName)
    : currentEpisodes;
  safeWriteJson(LOCAL_EPISODES_KEY, nextEpisodes);

  const existing = loadLocalSections(currentEpisodes);
  const nextSections = existing.filter((s) => s !== sectionName);
  safeWriteJson(LOCAL_SECTIONS_KEY, nextSections);
  return { sections: nextSections, episodes: nextEpisodes };
}

export function loadLocalEpisodes(): DramaEpisode[] {
  if (typeof window !== 'undefined' && window.localStorage) {
    const rawStr = window.localStorage.getItem(LOCAL_EPISODES_KEY);
    if (rawStr !== null) {
      try {
        const parsed = JSON.parse(rawStr) as unknown;
        if (Array.isArray(parsed)) {
          const cleaned = (parsed as DramaEpisode[])
            .filter((ep) => !isLegacyBrokenEpisode(ep))
            .map((ep) => ({
              ...ep,
              coverImage: ep.coverImage === 'none' ? '' : ep.coverImage,
              thumbnailUrl: ep.thumbnailUrl === 'none' ? '' : ep.thumbnailUrl,
            }))
            .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
          if (cleaned.length !== parsed.length) {
            safeWriteJson(LOCAL_EPISODES_KEY, cleaned);
          }
          return cleaned;
        }
      } catch {
        // Fall through to empty initial list if corrupted
      }
    }
  }
  safeWriteJson(LOCAL_EPISODES_KEY, CURATED_DEFAULT_EPISODES);
  return CURATED_DEFAULT_EPISODES;
}

export function saveLocalEpisodes(episodes: DramaEpisode[]): DramaEpisode[] {
  const sorted = [...episodes].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  safeWriteJson(LOCAL_EPISODES_KEY, sorted);
  return sorted;
}

export function reorderLocalSeries(orderedSeriesNames: string[]): {
  sections: string[];
  episodes: DramaEpisode[];
} {
  const cleanSections = Array.from(
    new Set(orderedSeriesNames.map((s) => s.trim()).filter(Boolean))
  );
  safeWriteJson(LOCAL_SECTIONS_KEY, cleanSections);

  const currentEpisodes = loadLocalEpisodes();
  const orderMap = new Map<string, number>();
  cleanSections.forEach((name, idx) => orderMap.set(name, idx));

  const reordered = [...currentEpisodes]
    .sort((a, b) => {
      const idxA = orderMap.get(a.series?.trim() || '') ?? 9999;
      const idxB = orderMap.get(b.series?.trim() || '') ?? 9999;
      if (idxA !== idxB) return idxA - idxB;
      return (a.sortOrder || 0) - (b.sortOrder || 0);
    })
    .map((ep, idx) => ({
      ...ep,
      sortOrder: idx + 1,
    }));

  safeWriteJson(LOCAL_EPISODES_KEY, reordered);
  return { sections: cleanSections, episodes: reordered };
}

export function resolveEpisodeCover(ep: {
  coverImage?: string;
  thumbnailUrl?: string;
  youtubeUrl?: string;
  videoUrl?: string;
}): string {
  const rawCover = (ep.thumbnailUrl || ep.coverImage || '').trim();
  const explicitCover = sanitizeMediaUrl(rawCover);
  if (explicitCover) return explicitCover;
  const mediaLink = (ep.videoUrl || ep.youtubeUrl || '').trim();
  const ytThumb = mediaLink ? getYouTubeThumbnailUrl(mediaLink) : null;
  return ytThumb || '';
}

export function addLocalEpisode(input: {
  id?: string;
  title: string;
  series: string;
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
}): DramaEpisode[] {
  const current = loadLocalEpisodes();
  const id = input.id?.trim() || `ep-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const rawVideo = (input.videoUrl || input.youtubeUrl || '').trim();
  const cleanVideo = rawVideo
    ? sanitizeMediaUrl(rawVideo).slice(0, rawVideo.startsWith('data:') ? 2000000 : 500)
    : '';
  const explicitCover = sanitizeMediaUrl(input.thumbnailUrl || input.coverImage || '');
  const autoThumb = cleanVideo ? getYouTubeThumbnailUrl(cleanVideo) : null;
  const finalCover = explicitCover || autoThumb || '';

  const created: DramaEpisode = {
    id,
    title: input.title.trim().slice(0, 100),
    series: input.series.trim().slice(0, 60),
    episodeLabel: input.episodeLabel.trim().slice(0, 24) || 'EP 01',
    duration: input.duration.trim().slice(0, 20) || 'Watch 30s+',
    rewardCoins: Math.max(1, Math.min(5000, Math.round(input.rewardCoins || 100))),
    coverImage: finalCover,
    thumbnailUrl: finalCover,
    synopsis: input.synopsis.trim().slice(0, 240) || `${input.series.trim()} episode.`,
    sponsorUrl: input.sponsorUrl.trim() ? sanitizeExternalUrl(input.sponsorUrl).slice(0, 500) : '',
    youtubeUrl: cleanVideo,
    videoUrl: cleanVideo,
    sortOrder: Math.max(0, Math.round(input.sortOrder || current.length + 1)),
    isPublic: true,
  };

  saveLocalSection(created.series);
  return saveLocalEpisodes([...current, created]);
}

export function updateLocalEpisode(
  episodeId: string,
  input: {
    title: string;
    series: string;
    episodeLabel: string;
    duration: string;
    rewardCoins: number;
    coverImage: string;
    thumbnailUrl?: string;
    synopsis: string;
    sponsorUrl: string;
    youtubeUrl?: string;
    videoUrl?: string;
  }
): DramaEpisode[] {
  const current = loadLocalEpisodes();
  const rawVideo = (input.videoUrl || input.youtubeUrl || '').trim();
  const cleanVideo = rawVideo
    ? sanitizeMediaUrl(rawVideo).slice(0, rawVideo.startsWith('data:') ? 2000000 : 500)
    : '';
  const explicitCover = sanitizeMediaUrl(input.thumbnailUrl || input.coverImage || '');
  const autoThumb = cleanVideo ? getYouTubeThumbnailUrl(cleanVideo) : null;
  const finalCover = explicitCover || autoThumb || '';

  const next = current.map((ep) => {
    if (ep.id !== episodeId) return ep;
    return {
      ...ep,
      title: input.title.trim().slice(0, 100),
      series: input.series.trim().slice(0, 60),
      episodeLabel: input.episodeLabel.trim().slice(0, 24) || ep.episodeLabel,
      duration: input.duration.trim().slice(0, 20) || ep.duration,
      rewardCoins: Math.max(1, Math.min(5000, Math.round(input.rewardCoins || ep.rewardCoins))),
      coverImage: finalCover,
      thumbnailUrl: finalCover,
      synopsis: input.synopsis.trim().slice(0, 240) || ep.synopsis,
      sponsorUrl: input.sponsorUrl.trim() ? sanitizeExternalUrl(input.sponsorUrl).slice(0, 500) : '',
      youtubeUrl: cleanVideo,
      videoUrl: cleanVideo,
    };
  });

  saveLocalSection(input.series);
  return saveLocalEpisodes(next);
}

export function deleteLocalEpisode(episodeId: string): DramaEpisode[] {
  const current = loadLocalEpisodes();
  const next = current.filter((ep) => ep.id !== episodeId);
  safeWriteJson(LOCAL_EPISODES_KEY, next);
  return next;
}

export function applyLocalCoinMutation(params: {
  player: LeaderboardPlayer;
  privateProfile: PlayerPrivate;
  walletDelta: number;
  qualificationThreshold: number;
  privateUpdates?: Partial<PlayerPrivate>;
  nextStreakCount?: number;
  txMeta?: {
    category: TransactionCategory;
    title: string;
  };
  recordStreakActivity?: boolean;
}): {
  player: LeaderboardPlayer;
  privateProfile: PlayerPrivate;
  transactions: CoinTransaction[];
} {
  const {
    player,
    privateProfile,
    walletDelta,
    qualificationThreshold,
    privateUpdates = {},
    nextStreakCount,
    txMeta,
    recordStreakActivity,
  } = params;

  const today = getTodayDateKey();
  const roundedDelta = Math.round(walletDelta);
  const newCoins = Math.max(0, player.coins + roundedDelta);
  const weeklyGain = Math.max(0, roundedDelta);
  const newWeekly = player.weeklyCoins + weeklyGain;
  const qualified = newWeekly >= qualificationThreshold;
  const streakCount =
    typeof nextStreakCount === 'number'
      ? Math.max(0, Math.min(7, nextStreakCount))
      : player.streakCount;

  const updatedPlayer: LeaderboardPlayer = {
    ...player,
    coins: newCoins,
    weeklyCoins: newWeekly,
    qualified,
    streakCount,
  };

  const existingDates = new Set(privateProfile.streakActivityDates || []);
  if (recordStreakActivity) {
    existingDates.add(today);
  }

  const updatedPrivate: PlayerPrivate = {
    ...privateProfile,
    ...privateUpdates,
    lastActivityDate: today,
    streakActivityDates: Array.from(existingDates).slice(-30),
  };

  safeWriteJson(GUEST_PLAYER_KEY, updatedPlayer);
  safeWriteJson(GUEST_PRIVATE_KEY, updatedPrivate);
  upsertLocalLeaderboardPlayer(updatedPlayer);

  const allTx = safeReadJson<CoinTransaction[]>(GUEST_TX_KEY, []);
  if (txMeta) {
    const newTx: CoinTransaction = {
      id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      uid: player.uid,
      type: roundedDelta < 0 ? 'spend' : 'earn',
      category: txMeta.category,
      title: txMeta.title,
      amount: roundedDelta,
      balanceAfter: newCoins,
      createdAtMs: Date.now(),
    };
    allTx.unshift(newTx);
    safeWriteJson(GUEST_TX_KEY, allTx.slice(0, 250));
  }

  return {
    player: updatedPlayer,
    privateProfile: updatedPrivate,
    transactions: allTx.filter((t) => t.uid === player.uid),
  };
}

export function claimLocalMysteryBox(params: {
  player: LeaderboardPlayer;
  privateProfile: PlayerPrivate;
  boxNumber: number;
  paidWithCoins: boolean;
  appConfig: AppConfig;
}): {
  outcome: BoxOutcome;
  player: LeaderboardPlayer;
  privateProfile: PlayerPrivate;
  transactions: CoinTransaction[];
  appConfig: AppConfig;
  winnerRecord?: MysteryWinnerRecord;
  newPoolPrizeZar?: number;
} {
  const { player, privateProfile, boxNumber, paidWithCoins, appConfig } = params;
  const todayKey = getTodayDateKey();
  const openedToday =
    privateProfile.openedMysteryBoxesDate === todayKey
      ? privateProfile.openedMysteryBoxesToday || []
      : [];

  if (openedToday.includes(boxNumber)) {
    throw new Error(`You already opened Box #${boxNumber} today. Try another box!`);
  }
  if (paidWithCoins && player.coins < MYSTERY_ENTRY_COST) {
    throw new Error(`You need at least ${MYSTERY_ENTRY_COST} Coins to unlock.`);
  }

  const targetUsername = (appConfig.r5WinnerUsername || '').trim().toLowerCase();
  const isNamedWinner =
    targetUsername.length > 0 &&
    player.username.trim().toLowerCase() === targetUsername;
  const isR5Winner = Boolean(appConfig.nextPickWinsR5) || isNamedWinner;

  const coinRewards = [25, 50, 75, 100];
  const chosen: BoxOutcome = isR5Winner
    ? { boxNumber, kind: 'airtime', coins: 0 }
    : {
        boxNumber,
        kind: 'coins',
        coins: coinRewards[Math.floor(Math.random() * coinRewards.length)],
      };

  const entryCost = paidWithCoins ? MYSTERY_ENTRY_COST : 0;
  const walletDelta = chosen.coins - entryCost;
  const nextOpened = [...openedToday, boxNumber];

  let winnerRecord: MysteryWinnerRecord | undefined;
  let newPoolPrizeZar: number | undefined;
  let nextConfig = appConfig;

  if (chosen.kind === 'airtime') {
    const voucherCode = `DW-R5-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    chosen.voucherCode = voucherCode;
    newPoolPrizeZar = (appConfig.poolPrizeZar || DEFAULT_POOL_PRIZE_ZAR) + 5;
    nextConfig = saveLocalAppConfig({
      ...appConfig,
      poolPrizeZar: newPoolPrizeZar,
      r5WinnerUsername: '',
      nextPickWinsR5: false,
    });
    winnerRecord = {
      id: `win-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      uid: player.uid,
      username: player.username,
      contact: privateProfile.contact,
      voucherCode,
      amountZar: 5,
      boxNumber,
      createdAtMs: Date.now(),
    };
    const winners = loadLocalMysteryWinners();
    safeWriteJson(LOCAL_WINNERS_KEY, [winnerRecord, ...winners].slice(0, 100));
  }

  const mutation = applyLocalCoinMutation({
    player,
    privateProfile,
    walletDelta,
    qualificationThreshold: appConfig.qualificationThreshold || DEFAULT_QUALIFICATION_THRESHOLD,
    privateUpdates: {
      openedMysteryBoxesDate: todayKey,
      openedMysteryBoxesToday: nextOpened,
      lastMysteryPickDate: nextOpened.length >= 12 ? todayKey : '',
    },
    txMeta: {
      category: 'mystery-box',
      title:
        chosen.kind === 'airtime'
          ? `Mystery Box #${boxNumber} — R5 Airtime Win`
          : `Mystery Box #${boxNumber} Bonus`,
    },
  });

  return {
    outcome: chosen,
    player: mutation.player,
    privateProfile: mutation.privateProfile,
    transactions: mutation.transactions,
    appConfig: nextConfig,
    winnerRecord,
    newPoolPrizeZar,
  };
}

export function getLast7DaysDateKeysSAST(now = new Date()): {
  dateKey: string;
  weekdayLabel: string;
  shortDate: string;
  isToday: boolean;
}[] {
  const result: {
    dateKey: string;
    weekdayLabel: string;
    shortDate: string;
    isToday: boolean;
  }[] = [];
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  for (let offset = 6; offset >= 0; offset--) {
    const d = new Date(now.getTime() - offset * 86400000 + SAST_OFFSET_MS);
    const year = d.getUTCFullYear();
    const monthIdx = d.getUTCMonth();
    const dayNum = d.getUTCDate();
    const dateKey = `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    result.push({
      dateKey,
      weekdayLabel: offset === 0 ? 'Today' : weekdays[d.getUTCDay()],
      shortDate: `${months[monthIdx]} ${dayNum}`,
      isToday: offset === 0,
    });
  }
  return result;
}
