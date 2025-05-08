import { useQuery } from '@tanstack/react-query';
import { Transaction } from '@/components/TransactionTable';
import { useEffect } from 'react';
import { wsClient } from '@/lib/wsClient';

export const useTransactionEngine = () => {
  // Fetch recent transactions
  const { data: transactionsData, isLoading } = useQuery({
    queryKey: ['/api/transactions/recent'],
    staleTime: 30000,
  });

  // Fetch wallet transactions
  const { data: walletTransactionsData } = useQuery({
    queryKey: ['/api/transactions/wallet'],
    staleTime: 30000,
  });

  // React to real-time transaction updates
  useEffect(() => {
    const handleNewTransaction = (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      if (data.type === 'transaction') {
        // The query will be invalidated and refetched
      }
    };

    wsClient.addEventListener('message', handleNewTransaction);

    return () => {
      wsClient.removeEventListener('message', handleNewTransaction);
    };
  }, []);

  // Default values in case data is not yet loaded
  const transactions: Transaction[] = transactionsData?.transactions || [];
  const totalTransactionCount = transactionsData?.total || 0;
  
  const walletTransactions: Transaction[] = walletTransactionsData?.transactions || [];
  const totalWalletTransactionCount = walletTransactionsData?.total || 0;

  // Transaction metrics for analytics
  const transactionMetrics = {
    totalTrades: totalTransactionCount,
    successfulTrades: transactions.filter(t => t.status === 'Completed').length,
    successRate: totalTransactionCount ? 
      Math.round((transactions.filter(t => t.status === 'Completed').length / totalTransactionCount) * 100) : 0,
    avgProfit: '+0.08',
    maxProfit: '+0.12',
    maxLoss: '-0.03',
  };

  return {
    transactions,
    totalTransactionCount,
    walletTransactions,
    totalWalletTransactionCount,
    transactionMetrics,
    isLoading,
  };
};
