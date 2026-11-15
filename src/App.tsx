import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { User, onAuthStateChanged, signInWithPopup } from 'firebase/auth';
import { AlertTriangle, Crown, Flame, X } from 'lucide-react';
import { AdminBoardPage, AdminEpisodeFormInput } from './components/AdminBoardPage';
import { BottomAdBanner } from './components/BottomAdBanner';
import { CheckInVaultTab } from './components/CheckInVaultTab';
import { ConfettiExplosion } from './components/ConfettiExplosion';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LeaderboardTab } from './components/LeaderboardTab';
import { MeTab } from './components/MeTab';
import { MysteryRevealState } from './components/MysteryVaultCard';
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
  forceSaveDefaultEpisodesToLocalStorage,
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
  awardWatchPotCoins,
  claimMysteryBox,
  claimStreakDay,
  deleteDramaEpisode,
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
  subscribeTransactions,
  unlockAdminAccess,
  updateDramaEpisode,
  updateEmbeddedAdHtml,
  updateLiveTickerConfig,
  updateMysteryAndRolloverConfig,
  updateSponsorAdUrl,
} from './services/dramawinService';
import {
  AppConfig,
  AppTab,
  CoinTransaction,
  DramaEpisode,
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
  loadLocalAppConfig,
  loadLocalEpisodes,
  loadLocalLeaderboard,
  loadLocalMysteryWinners,
  loadLocalSections,
  loadLocalTransactions,
  renameLocalSection,
  reorderLocalSeries,
  resetLocalPlayerCoins,
  saveLocalAppConfig,
  saveLocalEpisodes,
  saveLocalSection,
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
  const [cloudAppConfig, setCloudAppConfig] = useState<AppConfig | null>(null);
  const [cloudWinners, setCloudWinners] = useState<MysteryWinnerRecord[]>([]);
  const [cloudTransactions, setCloudTransactions] = useState<CoinTransaction[]>([]);

  const [localLeaderboard, setLocalLeaderboard] = useState<LeaderboardPlayer[]>(() =>
    loadLocalLeaderboard(initialSession.player)
  );
  const [localEpisodes, setLocalEpisodes] = useState<DramaEpisode[]>(initialEpisodes);
  const [sections, setSections] = useState<string[]>(() => loadLocalSections(initialEpisodes));
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
    () => (isCloudMode ? cloudLeaderboard : localLeaderboard),
    [isCloudMode, cloudLeaderboard, localLeaderboard]
  );

  const episodes: DramaEpisode[] = useMemo(() => {
    const rawBase = cloudEpisodes.length > 0 ? cloudEpisodes : localEpisodes;
    return rawBase
      .filter((ep) => !isLegacyBrokenEpisode(ep))
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }, [cloudEpisodes, localEpisodes]);

  const appConfig: AppConfig = useMemo(
    () => (cloudAppConfig ? cloudAppConfig : localAppConfig),
    [cloudAppConfig, localAppConfig]
  );

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

  // Always subscribe to public Firestore appConfig and episodes for ALL visitors (zero auth wall)
  useEffect(() => {
    const unsubConfig = subscribeAppConfig(
      (cfg) => {
        const normalized: AppConfig = {
          ...cfg,
          sponsorAdUrl: cfg.sponsorAdUrl?.trim() || DEFAULT_SPONSOR_URL,
        };
        setCloudAppConfig(normalized);
        setLocalAppConfig(saveLocalAppConfig(normalized));
      },
      () => {
        // Keep local fallback active if Firestore is unreachable
      }
    );

    const unsubEpisodes = subscribeEpisodes(
      (items) => {
        const clean = items.filter((ep) => !isLegacyBrokenEpisode(ep));
        setCloudEpisodes(clean);
        if (clean.length > 0) {
          const synced = saveLocalEpisodes(clean);
          setLocalEpisodes(synced);
          setSections(loadLocalSections(synced));
        }
      },
      () => {
        // Keep local fallback active if Firestore is unreachable
      }
    );

    return () => {
      unsubConfig();
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

    if (cloudNow && firebaseUser) {
      const nextOpened = Array.from(new Set([...cloudOpenedBoxes, boxNumber]));
      setCloudOpenedBoxes(nextOpened);
      writeCloudOpenedBoxes(firebaseUser.uid, todayKey, nextOpened);

      setMysteryReveal({
        dateKey: todayKey,
        boxNumber,
        kind: 'coins',
      });
      showToast('Oops! Sorry, try the next box 😢');

      if (priv.lastMysteryPickDate !== todayKey) {
        void claimMysteryBox(player, priv, boxNumber, false, latestCfg)
          .then((result) => {
            setMysteryReveal({
              dateKey: todayKey,
              boxNumber,
              kind: result.outcome.kind,
              coins: result.outcome.coins,
              winnerRecord: result.winnerRecord,
              newPoolPrizeZar: result.newPoolPrizeZar,
            });
            if (result.outcome.kind === 'coins') {
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
          })
          .catch(() => {
            // Box already marked opened and message displayed on screen
          });
      }
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

      if (result.outcome.kind === 'coins') {
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
        showToast(`+${reward} Coins Added! ${dayKey} check-in complete`, reward);
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
    showToast(`+${reward} Coins Added! ${dayKey} check-in complete`, reward);
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

      const safeAmount = Math.max(100, Math.min(300, Math.round(amount)));
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
        showToast(`+${safeAmount} Coins from Coin Pot!`, safeAmount);
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
      showToast(`+${safeAmount} Coins from Coin Pot!`, safeAmount);
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

  const handleCreateSection = (name: string) => {
    saveLocalSection(name);
    setSections(loadLocalSections(episodes));
  };

  const handleRenameSection = async (oldName: string, newName: string) => {
    const cleanNew = newName.trim().slice(0, 60);
    if (!cleanNew || cleanNew === oldName) return;
    const result = renameLocalSection(oldName, cleanNew);
    setLocalEpisodes(result.episodes);
    setSections(result.sections);

    const activeUser = await ensureFirebaseAdminGrant();
    if (activeUser) {
      const targetSeriesId = toSeriesId(cleanNew);
      const oldSeriesId = toSeriesId(oldName);
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
          sortOrder: ep.sortOrder,
        });
      }
    }
  };

  const handleDeleteSection = async (name: string, removeEpisodes = true) => {
    const matching = (cloudEpisodes.length > 0 ? cloudEpisodes : episodes).filter(
      (ep) => ep.series === name
    );
    const result = deleteLocalSection(name, removeEpisodes);
    setLocalEpisodes(result.episodes);
    setSections(result.sections);

    const activeUser = await ensureFirebaseAdminGrant();
    if (activeUser && removeEpisodes) {
      for (const ep of matching) {
        await deleteDramaEpisode(ep.id);
      }
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
    const normalizedInput: AdminEpisodeFormInput & { sortOrder: number; id: string } = {
      ...input,
      id: episodeId,
      seriesId: getEpisodeSeriesId({ series: input.series, seriesId: input.seriesId }),
      category: inferEpisodeCategory(input.series, input.title, input.category),
    };
    const nextList = addLocalEpisode(normalizedInput);
    setLocalEpisodes(nextList);
    setSections(loadLocalSections(nextList));

    const activeUser = await ensureFirebaseAdminGrant();
    if (activeUser) {
      await addDramaEpisode(normalizedInput);
    }
  };

  const handleUpdateEpisode = async (episodeId: string, input: AdminEpisodeFormInput) => {
    const normalizedInput: AdminEpisodeFormInput = {
      ...input,
      seriesId: getEpisodeSeriesId({ series: input.series, seriesId: input.seriesId }),
      category: inferEpisodeCategory(input.series, input.title, input.category),
    };
    const nextList = updateLocalEpisode(episodeId, normalizedInput);
    setLocalEpisodes(nextList);
    setSections(loadLocalSections(nextList));
    const matchedSortOrder =
      nextList.find((ep) => ep.id === episodeId)?.sortOrder ??
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
    const nextList = deleteLocalEpisode(episodeId);
    setLocalEpisodes(nextList);
    setSections(loadLocalSections(nextList));

    const activeUser = await ensureFirebaseAdminGrant();
    if (activeUser) {
      await deleteDramaEpisode(episodeId);
    }
  };

  const handleReorderSeries = async (orderedSeriesNames: string[]) => {
    const result = reorderLocalSeries(orderedSeriesNames);
    setSections(result.sections);
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
    setSections(loadLocalSections(cleared));

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
    <div className="min-h-screen bg-[#070709] text-[#F6F2E9] pb-20">
      {!splashDone && <VipSplashScreen onComplete={() => setSplashDone(true)} />}

      <ConfettiExplosion
        active={confettiActive}
        onComplete={() => setConfettiActive(false)}
      />

      <TopHeader
        coins={currentPlayer.coins}
        sundayBonusZar={sundayBonusZar}
        muted={muted}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onToggleMute={handleToggleMute}
        onOpenAdmin={navigateToAdmin}
      />

      {/* Toast Confirmation / Daily Streak Reminder / Red Anti-Cheat Warning */}
      {toast && (
        <div className="fixed top-[108px] left-1/2 -translate-x-1/2 z-[80] px-4 w-full max-w-md pointer-events-none">
          <div
            role="status"
            aria-live="polite"
            className={`pointer-events-auto rounded-xl px-4 py-3 shadow-2xl border flex items-center justify-between gap-2.5 ${
              toast.tone === 'error'
                ? 'bg-red-950/95 border-red-500/80 text-red-100 shadow-red-950/60'
                : toast.tone === 'reminder'
                  ? 'bg-[#121218]/95 backdrop-blur-md border-[#D4AF37]/45 text-[#F6F2E9] shadow-black/70'
                  : toast.tone === 'neutral'
                    ? 'bg-[#14141A]/95 border-white/15 text-[#F6F2E9]'
                    : 'gold-gradient-bg border-[#FCE7A2] text-[#181307] shadow-[#D4AF37]/30'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {toast.coinsAwarded && (
                <RealisticGoldCoin sizePx={48} emblem="$" className="shrink-0" />
              )}
              {toast.tone === 'error' && (
                <AlertTriangle className="w-4 h-4 text-red-300 shrink-0" />
              )}
              {toast.tone === 'reminder' && (
                <Flame className="w-4 h-4 text-[#D4AF37] shrink-0" />
              )}
              <span className="text-xs sm:text-sm font-semibold leading-snug">
                {toast.message}
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {toast.coinsAwarded && (
                <span className="font-mono-num text-xs font-bold bg-[#181307] text-[#FCE7A2] px-2.5 py-0.5 rounded-md">
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

      {/* Main Content — Strict Conditional Rendering per Top Navigation Tab */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-5 space-y-6">
        {activeTab === 'watch' && (
          <WatchTab
            sections={sections}
            episodes={episodes}
            privateState={privateProfile}
            playerWeeklyCoins={currentPlayer.weeklyCoins}
            playerTotalCoins={currentPlayer.coins}
            qualificationThreshold={qualificationThreshold}
            muted={muted}
            onToggleMute={handleToggleMute}
            onAwardCoinPot={handleAwardCoinPot}
            onMarkEpisodeWatched={handleMarkEpisodeWatched}
          />
        )}

        {activeTab === 'vault' && (
          <CheckInVaultTab
            privateState={privateProfile}
            openedBoxesOverride={isCloudMode ? cloudOpenedBoxes : undefined}
            mysteryReveal={mysteryReveal}
            voucherModal={mysteryVoucherModal}
            onCompleteCheckIn={handleCompleteDailyCheckIn}
            onOpenMysteryBox={handleOpenMysteryBox}
            onDismissVoucherModal={() => setMysteryVoucherModal(null)}
          />
        )}

        {activeTab === 'leaderboard' && (
          <LeaderboardTab
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
          />
        )}

        {activeTab === 'me' && (
          <MeTab
            player={currentPlayer}
            privateState={privateProfile}
            qualificationThreshold={qualificationThreshold}
            poolPrizeZar={appConfig.poolPrizeZar}
            onUpdatePlayerName={handleUpdatePlayerName}
            onResetMyCoins={handleResetMyCoins}
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

      {/* Fixed 320x50 Bottom Ad Banner */}
      <BottomAdBanner />
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
