import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronRight, Clock, Film, FolderOpen, Layers, Play, X } from 'lucide-react';
import {
  DRAMA_CATEGORIES,
  getEpisodeSeriesId,
  getYouTubeThumbnailUrl,
  inferEpisodeCategory,
  isStrayGojoOrAnimeInWrongSeries,
  sanitizeMediaUrl,
  toSeriesId,
} from '../constants';
import { DramaEpisode, PlayerPrivate } from '../types';
import { resolveEpisodeCover } from '../utils/localState';
import { useResolvedMediaUrl } from '../utils/mediaStore';
import { EpisodeWatchScreen } from './EpisodeWatchScreen';

interface SeriesFoldersSectionProps {
  sections: string[];
  episodes: DramaEpisode[];
  privateState: PlayerPrivate;
  playerWeeklyCoins: number;
  playerTotalCoins: number;
  qualificationThreshold: number;
  muted: boolean;
  onToggleMute: () => void;
  onAwardCoinPot: (episode: DramaEpisode, amount: number) => Promise<void>;
  onMarkEpisodeWatched?: (episode: DramaEpisode) => Promise<void>;
}

interface SeriesFolderGroup {
  seriesId: string;
  seriesName: string;
  category: string;
  coverImage: string;
  synopsis: string;
  episodes: DramaEpisode[];
}

function containsJjkGojoRef(value?: string): boolean {
  const text = (value || '').toLowerCase();
  return text.includes('gojo') || text.includes('jujutsu') || text.includes('jjk');
}

function isSeriesJjkGojo(seriesName?: string): boolean {
  return containsJjkGojoRef(seriesName);
}

function isStrayJjkGojoEpisodeForSeries(ep: DramaEpisode, targetSeriesName: string): boolean {
  if (isSeriesJjkGojo(targetSeriesName)) return false;
  return (
    ep.id === 'jjk-gojo-special-01' ||
    isStrayGojoOrAnimeInWrongSeries(ep) ||
    containsJjkGojoRef(ep.series) ||
    containsJjkGojoRef(ep.title)
  );
}

function resolveIsolatedEpisodeCover(ep: DramaEpisode, seriesName: string): string {
  const raw = resolveEpisodeCover(ep);
  if (!raw) return '';
  if (!isSeriesJjkGojo(seriesName) && containsJjkGojoRef(raw)) {
    return '';
  }
  return raw;
}

const EpisodeCover: React.FC<{
  src: string;
  fallbackSrc?: string;
  alt: string;
  className?: string;
}> = ({
  src,
  fallbackSrc = '',
  alt,
  className = 'w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]',
}) => {
  const cleanSrc = sanitizeMediaUrl(src);
  const cleanFallback = sanitizeMediaUrl(fallbackSrc);
  const resolvedPrimary = useResolvedMediaUrl(cleanSrc);
  const [useFallback, setUseFallback] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setUseFallback(false);
    setFailed(false);
  }, [cleanSrc, resolvedPrimary, cleanFallback]);

  const activeSrc = useFallback && cleanFallback ? cleanFallback : resolvedPrimary || cleanFallback;

  if (failed || !activeSrc) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-[#1C1609] via-[#101015] to-[#08080A] flex flex-col items-center justify-center gap-2 p-4 text-center">
        <Film className="w-7 h-7 text-[#D4AF37]/70" />
        <span className="text-xs text-[#A69F91] line-clamp-1">{alt}</span>
      </div>
    );
  }

  return (
    <img
      key={activeSrc}
      src={activeSrc}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => {
        if (!useFallback && cleanFallback && activeSrc !== cleanFallback) {
          setUseFallback(true);
        } else {
          setFailed(true);
        }
      }}
      className={className}
    />
  );
};

