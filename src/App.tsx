import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { User, onAuthStateChanged, signInWithPopup } from 'firebase/auth';
import { AlertTriangle, Crown, Flame, X } from 'lucide-react';
import { AdminBoardPage, AdminEpisodeFormInput } from './components/AdminBoardPage';
import { BottomNavBar } from './components/BottomNavBar';
import { CheckInVaultTab } from './components/CheckInVaultTab';
import { ConfettiExplosion } from './components/ConfettiExplosion';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ForYouTab } from './components/ForYouTab';
import { MeTab } from './components/MeTab';
import { MysteryRevealState, MysteryVaultCard } from './components/MysteryVaultCard';
import { RealisticGoldCoin } from './components/RealisticGoldCoin';
import { TopHeader } from './components/TopHeader';
import { VipSplashScreen } from './components/VipSplashScreen';
import { WatchTab } from './components/WatchTab';
import {
  ADMIN_PASSCODE,
  BRAND_NAME,
  DEFAULT_POOL_PRIZE_ZAR,
  DEFAULT_QUALIFICATION_THRESHOLD,
  DEFAULT_SPONSOR_URL,
  STREAK_DAYS,
  deduplicateEpisodeList,
  forceSaveDefaultEpisodesToLocalStorage,
  getCanonicalVideoKey,
  getCurrentWeekKey,
  getEpisodeSeriesId,
  getMondayStartTimestampSAST,
  getTodayDateKey,
  getTodayWeekdayKey,
  inferEpisodeCategory,
  isLegacyBrokenEpisode,
  sanitizeExternalUrl,
  syncLocalStorageCatalogMigration,
  toSeriesId,
} from './constants';
import { auth, googleProvider } from './firebase';
import {
  addDramaEpisode,
  adminAdjustPlayerCoins,
  awardHeroBonusCoins,
  awardMysteryBoxCoins,
  awardWatchPotCoins,
  claimStreakDay,
  deleteDramaEpisode,
  deleteDramaSeriesFromFirestore,
  evaluateSundayPoolRollover,
  fetchPlayerProfile,
  markEpisodeAsWatched,
  mergeWatchedEpisodeId,
  purgeLegacyAndStrayEpisodesFromFirestore,
  reorderDramaEpisodes,
  resetPlayerCoinsToZero,
  restoreDefaultEpisodes,
  subscribeAppConfig,
  subscribeEpisodes,
  subscribeLeaderboard,
  subscribeMysteryWinners,
  subscribePlayerPrivate,
  subscribeSeries,
  subscribeTransactions,
  unlockAdminAccess,
  updateDramaEpisode,
  updateEmbeddedAdHtml,
  updateLiveTickerConfig,
  updateMysteryAndRolloverConfig,
  updateSponsorAdUrl,
  upsertDramaSeries,
} from './services/dramawinService';
import {
  AppConfig,
  AppTab,
  CoinTransaction,
  DramaEpisode,
  DramaSeries,
  LeaderboardPlayer,
  MysteryWinnerRecord,
  PlayerPrivate,
  ToastNotice,
  WeekDayKey,
} from './types';
import {
  addLocalEpisode,
  applyLocalCoinMutation,
  claimLocalMysteryBox,
  deleteLocalEpisode,
  deleteLocalSection,
  getOrCreateGuestSession,
  isEpisodeDeleted,
  loadDeletedIds,
  loadLocalAppConfig,
  loadLocalEpisodes,
  loadLocalLeaderboard,
  loadLocalMysteryWinners,
  loadLocalSections,
  loadLocalTransactions,
  loadMyListSeriesIds,
  mergeLeaderboardWithSeedPlayers,
  recordDeletedIds,
  removeDeletedSeriesMarker,
  renameLocalSection,
  reorderLocalSeries,
  resetLocalMysteryBoxes,
  resetLocalPlayerCoins,
  saveLocalAppConfig,
  saveLocalEpisodes,
  saveLocalSection,
  toggleMyListSeriesId,
  updateLocalEpisode,
  updateLocalGuestUsername,
  upsertLocalLeaderboardPlayer,
} from './utils/localState';
import {
  isSoundMuted,
  playCoinChime,
  playCoinPotCashChime,
  playVictoryFanfare,
  setSoundMuted,
  unlockAudioEngine,
} from './utils/sound';

const ADMIN_SESSION_KEY = 'dramawin_admin_unlocked';
const CLOUD_OPENED_BOXES_PREFIX = 'dramawin_cloud_opened_boxes_';

