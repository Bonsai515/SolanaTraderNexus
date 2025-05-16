/**
 * Trading System Dashboard
 * 
 * Main dashboard for monitoring trading system performance,
 * profit collection, and strategy execution.
 */

import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell } from 'recharts';
import { apiRequest } from "@/lib/queryClient";
import { Loader2, ArrowUpRight, ArrowDownRight, DollarSign, TrendingUp, Zap, RefreshCw, Clock, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { formatNumber, formatPercent, timeAgo } from "@/lib/dashboard/utils";
import StrategyCard from "@/components/dashboard/StrategyCard";
import ProfitMetrics from "@/components/dashboard/ProfitMetrics";
import WalletBalances from "@/components/dashboard/WalletBalances";
import TradeHistory from "@/components/dashboard/TradeHistory";
import TradingFeed from "@/components/dashboard/TradingFeed";
import StatusIndicator from "@/components/dashboard/StatusIndicator";

// Colors for charts
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

const Dashboard = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [systemStatus, setSystemStatus] = useState<'active' | 'inactive' | 'warning' | 'error'>('inactive');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  // Fetch dashboard data
  const fetchDashboardData = async () => {
    try {
      setRefreshing(true);
      const response = await apiRequest('GET', '/api/dashboard');
      const data = await response.json();
      
      setDashboardData(data);
      setSystemStatus(data.system.status || 'inactive');
      setLastUpdated(new Date());
      setLoading(false);
      setRefreshing(false);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast({
        title: "Error loading dashboard",
        description: "Could not load dashboard data. Please try again.",
        variant: "destructive",
      });
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  // Handle manual refresh
  const handleRefresh = () => {
    fetchDashboardData();
  };
  
  // Trigger profit collection
  const triggerProfitCollection = async () => {
    try {
      setRefreshing(true);
      const response = await apiRequest('POST', '/api/profit/capture');
      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "Profit collection triggered",
          description: "Profit collection process started successfully.",
        });
      } else {
        toast({
          title: "Profit collection failed",
          description: result.message || "Could not trigger profit collection.",
          variant: "destructive",
        });
      }
      
      // Refresh data after a short delay
      setTimeout(() => fetchDashboardData(), 2000);
    } catch (error) {
      console.error('Error triggering profit collection:', error);
      toast({
        title: "Profit collection failed",
        description: "Could not trigger profit collection. Please try again.",
        variant: "destructive",
      });
      setRefreshing(false);
    }
  };
  
  // Initial data load
  useEffect(() => {
    fetchDashboardData();
    
    // Set up auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchDashboardData();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);
  
  // Render loading state
  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
          <h2 className="mt-4 text-2xl font-semibold">Loading Dashboard</h2>
          <p className="mt-2 text-muted-foreground">Please wait while we fetch the latest data...</p>
        </div>
      </div>
    );
  }
  
  // Extract data for charts
  const profitData = dashboardData?.profit?.charts?.profitByDay || [];
  const strategyData = dashboardData?.profit?.charts?.profitByStrategy || [];
  const walletData = dashboardData?.wallets || [];
  const recentTrades = dashboardData?.trades?.recent || [];
  
  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Trading Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor system performance, profits, and trading activities
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right text-sm text-muted-foreground">
            Last updated: {lastUpdated ? timeAgo(lastUpdated) : 'Never'}
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh} 
            disabled={refreshing}
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-1" />
            )}
            Refresh
          </Button>
        </div>
      </div>
      
      {/* System Status */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">System Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <StatusIndicator status={systemStatus} />
              <div className="text-2xl font-bold">{systemStatus.toUpperCase()}</div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Profit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <DollarSign className="h-5 w-5 text-green-500" />
              <div className="text-2xl font-bold">
                {formatNumber(dashboardData?.profit?.summary?.totalProfit || 0, true)}
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Profit Captures</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <Clock className="h-5 w-5 text-blue-500" />
              <div className="text-2xl font-bold">
                {dashboardData?.profit?.summary?.totalCaptures || 0}
              </div>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Every {dashboardData?.profit?.summary?.captureIntervalMinutes || 4} minutes
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Button 
                variant="default" 
                size="sm" 
                className="w-full" 
                onClick={triggerProfitCollection}
                disabled={refreshing}
              >
                Capture Profit Now
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Main Dashboard Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid grid-cols-4 mb-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="profits">Profits</TabsTrigger>
          <TabsTrigger value="strategies">Strategies</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
        </TabsList>
        
        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Performance Metrics */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Trading Performance</CardTitle>
                <CardDescription>Overall system performance metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={profitData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="profit" stroke="#0088FE" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
              <CardFooter className="flex justify-between">
                <div className="text-sm text-muted-foreground">Daily profit over time</div>
                <Badge variant={
                  dashboardData?.profit?.performance?.profitFactor > 1.5 ? "success" :
                  dashboardData?.profit?.performance?.profitFactor > 1 ? "default" : "destructive"
                }>
                  Profit Factor: {dashboardData?.profit?.performance?.profitFactor || "N/A"}
                </Badge>
              </CardFooter>
            </Card>
            
            {/* Strategy Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Strategy Distribution</CardTitle>
                <CardDescription>Profit by strategy</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={strategyData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="profit"
                      nameKey="strategy"
                    >
                      {strategyData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
              <CardFooter>
                <div className="text-sm text-muted-foreground">
                  Distribution of profits across different strategies
                </div>
              </CardFooter>
            </Card>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Wallet Balances */}
            <Card>
              <CardHeader>
                <CardTitle>Wallet Balances</CardTitle>
                <CardDescription>Current balance in each wallet</CardDescription>
              </CardHeader>
              <CardContent>
                <WalletBalances wallets={walletData} />
              </CardContent>
            </Card>
            
            {/* Active Strategies */}
            <Card>
              <CardHeader>
                <CardTitle>Active Strategies</CardTitle>
                <CardDescription>Currently active trading strategies</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {dashboardData?.strategies?.active?.map((strategy, index) => (
                  <StrategyCard key={index} strategy={strategy} />
                )) || (
                  <div className="text-muted-foreground text-center py-4">
                    No active strategies
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Recent Trades */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Trades</CardTitle>
                <CardDescription>Latest executed trades</CardDescription>
              </CardHeader>
              <CardContent>
                <TradeHistory trades={recentTrades} />
              </CardContent>
              <CardFooter>
                <Button variant="outline" size="sm" className="w-full">
                  View All Trades
                </Button>
              </CardFooter>
            </Card>
          </div>
        </TabsContent>
        
        {/* Profits Tab */}
        <TabsContent value="profits" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Profit Metrics */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Profit Metrics</CardTitle>
                <CardDescription>Detailed profit performance metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <ProfitMetrics metrics={dashboardData?.profit?.performance} />
              </CardContent>
            </Card>
            
            {/* Profit Collection */}
            <Card>
              <CardHeader>
                <CardTitle>Profit Collection</CardTitle>
                <CardDescription>Profit collection settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Capture Interval:</span>
                  <span className="font-medium">{dashboardData?.profit?.summary?.captureIntervalMinutes || 4} minutes</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Reinvestment Rate:</span>
                  <span className="font-medium">{dashboardData?.profit?.summary?.reinvestmentRate || 95}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last Capture:</span>
                  <span className="font-medium">
                    {dashboardData?.profit?.summary?.lastCaptureTime ? 
                      timeAgo(new Date(dashboardData.profit.summary.lastCaptureTime)) : 
                      'Never'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Strategy:</span>
                  <Badge>{dashboardData?.profit?.currentStrategy || "REINVEST"}</Badge>
                </div>
                <Button 
                  onClick={triggerProfitCollection} 
                  className="w-full"
                  disabled={refreshing}
                >
                  Capture Profit Now
                </Button>
              </CardContent>
            </Card>
          </div>
          
          {/* Profit History */}
          <Card>
            <CardHeader>
              <CardTitle>Profit History</CardTitle>
              <CardDescription>Historical profit collection data</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={profitData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="profit" fill="#0088FE" name="Profit" />
                  <Bar dataKey="reinvested" fill="#00C49F" name="Reinvested" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          
          {/* Recent Profit Captures */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Profit Captures</CardTitle>
              <CardDescription>Latest profit collection events</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {dashboardData?.profit?.recentCaptures?.map((capture, index) => (
                  <div key={index} className="flex items-center justify-between border-b pb-2">
                    <div>
                      <div className="font-medium">{new Date(capture.timestamp).toLocaleString()}</div>
                      <div className="text-sm text-muted-foreground">
                        From: {capture.sourceWallet.substring(0, 6)}...{capture.sourceWallet.substring(capture.sourceWallet.length - 4)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-green-500">{formatNumber(capture.amount, true)}</div>
                      <div className="text-sm text-muted-foreground">
                        {capture.strategy || "REINVEST"}
                      </div>
                    </div>
                  </div>
                )) || (
                  <div className="text-center text-muted-foreground py-4">
                    No recent profit captures
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Strategies Tab */}
        <TabsContent value="strategies" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Active Strategies */}
            <Card>
              <CardHeader>
                <CardTitle>Active Strategies</CardTitle>
                <CardDescription>Currently active trading strategies</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {dashboardData?.strategies?.active?.map((strategy, index) => (
                  <div key={index} className="border rounded-lg p-4 space-y-2">
                    <div className="flex justify-between items-center">
                      <h3 className="font-semibold text-lg">{strategy.name}</h3>
                      <Badge variant="success">Active</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{strategy.description}</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Type:</span> {strategy.type}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Risk:</span> {strategy.risk}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Allocation:</span> {strategy.allocation}%
                      </div>
                      <div>
                        <span className="text-muted-foreground">Daily ROI:</span> {strategy.dailyRoi}%
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="text-sm">
                        <span className="text-muted-foreground">Executions:</span> {strategy.executions || 0}
                      </div>
                      <Button variant="outline" size="sm">View Details</Button>
                    </div>
                  </div>
                )) || (
                  <div className="text-center text-muted-foreground py-4">
                    No active strategies
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Strategy Performance */}
            <Card>
              <CardHeader>
                <CardTitle>Strategy Performance</CardTitle>
                <CardDescription>Performance metrics by strategy</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={strategyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="strategy" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="profit" fill="#0088FE" name="Profit" />
                    <Bar dataKey="executions" fill="#00C49F" name="Executions" />
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-4 space-y-2">
                  {strategyData.map((strategy, index) => (
                    <div key={index} className="flex justify-between items-center">
                      <div className="flex items-center">
                        <div 
                          className="w-3 h-3 rounded-full mr-2" 
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span>{strategy.strategy}</span>
                      </div>
                      <div className="font-medium">{formatNumber(strategy.profit, true)}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Strategy Config */}
          <Card>
            <CardHeader>
              <CardTitle>Strategy Configuration</CardTitle>
              <CardDescription>Configure and manage trading strategies</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <h3 className="font-medium">Flash Arbitrage</h3>
                    <div className="text-sm text-muted-foreground">
                      Status: <Badge variant="success">Active</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Min Profit: 0.8%
                    </div>
                    <Button variant="outline" size="sm" className="w-full">Configure</Button>
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="font-medium">Meme Token Sniper</h3>
                    <div className="text-sm text-muted-foreground">
                      Status: <Badge variant="success">Active</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Min Profit: 1.2%
                    </div>
                    <Button variant="outline" size="sm" className="w-full">Configure</Button>
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="font-medium">Cross-Chain Arbitrage</h3>
                    <div className="text-sm text-muted-foreground">
                      Status: <Badge variant="success">Active</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Min Profit: 1.0%
                    </div>
                    <Button variant="outline" size="sm" className="w-full">Configure</Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Transactions Tab */}
        <TabsContent value="transactions" className="space-y-4">
          {/* Transaction Feed */}
          <Card>
            <CardHeader>
              <CardTitle>Live Transaction Feed</CardTitle>
              <CardDescription>Real-time transaction activity</CardDescription>
            </CardHeader>
            <CardContent>
              <TradingFeed trades={dashboardData?.trades?.recent || []} />
            </CardContent>
          </Card>
          
          {/* Transaction History */}
          <Card>
            <CardHeader>
              <CardTitle>Transaction History</CardTitle>
              <CardDescription>Historical transaction data</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {dashboardData?.trades?.recent?.map((trade, index) => (
                  <div key={index} className="flex justify-between items-center border-b pb-2">
                    <div>
                      <div className="font-medium">{trade.pair}</div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(trade.timestamp).toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm">
                        {trade.type === 'buy' ? 'Buy' : 'Sell'} • {trade.strategy}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {trade.amount} {trade.token}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={trade.profit >= 0 ? 'text-green-500' : 'text-red-500'}>
                        {formatNumber(trade.profit, true)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {trade.txId?.substring(0, 6)}...{trade.txId?.substring(trade.txId.length - 4)}
                      </div>
                    </div>
                  </div>
                )) || (
                  <div className="text-center text-muted-foreground py-4">
                    No transaction history available
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter>
              <Button variant="outline" className="w-full">Load More</Button>
            </CardFooter>
          </Card>
          
          {/* Transaction Analytics */}
          <Card>
            <CardHeader>
              <CardTitle>Transaction Analytics</CardTitle>
              <CardDescription>Transaction performance analytics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground">Success Rate</h3>
                  <div className="text-2xl font-bold">
                    {formatPercent(dashboardData?.transactions?.successRate || 0)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {dashboardData?.transactions?.successful || 0} successful / 
                    {dashboardData?.transactions?.total || 0} total
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground">Average Profit</h3>
                  <div className="text-2xl font-bold">
                    {formatNumber(dashboardData?.transactions?.avgProfit || 0, true)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Per transaction
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground">Total Volume</h3>
                  <div className="text-2xl font-bold">
                    {formatNumber(dashboardData?.transactions?.totalVolume || 0, true)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    All time
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Dashboard;
