import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PerformanceChart from '@/components/PerformanceChart';
import { useTransactionEngine } from '@/hooks/useTransactionEngine';

const Analytics = () => {
  const [chartTimeframe, setChartTimeframe] = useState<'24h' | '7d' | '30d' | 'all'>('7d');
  const { transactionMetrics } = useTransactionEngine();

  // Mock performance chart data based on timeframe
  const getChartData = () => {
    let labels: string[] = [];
    let values: number[] = [];

    switch (chartTimeframe) {
      case '24h':
        labels = ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', '24:00'];
        values = [350.2, 351.5, 353.8, 352.9, 354.2, 353.7, 354.72];
        break;
      case '7d':
        labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        values = [345.6, 348.2, 347.5, 350.1, 352.3, 353.9, 354.72];
        break;
      case '30d':
        labels = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
        values = [330.4, 338.7, 345.3, 354.72];
        break;
      case 'all':
        labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
        values = [280.5, 295.3, 310.7, 325.2, 340.8, 354.72];
        break;
    }

    return { labels, values };
  };

  return (
    <div>
      <h2 className="text-2xl font-semibold text-white mb-6">Analytics</h2>
      
      <Card className="bg-background-card border-gray-700 mb-8">
        <CardContent className="pt-6">
          <h3 className="text-lg font-medium mb-4">Performance Overview</h3>
          <PerformanceChart
            data={getChartData()}
            timeframe={chartTimeframe}
            onTimeframeChange={setChartTimeframe}
          />
        </CardContent>
      </Card>
      
      <Tabs defaultValue="trade" className="mb-8">
        <TabsList className="grid grid-cols-3 mb-6">
          <TabsTrigger value="trade">Trade Analytics</TabsTrigger>
          <TabsTrigger value="strategy">Strategy Analytics</TabsTrigger>
          <TabsTrigger value="market">Market Analytics</TabsTrigger>
        </TabsList>
        
        <TabsContent value="trade" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-background-card border-gray-700">
              <CardContent className="pt-6">
                <h3 className="text-sm font-medium mb-2 text-gray-400">Total Trades</h3>
                <div className="flex items-center justify-between">
                  <p className="text-2xl font-bold">{transactionMetrics.totalTrades}</p>
                  <span className="material-icons text-primary">sync_alt</span>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-background-card border-gray-700">
              <CardContent className="pt-6">
                <h3 className="text-sm font-medium mb-2 text-gray-400">Successful Trades</h3>
                <div className="flex items-center justify-between">
                  <p className="text-2xl font-bold text-success">{transactionMetrics.successfulTrades}</p>
                  <span className="material-icons text-success">check_circle</span>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-background-card border-gray-700">
              <CardContent className="pt-6">
                <h3 className="text-sm font-medium mb-2 text-gray-400">Success Rate</h3>
                <div className="flex items-center justify-between">
                  <p className="text-2xl font-bold">{transactionMetrics.successRate}%</p>
                  <span className="material-icons text-primary">percent</span>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <Card className="bg-background-card border-gray-700">
            <CardContent className="pt-6">
              <h3 className="text-lg font-medium mb-4">Transaction Performance</h3>
              <div className="space-y-4">
                <div className="p-3 bg-background-elevated rounded-md">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-medium">Avg. Profit per Trade</h4>
                      <p className="text-lg text-success mt-1">{transactionMetrics.avgProfit} SOL</p>
                    </div>
                    <span className="material-icons text-success">trending_up</span>
                  </div>
                </div>
                
                <div className="p-3 bg-background-elevated rounded-md">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-medium">Max Profit Trade</h4>
                      <p className="text-lg text-success mt-1">{transactionMetrics.maxProfit} SOL</p>
                    </div>
                    <span className="material-icons text-success">arrow_upward</span>
                  </div>
                </div>
                
                <div className="p-3 bg-background-elevated rounded-md">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-medium">Max Loss Trade</h4>
                      <p className="text-lg text-danger mt-1">{transactionMetrics.maxLoss} SOL</p>
                    </div>
                    <span className="material-icons text-danger">arrow_downward</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="strategy" className="space-y-4">
          <Card className="bg-background-card border-gray-700">
            <CardContent className="pt-6">
              <h3 className="text-lg font-medium mb-4">Strategy Performance</h3>
              <p className="text-gray-400">Strategy performance analytics will be displayed here.</p>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="market" className="space-y-4">
          <Card className="bg-background-card border-gray-700">
            <CardContent className="pt-6">
              <h3 className="text-lg font-medium mb-4">Market Analytics</h3>
              <p className="text-gray-400">Market analytics will be displayed here.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Analytics;
