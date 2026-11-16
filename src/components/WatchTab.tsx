import React from 'react';
import { DramaEpisode, PlayerPrivate } from '../types';
import { SeriesFoldersSection } from './SeriesFoldersSection';

interface WatchTabProps {
  sections: string[];
  episodes: DramaEpisode[];
  privateState: PlayerPrivate;
  sponsorAdUrl?: string;
  playerWeeklyCoins: number;
  playerTotalCoins: number;
  qualificationThreshold: number;
  muted: boolean;
  resumePlaybackSignal?: number;
  onToggleMute: () => void;
  onAwardCoinPot: (episode: DramaEpisode, amount: number) => Promise<void>;
  onStartSponsorReward?: (rewardAction?: () => Promise<void>) => void;
  onClaimHeroBonus?: () => Promise<void>;
  onMarkEpisodeWatched?: (episode: DramaEpisode) => Promise<void>;
}

export const WatchTab: React.FC<WatchTabProps> = ({
  sections,
  episodes,
  privateState,
  sponsorAdUrl,
  playerWeeklyCoins,
  playerTotalCoins,
  qualificationThreshold,
  muted,
  resumePlaybackSignal,
  onToggleMute,
  onAwardCoinPot,
  onStartSponsorReward,
  onClaimHeroBonus,
  onMarkEpisodeWatched,
}) => {
  return (
    <SeriesFoldersSection
      sections={sections}
      episodes={episodes}
      privateState={privateState}
      sponsorAdUrl={sponsorAdUrl}
      playerWeeklyCoins={playerWeeklyCoins}
      playerTotalCoins={playerTotalCoins}
      qualificationThreshold={qualificationThreshold}
      muted={muted}
      resumePlaybackSignal={resumePlaybackSignal}
      onToggleMute={onToggleMute}
      onAwardCoinPot={onAwardCoinPot}
      onStartSponsorReward={onStartSponsorReward}
      onClaimHeroBonus={onClaimHeroBonus}
      onMarkEpisodeWatched={onMarkEpisodeWatched}
    />
  );
};
