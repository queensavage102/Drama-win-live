import React from 'react';
import { DramaEpisode, PlayerPrivate } from '../types';
import { SeriesFoldersSection } from './SeriesFoldersSection';

interface WatchTabProps {
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

export const WatchTab: React.FC<WatchTabProps> = ({
  sections,
  episodes,
  privateState,
  playerWeeklyCoins,
  playerTotalCoins,
  qualificationThreshold,
  muted,
  adPaused = false,
  embeddedAdHtml = '',
  onToggleMute,
  onAwardCoinPot,
}) => {
  return (
    <SeriesFoldersSection
      sections={sections}
      episodes={episodes}
      privateState={privateState}
      playerWeeklyCoins={playerWeeklyCoins}
      playerTotalCoins={playerTotalCoins}
      qualificationThreshold={qualificationThreshold}
      muted={muted}
      adPaused={adPaused}
      embeddedAdHtml={embeddedAdHtml}
      onToggleMute={onToggleMute}
      onAwardCoinPot={onAwardCoinPot}
    />
  );
};
