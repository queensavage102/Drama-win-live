import React from 'react';
import { getTodayDateKey } from '../constants';
import {
  MysteryWinnerRecord,
  PlayerPrivate,
  WeekDayKey,
} from '../types';
import { DailyCheckInBox } from './DailyCheckInBox';
import { MysteryRevealState, MysteryVaultCard } from './MysteryVaultCard';

interface CheckInVaultTabProps {
  privateState: PlayerPrivate;
  sponsorAdUrl: string;
  pendingMysteryBoxNumber: number | null;
  mysteryReveal: MysteryRevealState | null;
  voucherModal: {
    winner: MysteryWinnerRecord;
    newPoolPrizeZar?: number;
  } | null;
  onCompleteCheckIn: (dayKey: WeekDayKey, rewardCoins: number) => Promise<void>;
  onStartMysteryBoxSponsor: (boxNumber: number, paidWithCoins: boolean) => void;
  onDismissVoucherModal: () => void;
}

export const CheckInVaultTab: React.FC<CheckInVaultTabProps> = ({
  privateState,
  sponsorAdUrl,
  pendingMysteryBoxNumber,
  mysteryReveal,
  voucherModal,
  onCompleteCheckIn,
  onStartMysteryBoxSponsor,
  onDismissVoucherModal,
}) => {
  const todayKey = getTodayDateKey();

  return (
    <div className="space-y-6">
      {/* Mon–Sun Daily Check-In Box */}
      <DailyCheckInBox
        privateState={privateState}
        onCompleteCheckIn={onCompleteCheckIn}
      />

      {/* 12 Secret Mystery Vault Gift Boxes */}
      <MysteryVaultCard
        privateState={privateState}
        sponsorAdUrl={sponsorAdUrl}
        todayKey={todayKey}
        pendingMysteryBoxNumber={pendingMysteryBoxNumber}
        mysteryReveal={mysteryReveal}
        voucherModal={voucherModal}
        onStartMysteryBoxSponsor={onStartMysteryBoxSponsor}
        onDismissVoucherModal={onDismissVoucherModal}
      />
    </div>
  );
};
