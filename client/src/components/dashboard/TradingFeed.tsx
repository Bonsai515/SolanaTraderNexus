/**
 * Trading Feed Component
 * 
 * Displays a live feed of trading activity
 */

import React, { useState, useEffect } from 'react';
import { formatNumber, timeAgo } from "@/lib/dashboard/utils";
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface TradingFeedProps {
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

const TradingFeed: React.FC<TradingFeedProps> = ({ trades }) => {
  const [visibleTrades, setVisibleTrades] = useState<any[]>([]);
  
  // Set initial trades
  useEffect(() => {
    if (trades && trades.length > 0) {
      setVisibleTrades(trades.slice(0, 5));
    }
  }, [trades]);
  
  // Simulate new trades coming in every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (trades && trades.length > 0) {
        // Simulate a new trade by taking a random one from the existing trades
        const randomIndex = Math.floor(Math.random() * trades.length);
        const newTrade = {
          ...trades[randomIndex],
          timestamp: new Date().toISOString(),
          // Randomize some values to make it look different
          amount: parseFloat((trades[randomIndex].amount * (0.8 + Math.random() * 0.4)).toFixed(2)),
          profit: parseFloat((trades[randomIndex].profit * (0.7 + Math.random() * 0.6)).toFixed(2)),
          txId: 'sim_' + Math.random().toString(36).substring(2, 10)
        };
        
        setVisibleTrades(prev => [newTrade, ...prev.slice(0, 4)]);
      }
    }, 10000);
    
    return () => clearInterval(interval);
  }, [trades]);
  
  if (!visibleTrades || visibleTrades.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-4">
        No trading activity available
      </div>
    );
  }
  
  return (
    <div className="space-y-3">
      {visibleTrades.map((trade, index) => (
        <div 
          key={index} 
          className={`flex justify-between items-center border-b pb-2 ${index === 0 ? 'animate-pulse bg-muted/50 p-2 rounded-md' : ''}`}
        >
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
          <div>
            <div className="text-sm">{trade.strategy}</div>
            <div className="text-xs text-muted-foreground">
              {trade.txId?.substring(0, 6)}...{trade.txId?.substring(trade.txId.length - 4)}
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

export default TradingFeed;