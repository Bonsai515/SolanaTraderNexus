/**
 * Profit Metrics Component
 * 
 * Displays detailed profit performance metrics
 */

import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatNumber, formatPercent } from "@/lib/dashboard/utils";

interface ProfitMetricsProps {
  metrics: {
    winRate: string;
    profitFactor: string;
    maxDrawdown: string;
    volatility: string;
    sharpeRatio: string;
    averageProfitPerCapture: string;
  };
}

const ProfitMetrics: React.FC<ProfitMetricsProps> = ({ metrics }) => {
  if (!metrics) return null;
  
  const renderMetric = (label: string, value: string, helpText: string, progressValue?: number) => (
    <div className="space-y-1">
      <div className="flex justify-between">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="font-medium">{value}</div>
      </div>
      {progressValue !== undefined && (
        <Progress value={progressValue} className="h-2" />
      )}
      <div className="text-xs text-muted-foreground">{helpText}</div>
    </div>
  );
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {renderMetric(
        "Win Rate",
        metrics.winRate || "0%",
        "Percentage of profitable captures",
        parseFloat(metrics.winRate || "0")
      )}
      
      {renderMetric(
        "Profit Factor",
        metrics.profitFactor || "0",
        "Ratio of gross profits to gross losses",
        Math.min(100, parseFloat(metrics.profitFactor || "0") * 50)
      )}
      
      {renderMetric(
        "Max Drawdown",
        metrics.maxDrawdown || "0%",
        "Maximum peak-to-trough decline",
        100 - Math.min(100, parseFloat(metrics.maxDrawdown || "0"))
      )}
      
      {renderMetric(
        "Volatility",
        metrics.volatility || "0",
        "Standard deviation of returns",
        Math.max(0, 100 - parseFloat(metrics.volatility || "0") * 100)
      )}
      
      {renderMetric(
        "Sharpe Ratio",
        metrics.sharpeRatio || "0",
        "Return adjusted for risk",
        Math.min(100, parseFloat(metrics.sharpeRatio || "0") * 33)
      )}
      
      {renderMetric(
        "Avg. Profit/Capture",
        metrics.averageProfitPerCapture || "$0",
        "Average profit per capture",
        undefined
      )}
    </div>
  );
};

export default ProfitMetrics;