import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export function useSolanaWallet() {
  const { toast } = useToast();
  
  const { data: walletData, isLoading } = useQuery({
    queryKey: ['/api/wallet'],
    staleTime: 10000,
  });

  const walletAddress = walletData?.address || '';
  const walletBalance = walletData?.balance || '0 SOL';
  
  const allocations = [
    { name: 'Alpha-7 Strategy', percentage: 50, color: 'primary' },
    { name: 'Beta-3 Strategy', percentage: 30, color: 'warning' },
    { name: 'Gamma-1 Strategy', percentage: 10, color: 'danger' },
    { name: 'Reserve', percentage: 10, color: 'success' },
  ];

  // Deposit mutation
  const depositMutation = useMutation({
    mutationFn: (amount: number) => 
      apiRequest('POST', '/api/wallet/deposit', { amount }),
    onSuccess: () => {
      toast({
        title: 'Deposit Successful',
        description: 'Your funds have been deposited.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Deposit Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Withdraw mutation
  const withdrawMutation = useMutation({
    mutationFn: (amount: number) => 
      apiRequest('POST', '/api/wallet/withdraw', { amount }),
    onSuccess: () => {
      toast({
        title: 'Withdrawal Successful',
        description: 'Your funds have been withdrawn.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Withdrawal Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Transfer mutation
  const transferMutation = useMutation({
    mutationFn: (data: { recipient: string; amount: number }) => 
      apiRequest('POST', '/api/wallet/transfer', data),
    onSuccess: () => {
      toast({
        title: 'Transfer Successful',
        description: 'Your funds have been transferred.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Transfer Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Handle wallet actions
  const handleDeposit = () => {
    // In a real app, we would show a modal to enter the amount
    const amount = 1; // Mock amount
    depositMutation.mutate(amount);
  };

  const handleWithdraw = () => {
    // In a real app, we would show a modal to enter the amount
    const amount = 1; // Mock amount
    withdrawMutation.mutate(amount);
  };

  const handleTransfer = () => {
    // In a real app, we would show a modal to enter recipient and amount
    const data = {
      recipient: 'recipient-address',
      amount: 1
    };
    transferMutation.mutate(data);
  };

  return {
    walletAddress,
    walletBalance,
    allocations,
    isLoading,
    handleDeposit,
    handleWithdraw,
    handleTransfer,
  };
}
