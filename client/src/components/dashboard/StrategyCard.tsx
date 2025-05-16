/**
 * Strategy Card Component
 * 
 * Displays information about an active trading strategy
 */

import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap, TrendingUp, AlertTriangle } from 'lucide-react';
import { formatPercent } from "@/lib/dashboard/utils";

interface StrategyCardProps {
  strategy: {
    name: string;
    type: string;
    status: string;
    risk: string;
    allocation: number;
    dailyRoi: number;
    description?: string;
  };
}

const StrategyCard: React.FC<StrategyCardProps> = ({ strategy }) => {
  const getRiskBadge = (risk: string) => {
    switch (risk.toLowerCase()) {
      case 'low':
        return <Badge variant="outline" className="bg-green-50 text-green-700 hover:bg-green-50">Low Risk</Badge>;
      case 'medium':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 hover:bg-yellow-50">Medium Risk</Badge>;
      case 'high':
        return <Badge variant="outline" className="bg-red-50 text-red-700 hover:bg-red-50">High Risk</Badge>;
      default:
        return <Badge variant="outline">Unknown Risk</Badge>;
    }
  };
  
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-medium">{strategy.name}</h3>
            <p className="text-xs text-muted-foreground">{strategy.type}</p>
          </div>
          <div className="flex items-center">
            {getRiskBadge(strategy.risk)}
            {strategy.status === 'active' && (
              <Zap size={16} className="ml-2 text-green-500" />
            )}
          </div>
        </div>
        <div className="mt-2 flex justify-between text-sm">
          <div className="flex items-center">
            <TrendingUp size={14} className="mr-1 text-green-500" />
            <span>{formatPercent(strategy.dailyRoi)}</span>
          </div>
          <div>Allocation: {strategy.allocation}%</div>
        </div>
      </CardContent>
    </Card>
  );
};

export default StrategyCard;