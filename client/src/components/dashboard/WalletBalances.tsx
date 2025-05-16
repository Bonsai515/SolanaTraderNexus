/**
 * Wallet Balances Component
 * 
 * Displays balances for all system wallets
 */

import React from 'react';
import { formatNumber } from "@/lib/dashboard/utils";

interface WalletBalancesProps {
  wallets: Array<{
    address: string;
    name: string;
    balance: number;
    lastUpdated: string;
  }>;
}

const WalletBalances: React.FC<WalletBalancesProps> = ({ wallets }) => {
  if (!wallets || wallets.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-4">
        No wallet data available
      </div>
    );
  }
  
  return (
    <div className="space-y-3">
      {wallets.map((wallet, index) => (
        <div key={index} className="flex justify-between items-center border-b pb-2">
          <div>
            <div className="font-medium">{wallet.name}</div>
            <div className="text-xs text-muted-foreground">
              {wallet.address.substring(0, 6)}...{wallet.address.substring(wallet.address.length - 4)}
            </div>
          </div>
          <div className="text-right">
            <div className="font-bold">{formatNumber(wallet.balance, false)} SOL</div>
            <div className="text-xs text-muted-foreground">
              ≈ {formatNumber(wallet.balance * 155, true)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default WalletBalances;