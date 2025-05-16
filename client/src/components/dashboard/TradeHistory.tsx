/**
 * Trade History Component
 * 
 * Displays a list of recent trades
 */

import React from 'react';
import { formatNumber, timeAgo } from "@/lib/dashboard/utils";
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface TradeHistoryProps {
  trades: Array<{
    timestamp: string;
    pair: string;
    type: 'buy' | 'sell';
    amount: number;
    token: string;
    price: number;
    profit: number;
    txId?: string;
    strategy: string;
  }>;
}

const TradeHistory: React.FC<TradeHistoryProps> = ({ trades }) => {
  if (!trades || trades.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-4">
        No trade history available
      </div>
    );
  }
  
  return (
    <div className="space-y-3">
      {trades.map((trade, index) => (
        <div key={index} className="flex justify-between items-center border-b pb-2">
          <div className="flex items-center">
            {trade.type === 'buy' ? (
              <ArrowUpRight className="h-4 w-4 text-green-500 mr-2" />
            ) : (
              <ArrowDownRight className="h-4 w-4 text-red-500 mr-2" />
            )}
            <div>
              <div className="font-medium">{trade.pair}</div>
              <div className="text-xs text-muted-foreground">
                {timeAgo(new Date(trade.timestamp))}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className={trade.profit >= 0 ? 'text-green-500 font-medium' : 'text-red-500 font-medium'}>
              {formatNumber(trade.profit, true)}
            </div>
            <div className="text-xs text-muted-foreground">
              {trade.amount} {trade.token}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default TradeHistory;