const SeriesCard: React.FC<{
  group: SeriesFolderGroup;
  compact?: boolean;
  onOpen: (seriesId: string) => void;
}> = ({ group, compact = false, onOpen }) => {
  const firstVideoUrl = group.episodes
    .map((ep) => (ep.videoUrl || ep.youtubeUrl || '').trim())
    .find(Boolean);
  const rawYtThumb = firstVideoUrl ? getYouTubeThumbnailUrl(firstVideoUrl) || '' : '';
  const ytFallbackThumb =
    !isSeriesJjkGojo(group.seriesName) && containsJjkGojoRef(rawYtThumb) ? '' : rawYtThumb;

  return (
    <button
      type="button"
      onClick={() => onOpen(group.seriesId)}
      className={`group text-left obsidian-card rounded-2xl overflow-hidden hover:border-[#D4AF37]/55 transition-all active:scale-[0.99] flex flex-col cursor-pointer ${
        compact
          ? 'w-full min-w-full sm:w-[300px] sm:min-w-0 shrink-0 snap-center snap-always sm:snap-start'
          : 'w-full'
      }`}
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-[#0C0C10]">
        <EpisodeCover
          key={`${group.seriesId}::${group.coverImage}::${ytFallbackThumb}`}
          src={group.coverImage}
          fallbackSrc={ytFallbackThumb}
          alt={group.seriesName}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#09090D] via-black/40 to-transparent" />
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
          <span className="inline-flex items-center px-2 py-1 rounded-md bg-black/75 border border-[#D4AF37]/45 text-[11px] font-mono-num font-bold text-[#FCE7A2] backdrop-blur-sm">
            {group.episodes.length} {group.episodes.length === 1 ? 'Ep' : 'Eps'}
          </span>
          <span className="inline-flex items-center px-2 py-1 rounded-md bg-black/75 border border-white/15 text-[10px] font-semibold text-[#E8C96D] backdrop-blur-sm">
            {group.category}
          </span>
        </div>
        <div className="absolute bottom-3 left-3.5 right-3.5">
          <h3 className="text-base sm:text-lg font-display font-bold text-[#F6F2E9] truncate group-hover:text-[#FCE7A2] transition-colors">
            {group.seriesName}
          </h3>
        </div>
      </div>

      <div className="p-3.5 sm:p-4 flex-1 flex items-center justify-between gap-2.5">
        <p className="text-xs text-[#A69F91] line-clamp-2 leading-relaxed">{group.synopsis}</p>

        <span className="min-h-[38px] px-3 sm:px-3.5 rounded-xl gold-gradient-bg text-[#181307] font-bold text-xs inline-flex items-center justify-center gap-1 shrink-0 whitespace-nowrap shadow-md shadow-[#D4AF37]/20 group-hover:brightness-105">
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>Play &amp; Earn</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </span>
      </div>
    </button>
  );
};

export const SeriesFoldersSection: React.FC<SeriesFoldersSectionProps> = ({
  sections,
  episodes,
  privateState,
  playerWeeklyCoins,
  playerTotalCoins,
  qualificationThreshold,
  muted,
  onToggleMute,
  onAwardCoinPot,
  onMarkEpisodeWatched,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null);
  const [activePlayerEpisode, setActivePlayerEpisode] = useState<DramaEpisode | null>(null);

  const watchedEpisodeIdSet = useMemo(() => {
    const set = new Set<string>();
    (privateState?.watchedEpisodeIds || []).forEach((entry) => {
      if (typeof entry !== 'string') return;
      const clean = entry.trim();
      if (!clean) return;
      const sepIdx = clean.indexOf('::');
      set.add(sepIdx >= 0 ? clean.slice(0, sepIdx) : clean);
    });
    return set;
  }, [privateState?.watchedEpisodeIds]);

  // Build distinct Series folders keyed strictly by canonical seriesId
  const seriesGroups: SeriesFolderGroup[] = useMemo(() => {
    const map = new Map<string, { displayName: string; episodes: DramaEpisode[] }>();

    sections.forEach((secName) => {
      const clean = secName.trim().replace(/\s+/g, ' ');
      if (!clean) return;
      const sId = toSeriesId(clean);
      if (!map.has(sId)) {
        map.set(sId, { displayName: clean, episodes: [] });
      }
    });

    episodes.forEach((ep) => {
      if (!ep?.id || isStrayGojoOrAnimeInWrongSeries(ep)) return;
      const clean = (ep.series || '').trim().replace(/\s+/g, ' ') || 'Featured Series';
      const sId = getEpisodeSeriesId({ series: clean, seriesId: ep.seriesId });
      const entry = map.get(sId) || { displayName: clean, episodes: [] };
      if (!entry.episodes.some((existing) => existing.id === ep.id)) {
        entry.episodes.push(ep);
      }
      map.set(sId, entry);
    });

    return Array.from(map.entries()).map(([seriesId, { displayName, episodes: groupEps }]) => {
      const filteredEps = groupEps
        .filter((ep) => {
          return (
            getEpisodeSeriesId(ep) === seriesId &&
            !isStrayJjkGojoEpisodeForSeries(ep, displayName)
          );
        })
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

      const lead = filteredEps[0];
      const explicitCategory = filteredEps.map((ep) => ep.category?.trim()).find(Boolean);
      const category = inferEpisodeCategory(displayName, lead?.title, explicitCategory);
      const leadThumb =
        filteredEps.map((ep) => resolveIsolatedEpisodeCover(ep, displayName)).find(Boolean) || '';

      return {
        seriesId,
        seriesName: displayName,
        category,
        coverImage: leadThumb,
        synopsis:
          lead?.synopsis ||
          (filteredEps.length === 0
            ? 'Series folder ready — add episodes inside /admin.'
            : `${displayName} short-drama collection.`),
        episodes: filteredEps,
      };
    });
  }, [sections, episodes]);

  // Group series into clean ordered category buckets
  const categoryBuckets = useMemo(() => {
    const map = new Map<string, SeriesFolderGroup[]>();
    seriesGroups.forEach((group) => {
      const cat = group.category || 'Drama';
      const list = map.get(cat) || [];
      list.push(group);
      map.set(cat, list);
    });

    const knownOrder: string[] = [...DRAMA_CATEGORIES];
    const sortedKeys = Array.from(map.keys()).sort((a, b) => {
      const idxA = knownOrder.indexOf(a);
      const idxB = knownOrder.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });

    return sortedKeys.map((category) => ({
      category,
      groups: map.get(category) || [],
    }));
  }, [seriesGroups]);

  // Reset selectedCategory back to All if that category becomes empty after deletion
  useEffect(() => {
    if (
      selectedCategory !== 'All' &&
      !categoryBuckets.some((bucket) => bucket.category === selectedCategory)
    ) {
      setSelectedCategory('All');
    }
  }, [categoryBuckets, selectedCategory]);

  const activeSeriesGroup = useMemo(() => {
    if (!selectedSeriesId) return null;
    const baseGroup = seriesGroups.find((g) => g.seriesId === selectedSeriesId) || null;
    if (!baseGroup) return null;

    // Strictly filter & deduplicate episodes against the exact seriesId ONLY
    const seenIds = new Set<string>();
    const strictlyFiltered = episodes
      .filter((ep) => {
        if (!ep?.id || seenIds.has(ep.id)) return false;
        if (getEpisodeSeriesId(ep) !== baseGroup.seriesId) return false;
        if (isStrayJjkGojoEpisodeForSeries(ep, baseGroup.seriesName)) return false;
        seenIds.add(ep.id);
        return true;
      })
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

    return {
      ...baseGroup,
      episodes: strictlyFiltered,
    };
  }, [seriesGroups, selectedSeriesId, episodes]);

  // Lock background page scroll cleanly while the Episode Selection modal or player is open
  const isModalOpen = Boolean(activeSeriesGroup || activePlayerEpisode);
  useEffect(() => {
    if (!isModalOpen || typeof document === 'undefined') return;

    const htmlEl = document.documentElement;
    const bodyEl = document.body;
    const prevHtmlOverflow = htmlEl.style.overflow;
    const prevBodyOverflow = bodyEl.style.overflow;
    const prevBodyOverscroll = bodyEl.style.overscrollBehavior;

    htmlEl.style.overflow = 'hidden';
    bodyEl.style.overflow = 'hidden';
    bodyEl.style.overscrollBehavior = 'none';

    return () => {
      htmlEl.style.overflow = prevHtmlOverflow;
      bodyEl.style.overflow = prevBodyOverflow;
      bodyEl.style.overscrollBehavior = prevBodyOverscroll;
    };
  }, [isModalOpen]);

  // Allow closing Episode Selection modal with Escape when player is not open
  useEffect(() => {
    if (!activeSeriesGroup || activePlayerEpisode) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedSeriesId(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeSeriesGroup, activePlayerEpisode]);

  const activeCategoryBucket = useMemo(
    () => categoryBuckets.find((b) => b.category === selectedCategory) || null,
    [categoryBuckets, selectedCategory]
  );

  return (
    <>
      <section className="space-y-4">
        <div className="flex items-baseline justify-between gap-3 px-1">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-[#D4AF37]" />
            <h2 className="text-xl sm:text-2xl font-display font-bold text-[#F6F2E9]">
              Browse by Genre
            </h2>
          </div>
          <span className="font-mono-num text-xs text-[#A69F91]">
            {seriesGroups.length} {seriesGroups.length === 1 ? 'Series' : 'Series'}
          </span>
        </div>

        {/* Clean Scrollable Category Tabs (All + active genres like Horror, Anime, Comedy, Drama) */}
        {seriesGroups.length > 0 && (
          <div
            role="tablist"
            aria-label="Filter series by genre"
            className="flex items-center gap-2 overflow-x-auto pb-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={selectedCategory === 'All'}
              onClick={() => setSelectedCategory('All')}
              className={`min-h-[38px] px-3.5 rounded-xl border text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                selectedCategory === 'All'
                  ? 'gold-gradient-bg border-[#FCE7A2] text-[#181307] shadow-sm shadow-[#D4AF37]/25'
                  : 'bg-[#101015] border-white/[0.1] text-[#C4BDB0] hover:text-[#F6F2E9] hover:border-[#D4AF37]/40'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>All Genres</span>
              <span className="font-mono-num text-[11px] opacity-80">({seriesGroups.length})</span>
            </button>

            {categoryBuckets.map((bucket) => {
              const isSelected = selectedCategory === bucket.category;
              return (
                <button
                  key={bucket.category}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setSelectedCategory(bucket.category)}
                  className={`min-h-[38px] px-3.5 rounded-xl border text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                    isSelected
                      ? 'gold-gradient-bg border-[#FCE7A2] text-[#181307] shadow-sm shadow-[#D4AF37]/25'
                      : 'bg-[#101015] border-white/[0.1] text-[#C4BDB0] hover:text-[#F6F2E9] hover:border-[#D4AF37]/40'
                  }`}
                >
                  <span>{bucket.category}</span>
                  <span className="font-mono-num text-[11px] opacity-80">
                    ({bucket.groups.length})
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {seriesGroups.length === 0 ? (
          <div className="obsidian-card rounded-2xl p-8 text-center space-y-2">
            <Film className="w-8 h-8 text-[#D4AF37]/60 mx-auto" />
            <p className="text-sm font-medium text-[#F6F2E9]">No series folders created yet</p>
            <p className="text-xs text-[#A69F91]">
              Create series and publish episodes inside /admin to see them here.
            </p>
          </div>
        ) : selectedCategory === 'All' ? (
          /* Clean Separate Category Rows (compact horizontal shelves prevent vertical crowding) */
          <div className="space-y-6">
            {categoryBuckets.map((bucket) => (
              <div key={bucket.category} className="space-y-2.5">
                <div className="flex items-center justify-between gap-2 px-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-1.5 h-5 rounded-full gold-gradient-bg shrink-0" />
                    <h3 className="text-base sm:text-lg font-display font-bold text-[#F6F2E9] truncate">
                      {bucket.category}
                    </h3>
                    <span className="font-mono-num text-[11px] text-[#8D867A]">
                      ({bucket.groups.length})
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedCategory(bucket.category)}
                    className="text-xs font-semibold text-[#E8C96D] hover:text-[#FCE7A2] inline-flex items-center gap-0.5 shrink-0 cursor-pointer"
                  >
                    <span>View {bucket.category}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="w-full flex gap-4 sm:gap-3.5 overflow-x-auto pb-2 snap-x snap-mandatory scroll-smooth">
                  {bucket.groups.map((group) => (
                    <SeriesCard
                      key={group.seriesId}
                      group={group}
                      compact
                      onOpen={setSelectedSeriesId}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Filtered Single-Genre Grid View */
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(activeCategoryBucket?.groups || []).map((group) => (
                <SeriesCard
                  key={group.seriesId}
                  group={group}
                  onOpen={setSelectedSeriesId}
                />
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Centered Episode Selection Modal with locked background scroll and clean mobile spacing */}
      {activeSeriesGroup && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={activeSeriesGroup.seriesName}
          className="fixed inset-0 z-[55] bg-black/80 backdrop-blur-sm flex items-center justify-center px-3.5 py-4 pb-20 sm:p-6 overscroll-none"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedSeriesId(null);
            }
          }}
        >
          <div
            key={activeSeriesGroup.seriesId}
            className="w-full max-w-2xl max-h-[84dvh] sm:max-h-[82dvh] bg-[#0B0B0F] border border-[#D4AF37]/40 rounded-2xl flex flex-col overflow-hidden shadow-[0_24px_64px_rgba(0,0,0,0.92)]"
          >
            <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-white/[0.08] flex items-center justify-between gap-3 shrink-0 bg-[#0D0D13]">
              <div className="min-w-0">
                <p className="text-[11px] sm:text-xs font-mono-num text-[#E8C96D]">
                  {activeSeriesGroup.category} · {activeSeriesGroup.episodes.length}{' '}
                  {activeSeriesGroup.episodes.length === 1 ? 'Episode' : 'Episodes'} · Watch &amp; fill Coin Pot
                </p>
                <h2 className="text-base sm:text-xl font-display font-bold text-[#F6F2E9] truncate">
                  {activeSeriesGroup.seriesName}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setSelectedSeriesId(null)}
                aria-label="Close series drawer"
                className="min-h-[42px] min-w-[42px] rounded-xl border border-white/[0.12] flex items-center justify-center text-[#A69F91] hover:text-[#F6F2E9] hover:border-[#D4AF37]/45 shrink-0 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {activeSeriesGroup.episodes.length === 0 ? (
              <div className="p-6 sm:p-8 text-center space-y-2">
                <Film className="w-8 h-8 text-[#D4AF37]/60 mx-auto" />
                <p className="text-sm font-semibold text-[#F6F2E9]">No episodes in this folder yet</p>
                <p className="text-xs text-[#A69F91]">
                  Open /admin and select &ldquo;{activeSeriesGroup.seriesName}&rdquo; to publish episodes here.
                </p>
              </div>
            ) : (
              <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain scroll-smooth p-3.5 sm:p-5 space-y-3">
                {activeSeriesGroup.episodes.map((episode) => {
                  const coverSrc = resolveIsolatedEpisodeCover(
                    episode,
                    activeSeriesGroup.seriesName
                  );
                  const epVideo = (episode.videoUrl || episode.youtubeUrl || '').trim();
                  const rawYtFallback = epVideo ? getYouTubeThumbnailUrl(epVideo) || '' : '';
                  const ytFallback =
                    !isSeriesJjkGojo(activeSeriesGroup.seriesName) &&
                    containsJjkGojoRef(rawYtFallback)
                      ? ''
                      : rawYtFallback;
                  const potAward = Math.max(100, Math.min(300, episode.rewardCoins || 100));
                  const isWatched = watchedEpisodeIdSet.has(episode.id);

                  return (
                    <button
                      key={episode.id}
                      type="button"
                      onClick={() => setActivePlayerEpisode(episode)}
                      className={`w-full text-left group p-3 sm:p-3.5 rounded-xl bg-[#121218] border hover:border-[#D4AF37]/45 hover:bg-[#16161E] active:scale-[0.995] flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 transition-all cursor-pointer ${
                        isWatched ? 'border-emerald-500/25' : 'border-white/[0.08]'
                      }`}
                    >
                      <div className="relative w-full sm:w-40 aspect-video rounded-lg overflow-hidden bg-[#08080C] border border-white/[0.08] shrink-0">
                        <EpisodeCover
                          key={`${episode.id}::${coverSrc}::${ytFallback}`}
                          src={coverSrc}
                          fallbackSrc={ytFallback}
                          alt={episode.title}
                        />
                        {isWatched && (
                          <span
                            title="Watched"
                            aria-label="Watched"
                            className="absolute top-2 right-2 z-10 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/75 border border-emerald-400/50 text-emerald-300 backdrop-blur-sm shadow-sm"
                          >
                            <Check className="w-3 h-3 stroke-[2.75]" />
                            <span className="text-[10px] font-semibold tracking-tight leading-none">
                              Watched
                            </span>
                          </span>
                        )}
                        <div className="absolute inset-0 bg-black/25 flex items-center justify-center">
                          <span className="w-9 h-9 rounded-full bg-black/70 border border-[#D4AF37]/60 flex items-center justify-center text-[#FCE7A2]">
                            <Play className="w-4 h-4 fill-current ml-0.5" />
                          </span>
                        </div>
                      </div>

                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-mono-num font-semibold text-[#E8C96D] truncate">
                            {episode.episodeLabel}
                          </span>
                          <span className="font-mono-num font-bold text-[#FCE7A2] shrink-0">
                            +{potAward} Coins / Pot
                          </span>
                        </div>

                        <h3 className="text-sm sm:text-base font-display font-bold text-[#F6F2E9] group-hover:text-[#FCE7A2] transition-colors line-clamp-1">
                          {episode.title}
                        </h3>

                        <p className="text-xs text-[#A69F91] line-clamp-2 leading-relaxed">
                          {episode.synopsis}
                        </p>

                        <div className="pt-1 flex items-center justify-between text-[11px] text-[#8D867A]">
                          <span className="inline-flex items-center gap-1 font-mono-num">
                            <Clock className="w-3.5 h-3.5 text-[#D4AF37]" />
                            {episode.duration}
                          </span>
                          <span className="inline-flex items-center gap-1 font-semibold text-[#E8C96D]">
                            <span>Watch Now</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Clean Fullscreen Episode Watch Screen */}
      {activePlayerEpisode && (
        <EpisodeWatchScreen
          key={activePlayerEpisode.id}
          episode={
            episodes.find((ep) => ep.id === activePlayerEpisode.id) || activePlayerEpisode
          }
          playerWeeklyCoins={playerWeeklyCoins}
          playerTotalCoins={playerTotalCoins}
          qualificationThreshold={qualificationThreshold}
          muted={muted}
          onToggleMute={onToggleMute}
          onAwardCoinPot={onAwardCoinPot}
          onMarkEpisodeWatched={onMarkEpisodeWatched}
          onClose={() => setActivePlayerEpisode(null)}
        />
      )}
    </>
  );
};
