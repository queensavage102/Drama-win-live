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
  openedBoxesOverride?: number[];
  mysteryReveal: MysteryRevealState | null;
  voucherModal: {
    winner: MysteryWinnerRecord;
    newPoolPrizeZar?: number;
  } | null;
  onCompleteCheckIn: (dayKey: WeekDayKey, rewardCoins: number) => Promise<void>;
  onOpenMysteryBox: (boxNumber: number) => void;
  onDismissVoucherModal: () => void;
}

export const CheckInVaultTab: React.FC<CheckInVaultTabProps> = ({
  privateState,
  openedBoxesOverride,
  mysteryReveal,
  voucherModal,
  onCompleteCheckIn,
  onOpenMysteryBox,
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
        todayKey={todayKey}
        openedBoxesOverride={openedBoxesOverride}
        mysteryReveal={mysteryReveal}
        voucherModal={voucherModal}
        onOpenMysteryBox={onOpenMysteryBox}
        onDismissVoucherModal={onDismissVoucherModal}
      />
    </div>
  );
};
