import React, { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Clock, Film, FolderOpen, Play, X } from 'lucide-react';
import { getYouTubeThumbnailUrl, sanitizeMediaUrl } from '../constants';
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
  adPaused?: boolean;
  embeddedAdHtml?: string;
  onToggleMute: () => void;
  onAwardCoinPot: (episode: DramaEpisode, amount: number) => Promise<void>;
}

interface SeriesFolderGroup {
  seriesName: string;
  coverImage: string;
  synopsis: string;
  episodes: DramaEpisode[];
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
  }, [resolvedPrimary, cleanFallback]);

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

export const SeriesFoldersSection: React.FC<SeriesFoldersSectionProps> = ({
  sections,
  episodes,
  playerWeeklyCoins,
  playerTotalCoins,
  qualificationThreshold,
  muted,
  adPaused = false,
  embeddedAdHtml = '',
  onToggleMute,
  onAwardCoinPot,
}) => {
  const [selectedSeriesName, setSelectedSeriesName] = useState<string | null>(null);
  const [activePlayerEpisode, setActivePlayerEpisode] = useState<DramaEpisode | null>(null);

  // Build distinct Series folders from all manually created sections + episode series names
  const seriesGroups: SeriesFolderGroup[] = useMemo(() => {
    const map = new Map<string, DramaEpisode[]>();

    sections.forEach((secName) => {
      const clean = secName.trim();
      if (clean && !map.has(clean)) {
        map.set(clean, []);
      }
    });

    episodes.forEach((ep) => {
      const key = ep.series?.trim() || 'Featured Series';
      const existing = map.get(key) || [];
      existing.push(ep);
      map.set(key, existing);
    });

    return Array.from(map.entries()).map(([seriesName, groupEps]) => {
      const sorted = [...groupEps].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
      const lead = sorted[0];
      // Strictly resolve series folder cover ONLY from episodes in THIS folder
      const leadThumb = sorted.map((ep) => resolveEpisodeCover(ep)).find(Boolean) || '';

      return {
        seriesName,
        coverImage: leadThumb,
        synopsis:
          lead?.synopsis ||
          (sorted.length === 0
            ? 'Series folder ready — add episodes inside /admin.'
            : `${seriesName} short-drama collection.`),
        episodes: sorted,
      };
    });
  }, [sections, episodes]);

  const activeSeriesGroup = useMemo(
    () => seriesGroups.find((g) => g.seriesName === selectedSeriesName) || null,
    [seriesGroups, selectedSeriesName]
  );

  return (
    <>
      <section className="space-y-4">
        <div className="flex items-baseline justify-between gap-3 px-1">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-[#D4AF37]" />
            <h2 className="text-xl sm:text-2xl font-display font-bold text-[#F6F2E9]">
              Drama Series Folders
            </h2>
          </div>
          <span className="font-mono-num text-xs text-[#A69F91]">
            {seriesGroups.length} {seriesGroups.length === 1 ? 'Series' : 'Series'}
          </span>
        </div>

        {seriesGroups.length === 0 ? (
          <div className="obsidian-card rounded-2xl p-8 text-center space-y-2">
            <Film className="w-8 h-8 text-[#D4AF37]/60 mx-auto" />
            <p className="text-sm font-medium text-[#F6F2E9]">No series folders created yet</p>
            <p className="text-xs text-[#A69F91]">
              Create series and publish episodes inside /admin to see them here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {seriesGroups.map((group) => {
              const firstVideoUrl = group.episodes
                .map((ep) => (ep.videoUrl || ep.youtubeUrl || '').trim())
                .find(Boolean);
              const ytFallbackThumb = firstVideoUrl
                ? getYouTubeThumbnailUrl(firstVideoUrl) || ''
                : '';

              return (
              <button
                key={group.seriesName}
                type="button"
                onClick={() => setSelectedSeriesName(group.seriesName)}
                className="group w-full text-left obsidian-card rounded-2xl overflow-hidden hover:border-[#D4AF37]/55 transition-all active:scale-[0.99] flex flex-col cursor-pointer"
              >
                <div className="relative aspect-[16/9] w-full overflow-hidden bg-[#0C0C10]">
                  <EpisodeCover
                    src={group.coverImage}
                    fallbackSrc={ytFallbackThumb}
                    alt={group.seriesName}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#09090D] via-black/40 to-transparent" />
                  <div className="absolute top-3 left-3 flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/75 border border-[#D4AF37]/45 text-[11px] font-mono-num font-bold text-[#FCE7A2] backdrop-blur-sm">
                      {group.episodes.length}{' '}
                      {group.episodes.length === 1 ? 'Episode' : 'Episodes'}
                    </span>
                  </div>
                  <div className="absolute bottom-3.5 left-4 right-4">
                    <h3 className="text-lg sm:text-xl font-display font-bold text-[#F6F2E9] truncate group-hover:text-[#FCE7A2] transition-colors">
                      {group.seriesName}
                    </h3>
                  </div>
                </div>

                <div className="p-4 flex-1 flex items-center justify-between gap-3">
                  <p className="text-xs text-[#A69F91] line-clamp-2 leading-relaxed">
                    {group.synopsis}
                  </p>

                  <span className="min-h-[42px] px-4 rounded-xl gold-gradient-bg text-[#181307] font-bold text-xs inline-flex items-center justify-center gap-1.5 shrink-0 whitespace-nowrap shadow-md shadow-[#D4AF37]/20 group-hover:brightness-105">
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Play &amp; Earn</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Centered Series Folder Episode Modal (leaves bottom 320x50 ad banner unobstructed) */}
      {activeSeriesGroup && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={activeSeriesGroup.seriesName}
          className="fixed inset-0 z-[55] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 pb-20 sm:p-6"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedSeriesName(null);
            }
          }}
        >
          <div className="w-full max-w-2xl max-h-[74vh] sm:max-h-[82vh] bg-[#0B0B0F] border border-[#D4AF37]/40 rounded-2xl flex flex-col overflow-hidden shadow-[0_24px_64px_rgba(0,0,0,0.9)]">

            <div className="px-5 sm:px-6 py-4 border-b border-white/[0.08] flex items-center justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <p className="text-xs font-mono-num text-[#E8C96D]">
                  {activeSeriesGroup.episodes.length}{' '}
                  {activeSeriesGroup.episodes.length === 1 ? 'Episode' : 'Episodes'} · Watch &amp; fill Coin Pot
                </p>
                <h2 className="text-lg sm:text-xl font-display font-bold text-[#F6F2E9] truncate">
                  {activeSeriesGroup.seriesName}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setSelectedSeriesName(null)}
                aria-label="Close series drawer"
                className="min-h-[44px] min-w-[44px] rounded-xl border border-white/[0.12] flex items-center justify-center text-[#A69F91] hover:text-[#F6F2E9] hover:border-[#D4AF37]/45 shrink-0 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {activeSeriesGroup.episodes.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <Film className="w-8 h-8 text-[#D4AF37]/60 mx-auto" />
                <p className="text-sm font-semibold text-[#F6F2E9]">No episodes in this folder yet</p>
                <p className="text-xs text-[#A69F91]">
                  Open /admin and select &ldquo;{activeSeriesGroup.seriesName}&rdquo; to publish episodes here.
                </p>
              </div>
            ) : (
              <div className="p-4 sm:p-6 overflow-y-auto divide-y divide-white/[0.07]">
                {activeSeriesGroup.episodes.map((episode) => {
                  const coverSrc = resolveEpisodeCover(episode);
                  const epVideo = (episode.videoUrl || episode.youtubeUrl || '').trim();
                  const ytFallback = epVideo ? getYouTubeThumbnailUrl(epVideo) || '' : '';
                  const potAward = Math.max(100, Math.min(300, episode.rewardCoins || 100));

                  return (
                    <button
                      key={episode.id}
                      type="button"
                      onClick={() => setActivePlayerEpisode(episode)}
                      className="w-full text-left group py-4 first:pt-1 last:pb-1 flex flex-col sm:flex-row sm:items-center gap-4 hover:bg-white/[0.02] rounded-xl px-2 -mx-2 transition-colors cursor-pointer"
                    >
                      <div className="relative w-full sm:w-40 aspect-video rounded-xl overflow-hidden bg-[#0C0C10] border border-white/[0.08] shrink-0">
                        <EpisodeCover
                          src={coverSrc}
                          fallbackSrc={ytFallback}
                          alt={episode.title}
                        />
                        <div className="absolute inset-0 bg-black/25 flex items-center justify-center">
                          <span className="w-9 h-9 rounded-full bg-black/70 border border-[#D4AF37]/60 flex items-center justify-center text-[#FCE7A2]">
                            <Play className="w-4 h-4 fill-current ml-0.5" />
                          </span>
                        </div>
                      </div>

                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-mono-num font-semibold text-[#E8C96D]">
                            {episode.episodeLabel}
                          </span>
                          <span className="font-mono-num font-bold text-[#FCE7A2]">
                            +{potAward} Coins / Pot
                          </span>
                        </div>

                        <h3 className="text-sm sm:text-base font-display font-bold text-[#F6F2E9] group-hover:text-[#FCE7A2] transition-colors">
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
          adPaused={adPaused}
          embeddedAdHtml={embeddedAdHtml}
          onToggleMute={onToggleMute}
          onAwardCoinPot={onAwardCoinPot}
          onClose={() => setActivePlayerEpisode(null)}
        />
      )}
    </>
  );
};
