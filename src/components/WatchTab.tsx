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
  onToggleMute: () => void;
  onAwardCoinPot: (episode: DramaEpisode, amount: number) => Promise<void>;
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
  onToggleMute,
  onAwardCoinPot,
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
      onToggleMute={onToggleMute}
      onAwardCoinPot={onAwardCoinPot}
      onClaimHeroBonus={onClaimHeroBonus}
      onMarkEpisodeWatched={onMarkEpisodeWatched}
    />
  );
};
