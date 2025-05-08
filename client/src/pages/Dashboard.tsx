import { useState } from 'react';
import { useLocation } from 'wouter';
import MetricCard from '@/components/MetricCard';
import PerformanceChart from '@/components/PerformanceChart';
import AISystemPanel from '@/components/AISystemPanel';
import TransactionTable from '@/components/TransactionTable';
import StrategyList from '@/components/StrategyList';
import WalletManager from '@/components/WalletManager';
import { useTransactionEngine } from '@/hooks/useTransactionEngine';
import { useAIAgents } from '@/hooks/useAIAgents';
import { useSolanaWallet } from '@/hooks/useSolanaWallet';

const Dashboard = () => {
  const [, navigate] = useLocation();
  const [chartTimeframe, setChartTimeframe] = useState<'24h' | '7d' | '30d' | 'all'>('24h');
  
  const { transactions, totalTransactionCount } = useTransactionEngine();
  const { aiComponents, strategies, toggleStrategy, deployNewStrategy } = useAIAgents();
  const { 
    walletBalance, 
    walletAddress, 
    handleDeposit, 
    handleWithdraw, 
    handleTransfer,
    allocations 
  } = useSolanaWallet();

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

  const viewAllTransactions = () => {
    navigate('/trading');
  };

  return (
    <div>
      {/* Overview Section */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-white mb-4">System Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard
            title="Total Balance"
            value={walletBalance}
            icon="account_balance_wallet"
            iconColor="primary"
            trend={{
              value: "+5.2% (24h)",
              isPositive: true
            }}
          />
          <MetricCard
            title="Active Strategies"
            value={`${strategies.filter(s => s.isActive).length}`}
            subValue={`${strategies.filter(s => s.isActive && s.performance.isPositive).length} profitable | ${strategies.filter(s => s.isActive && !s.performance.isPositive).length} loss`}
            icon="smart_toy"
            iconColor="info"
          />
          <MetricCard
            title="24h Transactions"
            value={String(totalTransactionCount)}
            icon="sync_alt"
            iconColor="success"
            trend={{
              value: "+2.4 SOL profit",
              isPositive: true
            }}
          />
        </div>
      </div>

      {/* Chart Section */}
      <div className="mb-8">
        <PerformanceChart
          data={getChartData()}
          timeframe={chartTimeframe}
          onTimeframeChange={setChartTimeframe}
        />
      </div>

      {/* AI System & Trading Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* AI System Status */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">AI & Transformer System</h2>
          <div className="bg-background-card p-4 rounded-lg shadow-lg">
            <AISystemPanel components={aiComponents} />
          </div>
        </div>
        
        {/* Recent Trades */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Recent Transactions</h2>
          <TransactionTable 
            transactions={transactions.slice(0, 4)} 
            totalCount={totalTransactionCount}
            onViewAllClick={viewAllTransactions} 
          />
        </div>
      </div>

      {/* Strategy & Wallet Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Active Strategies */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Active Trading Strategies</h2>
          <div className="bg-background-card rounded-lg shadow-lg overflow-hidden">
            <StrategyList
              strategies={strategies}
              onToggleStrategy={toggleStrategy}
              onDeployNew={deployNewStrategy}
            />
          </div>
        </div>
        
        {/* Wallet Management */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Wallet Management</h2>
          <div className="bg-background-card rounded-lg shadow-lg overflow-hidden">
            <WalletManager
              walletAddress={walletAddress}
              balance={walletBalance}
              onDeposit={handleDeposit}
              onWithdraw={handleWithdraw}
              onTransfer={handleTransfer}
              allocations={allocations}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
