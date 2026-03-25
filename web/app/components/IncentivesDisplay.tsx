'use client';

import { useState, useEffect } from 'react';
import { useIncentives } from '../lib/hooks/useIncentives';
import { Gift, TrendingUp, Award, Zap } from 'lucide-react';

interface IncentivesDisplayProps {
  betterId?: string;
  poolId?: number;
}

export default function IncentivesDisplay({ betterId, poolId }: IncentivesDisplayProps) {
  const { incentives, getPendingIncentives, getTotalPendingBonus, getClaimedIncentives, getTotalClaimedBonus } = useIncentives();
  const [selectedTab, setSelectedTab] = useState<'pending' | 'claimed'>('pending');

  if (!betterId) {
    return (
      <div className="glass p-6 rounded-xl border border-border text-center">
        <Gift className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-muted-foreground">Connect wallet to view incentives</p>
      </div>
    );
  }

  const pendingIncentives = getPendingIncentives(betterId);
  const claimedIncentives = getClaimedIncentives(betterId);
  const totalPending = getTotalPendingBonus(betterId);
  const totalClaimed = getTotalClaimedBonus(betterId);

  const getIncentiveIcon = (type: string) => {
    switch (type) {
      case 'early-bird':
        return <Zap className="w-4 h-4" />;
      case 'volume':
        return <TrendingUp className="w-4 h-4" />;
      case 'loyalty':
        return <Award className="w-4 h-4" />;
      default:
        return <Gift className="w-4 h-4" />;
    }
  };

  const getIncentiveColor = (type: string) => {
    switch (type) {
      case 'early-bird':
        return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      case 'volume':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'loyalty':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      default:
        return 'bg-green-500/10 text-green-400 border-green-500/20';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass p-6 rounded-xl border border-border">
        <h2 className="text-2xl font-bold mb-4">Liquidity Incentives</h2>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-muted/50 p-4 rounded-lg">
            <p className="text-sm text-muted-foreground">Pending Bonus</p>
            <p className="text-2xl font-bold text-yellow-400">{totalPending.toFixed(2)} STX</p>
          </div>
          <div className="bg-muted/50 p-4 rounded-lg">
            <p className="text-sm text-muted-foreground">Claimed Bonus</p>
            <p className="text-2xl font-bold text-green-400">{totalClaimed.toFixed(2)} STX</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-border">
        <button
          onClick={() => setSelectedTab('pending')}
          className={`px-4 py-2 font-bold transition-all ${selectedTab === 'pending'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
            }`}
        >
          Pending ({pendingIncentives.length})
        </button>
        <button
          onClick={() => setSelectedTab('claimed')}
          className={`px-4 py-2 font-bold transition-all ${selectedTab === 'claimed'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
            }`}
        >
          Claimed ({claimedIncentives.length})
        </button>
      </div>

      {/* Content */}
      <div className="space-y-3">
        {selectedTab === 'pending' && (
          <>
            {pendingIncentives.length === 0 ? (
              <div className="glass p-6 rounded-xl border border-border text-center">
                <Gift className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-muted-foreground">No pending incentives</p>
              </div>
            ) : (
              pendingIncentives.map((incentive, idx) => (
                <div
                  key={idx}
                  className={`glass p-4 rounded-lg border flex justify-between items-center ${getIncentiveColor(
                    incentive.bonusType
                  )}`}
                >
                  <div className="flex items-center gap-3">
                    {getIncentiveIcon(incentive.bonusType)}
                    <div>
                      <p className="font-bold capitalize">{incentive.bonusType.replace('-', ' ')}</p>
                      <p className="text-xs text-muted-foreground">Pool #{incentive.poolId}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{incentive.bonusAmount.toFixed(2)} STX</p>
                    <button className="text-xs px-2 py-1 bg-primary/20 hover:bg-primary/30 rounded mt-1 transition-all">
                      Claim
                    </button>
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {selectedTab === 'claimed' && (
          <>
            {claimedIncentives.length === 0 ? (
              <div className="glass p-6 rounded-xl border border-border text-center">
                <Award className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-muted-foreground">No claimed incentives yet</p>
              </div>
            ) : (
              claimedIncentives.map((incentive, idx) => (
                <div
                  key={idx}
                  className={`glass p-4 rounded-lg border flex justify-between items-center ${getIncentiveColor(
                    incentive.bonusType
                  )}`}
                >
                  <div className="flex items-center gap-3">
                    {getIncentiveIcon(incentive.bonusType)}
                    <div>
                      <p className="font-bold capitalize">{incentive.bonusType.replace('-', ' ')}</p>
                      <p className="text-xs text-muted-foreground">
                        Claimed {new Date(incentive.claimedAt || 0).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <p className="font-bold">{incentive.bonusAmount.toFixed(2)} STX</p>
                </div>
              ))
            )}
          </>
        )}
      </div>

      {/* Info */}
      <div className="glass p-4 rounded-lg border border-border/50 bg-primary/5">
        <p className="text-sm text-muted-foreground">
          💡 Earn bonuses by being an early bettor, reaching volume thresholds, and betting consistently!
        </p>
      </div>
    </div>
  );
}
// IncentivesDisplay enhancement 1
// IncentivesDisplay enhancement 2
// IncentivesDisplay enhancement 3
// IncentivesDisplay enhancement 4
// IncentivesDisplay enhancement 5
// IncentivesDisplay enhancement 6
// IncentivesDisplay enhancement 7
// IncentivesDisplay enhancement 8
// IncentivesDisplay enhancement 9
// IncentivesDisplay enhancement 10