function readCloudOpenedBoxes(uid: string, dateKey: string): number[] {
  try {
    const raw = window.localStorage.getItem(`${CLOUD_OPENED_BOXES_PREFIX}${uid}_${dateKey}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((n): n is number => typeof n === 'number') : [];
  } catch {
    return [];
  }
}

function writeCloudOpenedBoxes(uid: string, dateKey: string, boxes: number[]): void {
  try {
    window.localStorage.setItem(`${CLOUD_OPENED_BOXES_PREFIX}${uid}_${dateKey}`, JSON.stringify(boxes));
  } catch {
    // Ignore storage quota errors
  }
}

function isAdminPath(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.pathname.replace(/\/+$/, '') === '/admin';
}

function DramaWinApp() {
  const initialSession = useMemo(() => {
    syncLocalStorageCatalogMigration();
    return getOrCreateGuestSession();
  }, []);
  const initialEpisodes = useMemo(() => loadLocalEpisodes(), []);

  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [guestPlayer, setGuestPlayer] = useState<LeaderboardPlayer>(initialSession.player);
  const [guestPrivate, setGuestPrivate] = useState<PlayerPrivate>(initialSession.privateProfile);

  const [cloudPrivateProfile, setCloudPrivateProfile] = useState<PlayerPrivate | null>(null);
  const [cloudLeaderboard, setCloudLeaderboard] = useState<LeaderboardPlayer[]>([]);
  const [cloudEpisodes, setCloudEpisodes] = useState<DramaEpisode[]>([]);
  const [cloudSeries, setCloudSeries] = useState<DramaSeries[]>([]);
  const [cloudEpisodesLoaded, setCloudEpisodesLoaded] = useState<boolean>(false);
  const [cloudSeriesLoaded, setCloudSeriesLoaded] = useState<boolean>(false);
  const [cloudAppConfig, setCloudAppConfig] = useState<AppConfig | null>(null);
  const [cloudWinners, setCloudWinners] = useState<MysteryWinnerRecord[]>([]);
  const [cloudTransactions, setCloudTransactions] = useState<CoinTransaction[]>([]);

  const [localLeaderboard, setLocalLeaderboard] = useState<LeaderboardPlayer[]>(() =>
    loadLocalLeaderboard(initialSession.player)
  );
  const [localEpisodes, setLocalEpisodes] = useState<DramaEpisode[]>(initialEpisodes);
  const [localSections, setLocalSections] = useState<string[]>(() => loadLocalSections(initialEpisodes));
  const [localAppConfig, setLocalAppConfig] = useState<AppConfig>(() => loadLocalAppConfig());
  const [localWinners, setLocalWinners] = useState<MysteryWinnerRecord[]>(() =>
    loadLocalMysteryWinners()
  );
  const [localTransactions, setLocalTransactions] = useState<CoinTransaction[]>(() =>
    loadLocalTransactions(initialSession.player.uid)
  );

  const [isAdminRoute, setIsAdminRoute] = useState<boolean>(() => isAdminPath());
  const [adminUnlocked, setAdminUnlocked] = useState<boolean>(() => {
    try {
      return window.sessionStorage.getItem(ADMIN_SESSION_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const [activeTab, setActiveTab] = useState<AppTab>('watch');
  const [giftVaultModalOpen, setGiftVaultModalOpen] = useState(false);
  const [myListSeriesIds, setMyListSeriesIds] = useState<string[]>(() => loadMyListSeriesIds());
  const [deletedIds, setDeletedIds] = useState<string[]>(() => loadDeletedIds());
  const [toast, setToast] = useState<ToastNotice | null>(null);
  const [cloudOpenedBoxes, setCloudOpenedBoxes] = useState<number[]>([]);
  const [mysteryReveal, setMysteryReveal] = useState<MysteryRevealState | null>(null);
  const [mysteryVoucherModal, setMysteryVoucherModal] = useState<{
    winner: MysteryWinnerRecord;
    newPoolPrizeZar?: number;
  } | null>(null);

  const [muted, setMuted] = useState<boolean>(() => isSoundMuted());
  const [confettiActive, setConfettiActive] = useState(false);
  const [splashDone, setSplashDone] = useState<boolean>(() => isAdminPath());

  const streakReminderShownRef = useRef<string | null>(null);
  const purgedStrayFirestoreRef = useRef<boolean>(false);
  const prevCloudEpisodesCountRef = useRef<number>(0);
  const mysteryResetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (mysteryResetTimerRef.current !== null) {
        window.clearTimeout(mysteryResetTimerRef.current);
      }
    };
  }, []);

  // Use cloud session only if user is signed into Firebase Auth AND has a cloud profile;
  // otherwise run 100% seamlessly in instant localStorage mode with zero auth wall.
  const isCloudMode = Boolean(firebaseUser && cloudPrivateProfile);

  const currentPlayer: LeaderboardPlayer = useMemo(() => {
    if (isCloudMode && firebaseUser) {
      return (
        cloudLeaderboard.find((p) => p.uid === firebaseUser.uid) || {
          uid: firebaseUser.uid,
          username: 'Player',
          coins: 0,
          weeklyCoins: 0,
          qualified: false,
          streakCount: cloudPrivateProfile?.claimedDays?.length || 0,
          isPublic: true,
        }
      );
    }
    return guestPlayer;
  }, [isCloudMode, firebaseUser, cloudLeaderboard, cloudPrivateProfile, guestPlayer]);

  const privateProfile: PlayerPrivate = useMemo(
    () => (isCloudMode && cloudPrivateProfile ? cloudPrivateProfile : guestPrivate),
    [isCloudMode, cloudPrivateProfile, guestPrivate]
  );

  const leaderboard: LeaderboardPlayer[] = useMemo(
    () =>
      mergeLeaderboardWithSeedPlayers(
        isCloudMode ? cloudLeaderboard : localLeaderboard,
        currentPlayer
      ),
    [isCloudMode, cloudLeaderboard, localLeaderboard, currentPlayer]
  );

  const deletedIdSet = useMemo(() => new Set(deletedIds), [deletedIds]);

  const episodes: DramaEpisode[] = useMemo(() => {
    const rawBase = cloudEpisodesLoaded
      ? firebaseUser
        ? cloudEpisodes
        : [...cloudEpisodes, ...localEpisodes]
      : localEpisodes;
    return deduplicateEpisodeList(
      rawBase.filter(
        (ep) => !isLegacyBrokenEpisode(ep) && !isEpisodeDeleted(ep, deletedIdSet)
      )
    ).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }, [cloudEpisodesLoaded, firebaseUser, cloudEpisodes, localEpisodes, deletedIdSet]);

  const sections: string[] = useMemo(() => {
    const map = new Map<string, string>();
    const register = (raw: string) => {
      const clean = raw.trim().replace(/\s+/g, ' ');
      if (!clean || /gojo|jujutsu|jjk|candy\s*man/i.test(clean)) return;
      const sId = toSeriesId(clean);
      if (deletedIdSet.has(sId)) return;
      if (!map.has(sId)) map.set(sId, clean);
    };

    if (cloudSeriesLoaded || cloudEpisodesLoaded) {
      cloudSeries.forEach((s) => register(s.title));
      episodes.forEach((ep) => register(ep.series));
      if (!firebaseUser) {
        localSections.forEach(register);
      }
    } else {
      localSections.forEach(register);
      episodes.forEach((ep) => register(ep.series));
    }
    return Array.from(map.values());
  }, [
    cloudSeriesLoaded,
    cloudEpisodesLoaded,
    cloudSeries,
    episodes,
    localSections,
    deletedIdSet,
    firebaseUser,
  ]);

  const appConfig: AppConfig = useMemo(() => {
    const base = cloudAppConfig ? cloudAppConfig : localAppConfig;
    return {
      ...base,
      sponsorAdUrl: DEFAULT_SPONSOR_URL,
    };
  }, [cloudAppConfig, localAppConfig]);

  const mysteryWinners: MysteryWinnerRecord[] = useMemo(
    () => (isCloudMode ? cloudWinners : localWinners),
    [isCloudMode, cloudWinners, localWinners]
  );

  const transactions: CoinTransaction[] = useMemo(
    () => (isCloudMode ? cloudTransactions : localTransactions),
    [isCloudMode, cloudTransactions, localTransactions]
  );

  const latestStateRef = useRef({
    isCloudMode,
    currentPlayer,
    privateProfile,
    appConfig,
    muted,
  });

  useEffect(() => {
    latestStateRef.current = {
      isCloudMode,
      currentPlayer,
      privateProfile,
      appConfig,
      muted,
    };
  }, [isCloudMode, currentPlayer, privateProfile, appConfig, muted]);

  // Unlock Web Audio engine on first user gesture
  useEffect(() => {
    const unlock = () => {
      unlockAudioEngine();
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  // Listen to browser history popstate for /admin routing
  useEffect(() => {
    const handlePop = () => {
      setIsAdminRoute(isAdminPath());
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  const navigateToAdmin = () => {
    if (typeof window !== 'undefined' && !isAdminPath()) {
      window.history.pushState({}, '', '/admin');
    }
    setIsAdminRoute(true);
  };

  const navigateToApp = () => {
    if (typeof window !== 'undefined' && isAdminPath()) {
      window.history.pushState({}, '', '/');
    }
    setIsAdminRoute(false);
  };

  const showToast = useCallback(
    (
      message: string,
      coinsAwarded?: number,
      tone: ToastNotice['tone'] = 'gold',
      action?: { label: string; onClick: () => void },
      durationMs = 4500
    ) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToast({
        id,
        message,
        coinsAwarded,
        tone,
        actionLabel: action?.label,
        onAction: action?.onClick,
      });
      window.setTimeout(() => {
        setToast((current) => (current?.id === id ? null : current));
      }, durationMs);
    },
    []
  );

  const handleToggleMute = () => {
    const next = !muted;
    setMuted(next);
    setSoundMuted(next);
  };

  // Always subscribe to public Firestore appConfig, series, and episodes for ALL visitors (zero auth wall)
  useEffect(() => {
    const unsubConfig = subscribeAppConfig(
      (cfg) => {
        const normalized: AppConfig = {
          ...cfg,
          sponsorAdUrl: DEFAULT_SPONSOR_URL,
        };
        setCloudAppConfig(normalized);
        setLocalAppConfig(saveLocalAppConfig(normalized));
      },
      () => {
        // Keep local fallback active if Firestore is unreachable
      }
    );

    const unsubSeries = subscribeSeries(
      (seriesList) => {
        const currentDeleted = new Set(loadDeletedIds());
        const cleanSeries = seriesList.filter(
          (s) =>
            !currentDeleted.has(s.seriesId) &&
            !currentDeleted.has(s.id) &&
            !/gojo|jujutsu|jjk|candy\s*man/i.test(`${s.seriesId} ${s.title}`)
        );
        setCloudSeriesLoaded(true);
        setCloudSeries(cleanSeries);
      },
      () => {
        // Keep local fallback active if Firestore is unreachable
      }
    );

    const unsubEpisodes = subscribeEpisodes(
      (items) => {
        const currentDeleted = new Set(loadDeletedIds());
        const clean = deduplicateEpisodeList(
          items.filter(
            (ep) => !isLegacyBrokenEpisode(ep) && !isEpisodeDeleted(ep, currentDeleted)
          )
        );
        setCloudEpisodesLoaded(true);
        setCloudEpisodes(clean);
        prevCloudEpisodesCountRef.current = clean.length;
        const synced = saveLocalEpisodes(clean);
        setLocalEpisodes(synced);
        setLocalSections(loadLocalSections(synced));
      },
      () => {
        // Keep local fallback active if Firestore is unreachable
      }
    );

    return () => {
      unsubConfig();
      unsubSeries();
      unsubEpisodes();
    };
  }, []);

  // Optional background Firebase auth listener for authenticated players & admin sync
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (!user) {
        setCloudPrivateProfile(null);
        setCloudLeaderboard([]);
        setCloudWinners([]);
        setCloudTransactions([]);
        setCloudOpenedBoxes([]);
        return;
      }
      setCloudOpenedBoxes(readCloudOpenedBoxes(user.uid, getTodayDateKey()));
      try {
        const { privateProfile: loadedPrivate } = await fetchPlayerProfile(user.uid);
        setCloudPrivateProfile(loadedPrivate);
      } catch {
        setCloudPrivateProfile(null);
      }
    });
    return () => unsub();
  }, []);

  // Automatically purge stray Gojo/anime or legacy broken episode docs from Firestore once an admin is signed in
  useEffect(() => {
    if (!firebaseUser || purgedStrayFirestoreRef.current) return;
    const isOwnerOrAdmin =
      firebaseUser.email === 'gerinaicker04@gmail.com' || adminUnlocked;
    if (!isOwnerOrAdmin) return;
    purgedStrayFirestoreRef.current = true;
    void purgeLegacyAndStrayEpisodesFromFirestore();
  }, [firebaseUser, adminUnlocked]);

  useEffect(() => {
    if (!firebaseUser) return;
    const unsubWinners = adminUnlocked
      ? subscribeMysteryWinners(setCloudWinners, () => {})
      : () => {};
    if (!cloudPrivateProfile) {
      return () => {
        unsubWinners();
      };
    }

    const unsubLeaderboard = subscribeLeaderboard(setCloudLeaderboard);
    const unsubPrivate = subscribePlayerPrivate(firebaseUser.uid, (nextPriv) => {
      if (nextPriv) setCloudPrivateProfile(nextPriv);
    });
    const unsubTransactions = subscribeTransactions(firebaseUser.uid, setCloudTransactions);

    return () => {
      unsubLeaderboard();
      unsubPrivate();
      unsubTransactions();
      unsubWinners();
    };
  }, [firebaseUser, cloudPrivateProfile?.uid, adminUnlocked]);

  // Subtle Daily Streak Reminder once per day on first visit if today's check-in is open
  useEffect(() => {
    if (isAdminRoute) return;
    const uid = currentPlayer.uid;
    const todayKey = getTodayDateKey();
    const currentWeek = getCurrentWeekKey();
    const todayWeekday = getTodayWeekdayKey();
    const claimedDays =
      privateProfile.weekKey === currentWeek ? privateProfile.claimedDays || [] : [];

    if (claimedDays.includes(todayWeekday)) {
      setToast((current) => (current?.tone === 'reminder' ? null : current));
      return;
    }

    const sessionStamp = `${uid}:${todayKey}`;
    if (streakReminderShownRef.current === sessionStamp) return;

    try {
      if (window.localStorage.getItem(`dramawin_streak_reminder_${uid}`) === todayKey) {
        streakReminderShownRef.current = sessionStamp;
        return;
      }
    } catch {
      // Ignore storage errors
    }

    const timer = window.setTimeout(() => {
      streakReminderShownRef.current = sessionStamp;
      try {
        window.localStorage.setItem(`dramawin_streak_reminder_${uid}`, todayKey);
      } catch {
        // Ignore storage errors
      }
      const todaySpec = STREAK_DAYS.find((d) => d.key === todayWeekday);
      const reward = todaySpec?.reward ?? 100;
      showToast(
        `Daily Streak Reminder: Claim ${todayWeekday} (+${reward} Coins) to keep your streak going.`,
        undefined,
        'reminder',
        {
          label: 'Check In',
          onClick: () => {
            setActiveTab('vault');
            window.setTimeout(() => {
              document.getElementById('daily-checkin-box')?.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
              });
            }, 80);
          },
        },
        5000
      );
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [isAdminRoute, currentPlayer.uid, privateProfile.weekKey, privateProfile.claimedDays, showToast]);

  const qualificationThreshold =
    appConfig.qualificationThreshold || DEFAULT_QUALIFICATION_THRESHOLD;

  const qualifiedCount = useMemo(
    () =>
      leaderboard.filter((p) => (p.weeklyCoins || 0) >= qualificationThreshold).length,
    [leaderboard, qualificationThreshold]
  );

  const sundayBonusZar = useMemo(() => {
    const awardedBalance = currentPlayer.sundayBonusZar || 0;
    const isSunday = getTodayWeekdayKey() === 'Sun';
    if (!isSunday || qualifiedCount < 3) return awardedBalance;

    const pool = appConfig.poolPrizeZar || DEFAULT_POOL_PRIZE_ZAR;
    const qualifiedTop3 = leaderboard
      .filter((p) => (p.weeklyCoins || 0) >= qualificationThreshold)
      .slice(0, 3);
    const qualifiedIndex = qualifiedTop3.findIndex((p) => p.uid === currentPlayer.uid);

    let liveShare = 0;
    if (qualifiedIndex === 0) liveShare = Math.round(pool * 0.5);
    else if (qualifiedIndex === 1) liveShare = Math.round(pool * 0.3);
    else if (qualifiedIndex === 2) liveShare = Math.round(pool * 0.2);

    return awardedBalance + liveShare;
  }, [
    currentPlayer,
    leaderboard,
    qualifiedCount,
    appConfig.poolPrizeZar,
    qualificationThreshold,
  ]);

  const handleOpenMysteryBox = (boxNumber: number) => {
    const todayKey = getTodayDateKey();
    const {
      isCloudMode: cloudNow,
      currentPlayer: player,
      privateProfile: priv,
      appConfig: latestCfg,
      muted: isMutedNow,
    } = latestStateRef.current;

    const scheduleVaultAutoReset = (isCloudReset: boolean, uid?: string) => {
      if (mysteryResetTimerRef.current !== null) {
        window.clearTimeout(mysteryResetTimerRef.current);
      }
      mysteryResetTimerRef.current = window.setTimeout(() => {
        mysteryResetTimerRef.current = null;
        if (isCloudReset && uid) {
          setCloudOpenedBoxes([]);
          writeCloudOpenedBoxes(uid, getTodayDateKey(), []);
        } else {
          setGuestPrivate((curr) => resetLocalMysteryBoxes(curr));
        }
        setMysteryReveal(null);
      }, 4000);
    };

    if (cloudNow && firebaseUser) {
      if (cloudOpenedBoxes.includes(boxNumber) || cloudOpenedBoxes.length >= 11) {
        return;
      }

      const nextOpened = Array.from(new Set([...cloudOpenedBoxes, boxNumber]));
      setCloudOpenedBoxes(nextOpened);
      writeCloudOpenedBoxes(firebaseUser.uid, todayKey, nextOpened);

      const is11thBoxJackpot = nextOpened.length === 11;
      const rewardCoins = is11thBoxJackpot ? 1000 : 100;
      const threshold = latestCfg.qualificationThreshold || DEFAULT_QUALIFICATION_THRESHOLD;

      if (is11thBoxJackpot) {
        setMysteryReveal({
          dateKey: todayKey,
          boxNumber,
          kind: 'jackpot',
          coins: 1000,
        });
        setConfettiActive(true);
        playCoinPotCashChime(isMutedNow);
        playVictoryFanfare(isMutedNow);
        showToast(
          '🎉 JACKPOT! You unlocked the Mystery Gift! +1,000 Bonus Coins! 🎁',
          1000
        );
        scheduleVaultAutoReset(true, firebaseUser.uid);
      } else {
        setMysteryReveal({
          dateKey: todayKey,
          boxNumber,
          kind: 'coins',
          coins: 100,
        });
        playCoinChime(isMutedNow);
        showToast('Oops! Sorry, try the next box 😢', 100);
      }

      void awardMysteryBoxCoins(
        player,
        priv,
        boxNumber,
        rewardCoins,
        threshold,
        is11thBoxJackpot
      ).catch(() => {
        // Optimistic vault state already reflected on screen
      });
      return;
    }

    try {
      const result = claimLocalMysteryBox({
        player,
        privateProfile: priv,
        boxNumber,
        paidWithCoins: false,
        appConfig: latestCfg,
      });
      setGuestPlayer(result.player);
      setGuestPrivate(result.privateProfile);
      setLocalTransactions(result.transactions);
      setLocalLeaderboard(loadLocalLeaderboard(result.player));
      setLocalAppConfig(result.appConfig);
      setLocalWinners(loadLocalMysteryWinners());

      const revealPayload: MysteryRevealState = {
        dateKey: todayKey,
        boxNumber,
        kind: result.outcome.kind,
        coins: result.outcome.coins,
        winnerRecord: result.winnerRecord,
        newPoolPrizeZar: result.newPoolPrizeZar,
      };
      setMysteryReveal(revealPayload);

      if (result.outcome.kind === 'jackpot') {
        setConfettiActive(true);
        playCoinPotCashChime(isMutedNow);
        playVictoryFanfare(isMutedNow);
        showToast(
          '🎉 JACKPOT! You unlocked the Mystery Gift! +1,000 Bonus Coins! 🎁',
          1000
        );
        scheduleVaultAutoReset(false);
      } else if (result.outcome.kind === 'coins') {
        playCoinChime(isMutedNow);
        showToast('Oops! Sorry, try the next box 😢', result.outcome.coins);
      } else if (result.winnerRecord) {
        setConfettiActive(true);
        playCoinChime(isMutedNow);
        playVictoryFanfare(isMutedNow);
        setMysteryVoucherModal({
          winner: result.winnerRecord,
          newPoolPrizeZar: result.newPoolPrizeZar,
        });
        showToast('YOU WON CONGRATULATIONS! 🎉 R5 Airtime unlocked!');
      }
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Unable to open Mystery Box.',
        undefined,
        'error'
      );
    }
  };

  const handleCompleteDailyCheckIn = async (dayKey: WeekDayKey, reward: number) => {
    const currentWeek = getCurrentWeekKey();
    const baseClaimed =
      privateProfile.weekKey === currentWeek ? privateProfile.claimedDays || [] : [];
    if (baseClaimed.includes(dayKey)) return;

    const threshold = appConfig.qualificationThreshold || DEFAULT_QUALIFICATION_THRESHOLD;
    if (isCloudMode) {
      const awarded = await claimStreakDay(
        currentPlayer,
        privateProfile,
        dayKey,
        reward,
        threshold
      );
      if (awarded) {
        playCoinChime(muted);
        showToast(
          `+${reward} Coins Added to Wallet! (${dayKey} Check-In)`,
          reward,
          'gold',
          undefined,
          3000
        );
      }
      return;
    }

    const nextClaimed = [...baseClaimed, dayKey].slice(0, 7);
    const res = applyLocalCoinMutation({
      player: currentPlayer,
      privateProfile,
      walletDelta: reward,
      qualificationThreshold: threshold,
      privateUpdates: {
        weekKey: currentWeek,
        claimedDays: nextClaimed,
      },
      nextStreakCount: nextClaimed.length,
      recordStreakActivity: true,
      txMeta: { category: 'streak', title: `${dayKey} Daily Check-In` },
    });
    setGuestPlayer(res.player);
    setGuestPrivate(res.privateProfile);
    setLocalTransactions(res.transactions);
    setLocalLeaderboard(loadLocalLeaderboard(res.player));
    playCoinChime(muted);
    showToast(
      `+${reward} Coins Added to Wallet! (${dayKey} Check-In)`,
      reward,
      'gold',
      undefined,
      3000
    );
  };

  const handleUpdatePlayerName = async (newName: string) => {
    if (isCloudMode && firebaseUser) {
      const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
      const { db } = await import('./firebase');
      await updateDoc(doc(db, 'leaderboard', firebaseUser.uid), {
        username: newName.trim().slice(0, 32),
        updatedAt: serverTimestamp(),
      });
      showToast(`Leaderboard name updated to "${newName.trim()}"`);
      return;
    }
    const updated = updateLocalGuestUsername(guestPlayer, newName);
    setGuestPlayer(updated);
    setLocalLeaderboard(loadLocalLeaderboard(updated));
    showToast(`Leaderboard name updated to "${updated.username}"`);
  };

  const handleResetMyCoins = async () => {
    if (isCloudMode && firebaseUser) {
      await resetPlayerCoinsToZero(firebaseUser.uid);
      showToast('Coins reset to 0 for testing.', undefined, 'neutral');
      return;
    }
    const { player: resetPlayer, leaderboard: nextLb } = resetLocalPlayerCoins(guestPlayer);
    setGuestPlayer(resetPlayer);
    setLocalLeaderboard(nextLb);
    showToast('Coins reset to 0 for testing.', undefined, 'neutral');
  };

  const handleMarkEpisodeWatched = useCallback(async (episode: DramaEpisode): Promise<void> => {
    const {
      isCloudMode: cloudNow,
      currentPlayer: playerNow,
      privateProfile: privNow,
      appConfig: cfgNow,
    } = latestStateRef.current;

    const nextWatched = mergeWatchedEpisodeId(privNow.watchedEpisodeIds || [], episode.id);
    if (nextWatched.length === (privNow.watchedEpisodeIds || []).length) {
      return;
    }

    if (cloudNow) {
      await markEpisodeAsWatched(playerNow.uid, privNow, episode.id);
      return;
    }

    const threshold = cfgNow.qualificationThreshold || DEFAULT_QUALIFICATION_THRESHOLD;
    const res = applyLocalCoinMutation({
      player: playerNow,
      privateProfile: privNow,
      walletDelta: 0,
      qualificationThreshold: threshold,
      privateUpdates: {
        watchedEpisodeIds: nextWatched,
      },
    });
    setGuestPlayer(res.player);
    setGuestPrivate(res.privateProfile);
  }, []);

  const handleAwardCoinPot = useCallback(
    async (episode: DramaEpisode, amount: number): Promise<void> => {
      const {
        isCloudMode: cloudNow,
        currentPlayer: playerNow,
        privateProfile: privNow,
        appConfig: cfgNow,
        muted: mutedNow,
      } = latestStateRef.current;

      const safeAmount = Math.max(100, Math.min(600, Math.round(amount)));
      const threshold = cfgNow.qualificationThreshold || DEFAULT_QUALIFICATION_THRESHOLD;
      const nextWatched = mergeWatchedEpisodeId(privNow.watchedEpisodeIds || [], episode.id);

      if (cloudNow) {
        await awardWatchPotCoins(
          playerNow,
          privNow,
          safeAmount,
          threshold,
          episode.title,
          episode.id
        );
        playCoinPotCashChime(mutedNow);
        showToast(`+${safeAmount} Coins Added to Wallet!`, safeAmount, 'gold', undefined, 3000);
        return;
      }

      const res = applyLocalCoinMutation({
        player: playerNow,
        privateProfile: privNow,
        walletDelta: safeAmount,
        qualificationThreshold: threshold,
        privateUpdates: {
          watchedEpisodeIds: nextWatched,
        },
        recordStreakActivity: true,
        txMeta: {
          category: 'episode',
          title: `Coin Pot: ${episode.title}`.slice(0, 100),
        },
      });
      setGuestPlayer(res.player);
      setGuestPrivate(res.privateProfile);
      setLocalTransactions(res.transactions);
      setLocalLeaderboard(loadLocalLeaderboard(res.player));
      playCoinPotCashChime(mutedNow);
      showToast(`+${safeAmount} Coins Added to Wallet!`, safeAmount, 'gold', undefined, 3000);
    },
    [showToast]
  );

  const handleClaimHeroBonus = useCallback(async (): Promise<void> => {
    const {
      isCloudMode: cloudNow,
      currentPlayer: playerNow,
      privateProfile: privNow,
      appConfig: cfgNow,
      muted: mutedNow,
    } = latestStateRef.current;

    const bonusCoins = 100;
    const threshold = cfgNow.qualificationThreshold || DEFAULT_QUALIFICATION_THRESHOLD;

    if (cloudNow) {
      await awardHeroBonusCoins(playerNow, privNow, bonusCoins, threshold);
      playCoinChime(mutedNow);
      showToast(`+${bonusCoins} Coins Added to Wallet!`, bonusCoins, 'gold', undefined, 3000);
      return;
    }

    const res = applyLocalCoinMutation({
      player: playerNow,
      privateProfile: privNow,
      walletDelta: bonusCoins,
      qualificationThreshold: threshold,
      recordStreakActivity: true,
      txMeta: {
        category: 'banner',
        title: 'Hero Carousel Bonus Claim',
      },
    });
    setGuestPlayer(res.player);
    setGuestPrivate(res.privateProfile);
    setLocalTransactions(res.transactions);
    setLocalLeaderboard(loadLocalLeaderboard(res.player));
    playCoinChime(mutedNow);
    showToast(`+${bonusCoins} Coins Added to Wallet!`, bonusCoins, 'gold', undefined, 3000);
  }, [showToast]);

  const handleToggleMyList = useCallback(
    (seriesId: string, seriesName: string) => {
      const { list, added } = toggleMyListSeriesId(seriesId);
      setMyListSeriesIds(list);
      showToast(
        added ? `Saved "${seriesName}" to My List` : `Removed "${seriesName}" from My List`,
        undefined,
        added ? 'gold' : 'neutral',
        undefined,
        2400
      );
    },
    [showToast]
  );

  const handleShareEpisode = useCallback(
    (episode: DramaEpisode) => {
      const shareTitle = `${episode.series} — ${episode.title}`;
      const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        void navigator
          .share({
            title: shareTitle,
            text: `Watch ${shareTitle} on ${BRAND_NAME}!`,
            url: shareUrl,
          })
          .catch(() => {
            // User dismissed native share sheet
          });
        return;
      }
      if (typeof navigator !== 'undefined' && navigator.clipboard && shareUrl) {
        void navigator.clipboard
          .writeText(shareUrl)
          .then(() => {
            showToast('Series link copied to share!', undefined, 'neutral', undefined, 2500);
          })
          .catch(() => {
            showToast('Share link ready in browser address bar.', undefined, 'neutral', undefined, 2500);
          });
      }
    },
    [showToast]
  );

  const handleSundayZeroTick = useCallback(() => {
    if (!adminUnlocked || leaderboard.length === 0 || !isCloudMode) return;
    void evaluateSundayPoolRollover(appConfig, leaderboard).then((res) => {
      if (res.outcome === 'distributed') {
        setConfettiActive(true);
        playVictoryFanfare(muted);
        showToast(`Sunday Pool Distributed! ${res.summary}`);
      } else {
        showToast(`🔥 ROLLOVER JACKPOT: R${res.nextPoolZar} carried forward!`);
      }
    });
  }, [adminUnlocked, isCloudMode, appConfig, leaderboard, muted, showToast]);

  const ensureFirebaseAdminGrant = async (): Promise<User | null> => {
    const activeUser = firebaseUser || auth.currentUser;
    if (!activeUser) return null;
    try {
      await unlockAdminAccess(activeUser.uid, ADMIN_PASSCODE);
    } catch {
      // Primary admin email does not require admins/{uid} doc if email matches rule
    }
    return activeUser;
  };

  // Admin Handlers (syncs locally immediately + writes live to Firebase Firestore when signed in)
  const handleUnlockAdmin = async (passcode: string) => {
    if (passcode !== ADMIN_PASSCODE) {
      throw new Error('Invalid password. Access denied.');
    }
    try {
      window.sessionStorage.setItem(ADMIN_SESSION_KEY, 'true');
    } catch {
      // Ignore sessionStorage restrictions
    }
    setAdminUnlocked(true);
    const activeUser = firebaseUser || auth.currentUser;
    if (activeUser) {
      try {
        await unlockAdminAccess(activeUser.uid, passcode);
      } catch {
        // Ignore cloud sync error in local guest mode
      }
    }
  };

  const handleConnectFirebaseAdmin = async () => {
    const cred = await signInWithPopup(auth, googleProvider);
    setFirebaseUser(cred.user);
    await unlockAdminAccess(cred.user.uid, ADMIN_PASSCODE);
  };

  const handleLockAdmin = () => {
    try {
      window.sessionStorage.removeItem(ADMIN_SESSION_KEY);
    } catch {
      // Ignore sessionStorage restrictions
    }
    setAdminUnlocked(false);
  };

  const handleCreateSection = async (name: string) => {
    const cleanName = name.trim().slice(0, 60);
    if (!cleanName) return;
    const seriesId = toSeriesId(cleanName);
    setDeletedIds(removeDeletedSeriesMarker(cleanName));
    setLocalSections(saveLocalSection(cleanName));
    setCloudSeries((prev) => {
      if (prev.some((s) => s.seriesId === seriesId)) return prev;
      return [
        ...prev,
        {
          id: seriesId,
          seriesId,
          title: cleanName,
          category: inferEpisodeCategory(cleanName),
          coverImage: 'none',
          synopsis: `${cleanName} drama series.`,
          episodeIds: [],
          sortOrder: prev.length + 1,
          isPublic: true,
        },
      ];
    });

    const activeUser = await ensureFirebaseAdminGrant();
    if (activeUser) {
      await upsertDramaSeries({
        title: cleanName,
        seriesId,
        category: inferEpisodeCategory(cleanName),
        sortOrder: cloudSeries.length + 1,
      });
    }
  };

  const handleRenameSection = async (oldName: string, newName: string) => {
    const cleanNew = newName.trim().slice(0, 60);
    if (!cleanNew || cleanNew === oldName) return;
    const oldSeriesId = toSeriesId(oldName);
    const targetSeriesId = toSeriesId(cleanNew);

    setDeletedIds(removeDeletedSeriesMarker(cleanNew));
    const result = renameLocalSection(oldName, cleanNew);
    setLocalEpisodes(result.episodes);
    setLocalSections(result.sections);
    setCloudEpisodes((prev) =>
      prev.map((ep) =>
        ep.series === oldName || getEpisodeSeriesId(ep) === oldSeriesId
          ? {
              ...ep,
              series: cleanNew,
              seriesId: targetSeriesId,
              category: inferEpisodeCategory(cleanNew, ep.title, ep.category),
            }
          : ep
      )
    );
    setCloudSeries((prev) =>
      prev.map((s) =>
        s.seriesId === oldSeriesId || s.title === oldName
          ? { ...s, id: targetSeriesId, seriesId: targetSeriesId, title: cleanNew }
          : s
      )
    );

    const activeUser = await ensureFirebaseAdminGrant();
    if (activeUser) {
      const matching = (cloudEpisodes.length > 0 ? cloudEpisodes : episodes).filter(
        (ep) => ep.series === oldName || getEpisodeSeriesId(ep) === oldSeriesId
      );
      for (const ep of matching) {
        await updateDramaEpisode(ep.id, {
          title: ep.title,
          series: cleanNew,
          seriesId: targetSeriesId,
          category: inferEpisodeCategory(cleanNew, ep.title, ep.category),
          episodeLabel: ep.episodeLabel,
          duration: ep.duration,
          rewardCoins: ep.rewardCoins,
          coverImage: ep.coverImage,
          thumbnailUrl: ep.thumbnailUrl,
          synopsis: ep.synopsis,
          sponsorUrl: ep.sponsorUrl,
          youtubeUrl: ep.youtubeUrl,
          videoUrl: ep.videoUrl,
          startTime: ep.startTime,
          sortOrder: ep.sortOrder,
        });
      }
      await deleteDramaSeriesFromFirestore(oldSeriesId, []);
    }
  };

  const handleDeleteSection = async (name: string, removeEpisodes = true) => {
    const targetSeriesId = toSeriesId(name);
    const matching = (cloudEpisodes.length > 0 ? cloudEpisodes : episodes).filter(
      (ep) => ep.series === name || getEpisodeSeriesId(ep) === targetSeriesId
    );
    const result = deleteLocalSection(name, removeEpisodes);
    const nextDeleted = recordDeletedIds([
      targetSeriesId,
      ...result.deletedIds,
      ...(removeEpisodes ? matching.map((m) => m.id) : []),
    ]);
    setDeletedIds(nextDeleted);
    setLocalEpisodes(result.episodes);
    setLocalSections(result.sections);

    setCloudSeries((prev) =>
      prev.filter((s) => s.seriesId !== targetSeriesId && s.title !== name)
    );

    if (removeEpisodes) {
      const removedIds = new Set(matching.map((m) => m.id));
      setCloudEpisodes((prev) =>
        prev.filter(
          (ep) =>
            !removedIds.has(ep.id) &&
            ep.series !== name &&
            getEpisodeSeriesId(ep) !== targetSeriesId
        )
      );
    }

    const activeUser = await ensureFirebaseAdminGrant();
    if (activeUser) {
      await deleteDramaSeriesFromFirestore(
        targetSeriesId,
        removeEpisodes ? matching.map((m) => m.id) : []
      );
    }
  };

  const handleUpdateSponsorUrl = async (newUrl: string) => {
    const sanitized = sanitizeExternalUrl(newUrl).slice(0, 500);
    const nextCfg = saveLocalAppConfig({ ...appConfig, sponsorAdUrl: sanitized });
    setLocalAppConfig(nextCfg);
    setCloudAppConfig(nextCfg);

    const activeUser = await ensureFirebaseAdminGrant();
    if (activeUser) {
      await updateSponsorAdUrl(sanitized, nextCfg);
    }
  };

  const handleUpdateEmbeddedAdHtml = async (html: string) => {
    const nextCfg = saveLocalAppConfig({ ...appConfig, embeddedAdHtml: html });
    setLocalAppConfig(nextCfg);
    setCloudAppConfig(nextCfg);

    const activeUser = await ensureFirebaseAdminGrant();
    if (activeUser) {
      await updateEmbeddedAdHtml(html, nextCfg);
    }
  };

  const handleUpdateLiveTicker = async (enabled: boolean, names: string[]) => {
    const nextCfg = saveLocalAppConfig({
      ...appConfig,
      liveTickerEnabled: enabled,
      liveTickerNames: names,
    });
    setLocalAppConfig(nextCfg);
    setCloudAppConfig(nextCfg);

    const activeUser = await ensureFirebaseAdminGrant();
    if (activeUser) {
      await updateLiveTickerConfig(nextCfg, enabled, names);
    }
  };

  const handleUpdateMysteryAndRollover = async (updates: {
    r5WinnerUsername?: string;
    nextPickWinsR5?: boolean;
    poolPrizeZar: number;
    rolloverAmountZar: number;
    lastPoolWinnerSummary?: string;
    lastWinnerUids?: string[];
  }) => {
    const nextCfg = saveLocalAppConfig({ ...appConfig, ...updates });
    setLocalAppConfig(nextCfg);
    setCloudAppConfig(nextCfg);

    const activeUser = await ensureFirebaseAdminGrant();
    if (activeUser) {
      await updateMysteryAndRolloverConfig(nextCfg, updates);
    }
  };

  const handleTriggerSundayRollover = async () => {
    if (isCloudMode) {
      const res = await evaluateSundayPoolRollover(appConfig, leaderboard);
      if (res.outcome === 'distributed') {
        setConfettiActive(true);
        playVictoryFanfare(muted);
        showToast(`Sunday Reset Complete! ${res.summary}`);
      } else {
        showToast(`🔥 Weekly scores reset — R${res.nextPoolZar} carried forward!`);
      }
      return res;
    }

    const threshold = appConfig.qualificationThreshold || DEFAULT_QUALIFICATION_THRESHOLD;
    const sortedQualified = [...leaderboard]
      .filter((p) => (p.weeklyCoins || 0) >= threshold)
      .sort((a, b) => b.weeklyCoins - a.weeklyCoins);
    const currentPool = Math.max(
      DEFAULT_POOL_PRIZE_ZAR,
      appConfig.poolPrizeZar || DEFAULT_POOL_PRIZE_ZAR
    );

    if (sortedQualified.length >= 3) {
      const [first, second, third] = sortedQualified;
      const p1 = Math.round(currentPool * 0.5);
      const p2 = Math.round(currentPool * 0.3);
      const p3 = Math.round(currentPool * 0.2);
      const summary = `1st: ${first.username} (R${p1}) · 2nd: ${second.username} (R${p2}) · 3rd: ${third.username} (R${p3})`;
      setLocalAppConfig(
        saveLocalAppConfig({
          ...appConfig,
          poolPrizeZar: DEFAULT_POOL_PRIZE_ZAR,
          rolloverAmountZar: 0,
          poolWeekKey: getCurrentWeekKey(),
          weekStartTimestamp: getMondayStartTimestampSAST(),
          lastPoolWinnerSummary: summary,
          lastWinnerUids: [first.uid, second.uid, third.uid],
        })
      );
      setGuestPlayer((prev) => ({ ...prev, weeklyCoins: 0, qualified: false, streakCount: 0 }));
      setConfettiActive(true);
      playVictoryFanfare(muted);
      return {
        outcome: 'distributed' as const,
        summary,
        nextPoolZar: DEFAULT_POOL_PRIZE_ZAR,
        playersReset: leaderboard.length,
      };
    }

    const nextPoolZar = currentPool + DEFAULT_POOL_PRIZE_ZAR;
    const summary = `Unclaimed R${currentPool} rolled over into R${nextPoolZar} pool (${sortedQualified.length}/3 qualified).`;
    setLocalAppConfig(
      saveLocalAppConfig({
        ...appConfig,
        poolPrizeZar: nextPoolZar,
        rolloverAmountZar: currentPool,
        poolWeekKey: getCurrentWeekKey(),
        weekStartTimestamp: getMondayStartTimestampSAST(),
        lastPoolWinnerSummary: '',
        lastWinnerUids: [],
      })
    );
    setGuestPlayer((prev) => ({ ...prev, weeklyCoins: 0, qualified: false, streakCount: 0 }));
    return {
      outcome: 'rolled_over' as const,
      summary,
      nextPoolZar,
      playersReset: leaderboard.length,
    };
  };

  const handleAddEpisode = async (input: AdminEpisodeFormInput & { sortOrder: number }) => {
    const episodeId = `ep-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const resolvedSeriesId = getEpisodeSeriesId({ series: input.series, seriesId: input.seriesId });
    const resolvedCategory = inferEpisodeCategory(input.series, input.title, input.category);
    const incomingVideoKey = getCanonicalVideoKey(input.videoUrl || input.youtubeUrl);

    if (incomingVideoKey) {
      const duplicateEp = episodes.find(
        (ep) =>
          getEpisodeSeriesId(ep) === resolvedSeriesId &&
          getCanonicalVideoKey(ep.videoUrl || ep.youtubeUrl) === incomingVideoKey
      );
      if (duplicateEp) {
        throw new Error(
          `Duplicate blocked: "${duplicateEp.episodeLabel}" ("${duplicateEp.title}") already uses this video URL in "${input.series}".`
        );
      }
    }

    setDeletedIds(removeDeletedSeriesMarker(resolvedSeriesId));

    const normalizedInput: AdminEpisodeFormInput & { sortOrder: number; id: string } = {
      ...input,
      id: episodeId,
      seriesId: resolvedSeriesId,
      category: resolvedCategory,
    };

    const nextList = addLocalEpisode(normalizedInput);
    const createdEp = nextList.find((ep) => ep.id === episodeId);
    setLocalEpisodes(nextList);
    setLocalSections(loadLocalSections(nextList));

    if (createdEp) {
      setCloudEpisodes((prev) => deduplicateEpisodeList([...prev, createdEp]));
      setCloudSeries((prev) => {
        const exists = prev.some((s) => s.seriesId === resolvedSeriesId);
        if (!exists) {
          return [
            ...prev,
            {
              id: resolvedSeriesId,
              seriesId: resolvedSeriesId,
              title: createdEp.series,
              category: resolvedCategory,
              coverImage: createdEp.coverImage || 'none',
              synopsis: createdEp.synopsis,
              episodeIds: [episodeId],
              sortOrder: input.sortOrder,
              isPublic: true,
            },
          ];
        }
        return prev.map((s) =>
          s.seriesId === resolvedSeriesId
            ? {
                ...s,
                episodeIds: Array.from(new Set([...(s.episodeIds || []), episodeId])),
              }
            : s
        );
      });
    }

    const activeUser = await ensureFirebaseAdminGrant();
    if (activeUser) {
      await addDramaEpisode(normalizedInput);
    }
  };

  const handleUpdateEpisode = async (episodeId: string, input: AdminEpisodeFormInput) => {
    const resolvedSeriesId = getEpisodeSeriesId({ series: input.series, seriesId: input.seriesId });
    const resolvedCategory = inferEpisodeCategory(input.series, input.title, input.category);
    const incomingVideoKey = getCanonicalVideoKey(input.videoUrl || input.youtubeUrl);

    if (incomingVideoKey) {
      const duplicateEp = episodes.find(
        (ep) =>
          ep.id !== episodeId &&
          getEpisodeSeriesId(ep) === resolvedSeriesId &&
          getCanonicalVideoKey(ep.videoUrl || ep.youtubeUrl) === incomingVideoKey
      );
      if (duplicateEp) {
        throw new Error(
          `Duplicate blocked: "${duplicateEp.episodeLabel}" ("${duplicateEp.title}") already uses this video URL in "${input.series}".`
        );
      }
    }

    const normalizedInput: AdminEpisodeFormInput = {
      ...input,
      seriesId: resolvedSeriesId,
      category: resolvedCategory,
    };
    const nextList = updateLocalEpisode(episodeId, normalizedInput);
    const updatedEp = nextList.find((ep) => ep.id === episodeId);
    setLocalEpisodes(nextList);
    setLocalSections(loadLocalSections(nextList));

    if (updatedEp) {
      setCloudEpisodes((prev) => {
        const found = prev.some((ep) => ep.id === episodeId);
        return found
          ? prev.map((ep) => (ep.id === episodeId ? updatedEp : ep))
          : deduplicateEpisodeList([...prev, updatedEp]);
      });
    }

    const matchedSortOrder =
      updatedEp?.sortOrder ??
      episodes.find((ep) => ep.id === episodeId)?.sortOrder ??
      1;

    const activeUser = await ensureFirebaseAdminGrant();
    if (activeUser) {
      await updateDramaEpisode(episodeId, {
        ...normalizedInput,
        sortOrder: matchedSortOrder,
      });
    }
  };

  const handleDeleteEpisode = async (episodeId: string) => {
    const targetEp = episodes.find((ep) => ep.id === episodeId);
    const seriesIdHint = targetEp ? getEpisodeSeriesId(targetEp) : undefined;
    setDeletedIds(recordDeletedIds([episodeId]));
    const nextList = deleteLocalEpisode(episodeId);
    setLocalEpisodes(nextList);
    setLocalSections(loadLocalSections(nextList));
    setCloudEpisodes((prev) => prev.filter((ep) => ep.id !== episodeId));
    if (seriesIdHint) {
      setCloudSeries((prev) =>
        prev.map((s) =>
          s.seriesId === seriesIdHint
            ? { ...s, episodeIds: (s.episodeIds || []).filter((id) => id !== episodeId) }
            : s
        )
      );
    }

    const activeUser = await ensureFirebaseAdminGrant();
    if (activeUser) {
      await deleteDramaEpisode(episodeId, seriesIdHint);
    }
  };

  const handleReorderSeries = async (orderedSeriesNames: string[]) => {
    const result = reorderLocalSeries(orderedSeriesNames);
    setLocalSections(result.sections);
    setLocalEpisodes(result.episodes);

    const activeUser = await ensureFirebaseAdminGrant();
    if (activeUser && cloudEpisodes.length > 0) {
      const orderMap = new Map<string, number>();
      result.sections.forEach((name, idx) => orderMap.set(name, idx));
      const sortedCloud = [...cloudEpisodes]
        .sort((a, b) => {
          const idxA = orderMap.get(a.series?.trim() || '') ?? 9999;
          const idxB = orderMap.get(b.series?.trim() || '') ?? 9999;
          if (idxA !== idxB) return idxA - idxB;
          return (a.sortOrder || 0) - (b.sortOrder || 0);
        })
        .map((ep, idx) => ({ id: ep.id, sortOrder: idx + 1 }));
      await reorderDramaEpisodes(sortedCloud);
    }
  };

  const handleRestoreDefaultEpisodes = async () => {
    const cleared = forceSaveDefaultEpisodesToLocalStorage();
    setLocalEpisodes(cleared);
    setLocalSections([]);
    setCloudEpisodes([]);
    setCloudSeries([]);

    const activeUser = await ensureFirebaseAdminGrant();
    if (activeUser) {
      for (const ep of cloudEpisodes) {
        await deleteDramaEpisode(ep.id);
      }
      await restoreDefaultEpisodes();
    }
    showToast('Catalog reset to clean empty state.');
  };

  const handleAdjustPlayerCoins = async (
    player: LeaderboardPlayer,
    newCoins: number,
    newWeeklyCoins: number
  ) => {
    const threshold = appConfig.qualificationThreshold || DEFAULT_QUALIFICATION_THRESHOLD;
    if (isCloudMode) {
      await adminAdjustPlayerCoins(player, newCoins, newWeeklyCoins, threshold);
      return;
    }

    const updated: LeaderboardPlayer = {
      ...player,
      coins: Math.max(0, Math.round(newCoins)),
      weeklyCoins: Math.max(0, Math.round(newWeeklyCoins)),
      qualified: newWeeklyCoins >= threshold,
    };
    const nextLb = upsertLocalLeaderboardPlayer(updated);
    setLocalLeaderboard(nextLb);
    if (updated.uid === guestPlayer.uid) {
      const delta = updated.coins - guestPlayer.coins;
      const res = applyLocalCoinMutation({
        player: { ...updated, coins: guestPlayer.coins },
        privateProfile: guestPrivate,
        walletDelta: delta,
        qualificationThreshold: threshold,
        txMeta:
          delta !== 0
            ? {
                category: 'admin-adjustment',
                title: delta > 0 ? 'Admin Coin Credit' : 'Admin Coin Deduction',
              }
            : undefined,
      });
      setGuestPlayer({ ...res.player, weeklyCoins: updated.weeklyCoins });
      setGuestPrivate(res.privateProfile);
      setLocalTransactions(res.transactions);
    }
  };

  if (isAdminRoute) {
    return (
      <AdminBoardPage
        unlocked={adminUnlocked}
        firebaseUserEmail={firebaseUser?.email || null}
        appConfig={appConfig}
        sections={sections}
        episodes={episodes}
        players={leaderboard}
        mysteryWinners={mysteryWinners}
        onBackToApp={navigateToApp}
        onUnlock={handleUnlockAdmin}
        onConnectFirebaseAdmin={handleConnectFirebaseAdmin}
        onLockAdmin={handleLockAdmin}
        onCreateSection={handleCreateSection}
        onRenameSection={handleRenameSection}
        onDeleteSection={handleDeleteSection}
        onUpdateSponsorUrl={handleUpdateSponsorUrl}
        onUpdateEmbeddedAdHtml={handleUpdateEmbeddedAdHtml}
        onUpdateLiveTicker={handleUpdateLiveTicker}
        onUpdateMysteryAndRollover={handleUpdateMysteryAndRollover}
        onTriggerSundayRollover={handleTriggerSundayRollover}
        onAddEpisode={handleAddEpisode}
        onUpdateEpisode={handleUpdateEpisode}
        onDeleteEpisode={handleDeleteEpisode}
        onReorderSeries={handleReorderSeries}
        onRestoreDefaultEpisodes={handleRestoreDefaultEpisodes}
        onAdjustPlayerCoins={handleAdjustPlayerCoins}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-[#F6F2E9] pb-24">
      {!splashDone && <VipSplashScreen onComplete={() => setSplashDone(true)} />}

      <ConfettiExplosion
        active={confettiActive}
        onComplete={() => setConfettiActive(false)}
      />

      <TopHeader
        coins={currentPlayer.coins}
        sundayBonusZar={sundayBonusZar}
        muted={muted}
        onOpenGiftVault={() => setGiftVaultModalOpen(true)}
        onToggleMute={handleToggleMute}
        onOpenAdmin={navigateToAdmin}
      />

      {/* Bright Animated Floating Coin Earned Toast / Daily Streak Reminder / Warning */}
      {toast && (
        <div className="fixed top-4 sm:top-5 left-1/2 -translate-x-1/2 z-[95] px-4 w-full max-w-md pointer-events-none">
          <div
            role="status"
            aria-live="polite"
            className={`pointer-events-auto rounded-2xl px-4 py-3 border flex items-center justify-between gap-2.5 transition-all duration-300 ${
              toast.tone === 'error'
                ? 'bg-red-950/95 border-red-500/80 text-red-100 shadow-2xl shadow-red-950/60'
                : toast.tone === 'reminder'
                  ? 'bg-[#121218]/95 backdrop-blur-md border-[#D4AF37]/45 text-[#F6F2E9] shadow-2xl shadow-black/70'
                  : toast.tone === 'neutral'
                    ? 'bg-[#14141A]/95 border-white/15 text-[#F6F2E9] shadow-2xl'
                    : 'bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-500 border-yellow-100 text-zinc-950 shadow-[0_10px_36px_rgba(251,191,36,0.7)] ring-2 ring-amber-200/60'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {toast.coinsAwarded && (
                <div className="animate-bounce shrink-0">
                  <RealisticGoldCoin sizePx={42} emblem="$" />
                </div>
              )}
              {toast.tone === 'error' && (
                <AlertTriangle className="w-4 h-4 text-red-300 shrink-0" />
              )}
              {toast.tone === 'reminder' && (
                <Flame className="w-4 h-4 text-[#D4AF37] shrink-0" />
              )}
              <span className="text-xs sm:text-sm font-extrabold leading-snug tracking-tight">
                {toast.message}
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {toast.coinsAwarded && (
                <span className="font-mono-num text-xs font-black bg-zinc-950 text-amber-300 px-2.5 py-1 rounded-full shadow">
                  +{toast.coinsAwarded}
                </span>
              )}
              {toast.actionLabel && toast.onAction && (
                <button
                  type="button"
                  onClick={() => {
                    toast.onAction?.();
                    setToast(null);
                  }}
                  className="min-h-[32px] px-3 rounded-lg gold-gradient-bg text-[#181307] text-xs font-bold whitespace-nowrap hover:brightness-105"
                >
                  {toast.actionLabel}
                </button>
              )}
              {toast.tone === 'reminder' && (
                <button
                  type="button"
                  onClick={() => setToast(null)}
                  aria-label="Dismiss reminder"
                  className="min-h-[32px] min-w-[32px] rounded-lg flex items-center justify-center text-[#A69F91] hover:text-[#F6F2E9] hover:bg-white/[0.06]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Content — Clean 4-Tab Architecture */}
      <main className="max-w-6xl mx-auto px-3 sm:px-6 pt-4 space-y-6">
        {activeTab === 'watch' && (
          <WatchTab
            sections={sections}
            episodes={episodes}
            privateState={privateProfile}
            sponsorAdUrl={appConfig.sponsorAdUrl}
            playerWeeklyCoins={currentPlayer.weeklyCoins}
            playerTotalCoins={currentPlayer.coins}
            qualificationThreshold={qualificationThreshold}
            muted={muted}
            onToggleMute={handleToggleMute}
            onAwardCoinPot={handleAwardCoinPot}
            onClaimHeroBonus={handleClaimHeroBonus}
            onMarkEpisodeWatched={handleMarkEpisodeWatched}
          />
        )}

        {activeTab === 'foryou' && (
          <ForYouTab
            episodes={episodes}
            privateState={privateProfile}
            sponsorAdUrl={appConfig.sponsorAdUrl}
            myListSeriesIds={myListSeriesIds}
            playerWeeklyCoins={currentPlayer.weeklyCoins}
            playerTotalCoins={currentPlayer.coins}
            qualificationThreshold={qualificationThreshold}
            muted={muted}
            onToggleMute={handleToggleMute}
            onToggleMyList={handleToggleMyList}
            onShareEpisode={handleShareEpisode}
            onAwardCoinPot={handleAwardCoinPot}
            onMarkEpisodeWatched={handleMarkEpisodeWatched}
            onSwitchToHome={() => setActiveTab('watch')}
          />
        )}

        {activeTab === 'vault' && (
          <CheckInVaultTab
            privateState={privateProfile}
            sponsorAdUrl={appConfig.sponsorAdUrl}
            openedBoxesOverride={isCloudMode ? cloudOpenedBoxes : undefined}
            mysteryReveal={mysteryReveal}
            voucherModal={mysteryVoucherModal}
            players={leaderboard}
            currentUserId={currentPlayer.uid}
            poolPrizeZar={appConfig.poolPrizeZar}
            rolloverAmountZar={appConfig.rolloverAmountZar || 0}
            lastPoolWinnerSummary={appConfig.lastPoolWinnerSummary || ''}
            qualifiedCount={qualifiedCount}
            qualificationThreshold={qualificationThreshold}
            streakActivityDates={privateProfile.streakActivityDates || []}
            transactions={transactions}
            onSundayZeroTick={handleSundayZeroTick}
            onCompleteCheckIn={handleCompleteDailyCheckIn}
            onOpenMysteryBox={handleOpenMysteryBox}
            onDismissVoucherModal={() => setMysteryVoucherModal(null)}
          />
        )}

        {activeTab === 'me' && (
          <MeTab
            player={currentPlayer}
            privateState={privateProfile}
            episodes={episodes}
            myListSeriesIds={myListSeriesIds}
            qualificationThreshold={qualificationThreshold}
            poolPrizeZar={appConfig.poolPrizeZar}
            onUpdatePlayerName={handleUpdatePlayerName}
            onResetMyCoins={handleResetMyCoins}
            onToggleMyList={handleToggleMyList}
            onGoToHome={() => setActiveTab('watch')}
          />
        )}

        {/* Quiet Footer */}
        <footer className="pt-4 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-3 text-xs text-[#8D867A]">
          <span className="inline-flex items-center gap-1.5">
            <Crown className="w-3.5 h-3.5 text-[#D4AF37]" />
            <strong className="text-[#E8C96D]">{BRAND_NAME}</strong>
            <span>· Instant Play ({currentPlayer.username})</span>
          </span>
          <span className="font-mono-num text-[11px] text-[#7A746A]">
            Progress saved automatically
          </span>
        </footer>
      </main>

      {/* Fixed 4-Tab Bottom Navigation Bar */}
      <BottomNavBar activeTab={activeTab} onSelectTab={setActiveTab} />

      {/* Exclusive Gift Box Vault Modal (Header Gift Box icon opens ONLY this, never Daily Sign-In) */}
      {giftVaultModalOpen && (
        <div
          className="fixed inset-0 z-[65] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label="Secret Mystery Gift Vault"
          onClick={() => setGiftVaultModalOpen(false)}
        >
          <div
            className="relative w-full max-w-2xl my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setGiftVaultModalOpen(false)}
              aria-label="Close Gift Box Vault"
              className="absolute -top-3 -right-2 z-20 min-h-[44px] min-w-[44px] rounded-full bg-[#18181f] border border-white/20 text-white hover:bg-zinc-800 flex items-center justify-center shadow-xl cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <MysteryVaultCard
              highlightVault
              todayKey={getTodayDateKey()}
              privateState={privateProfile}
              openedBoxesOverride={isCloudMode ? cloudOpenedBoxes : undefined}
              mysteryReveal={mysteryReveal}
              voucherModal={mysteryVoucherModal}
              onOpenMysteryBox={handleOpenMysteryBox}
              onDismissVoucherModal={() => setMysteryVoucherModal(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <DramaWinApp />
    </ErrorBoundary>
  );
}
