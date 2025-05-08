import { useQuery, useMutation } from '@tanstack/react-query';
import { Strategy } from '@/components/StrategyList';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';

export const useAIAgents = () => {
  const { toast } = useToast();

  // Fetch AI components status
  const { data: aiComponentsData } = useQuery({
    queryKey: ['/api/ai/components'],
    staleTime: 30000,
  });

  // Fetch transformer components status
  const { data: transformersData } = useQuery({
    queryKey: ['/api/transformers'],
    staleTime: 30000,
  });

  // Fetch strategies
  const { data: strategiesData } = useQuery({
    queryKey: ['/api/strategies'],
    staleTime: 30000,
  });

  // Toggle strategy mutation
  const toggleStrategyMutation = useMutation({
    mutationFn: (id: string) => 
      apiRequest('POST', `/api/strategies/${id}/toggle`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/strategies'] });
      toast({
        title: 'Strategy Updated',
        description: 'The trading strategy has been updated.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Strategy Update Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Deploy new strategy mutation
  const deployStrategyMutation = useMutation({
    mutationFn: () => 
      apiRequest('POST', '/api/strategies/deploy', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/strategies'] });
      toast({
        title: 'Strategy Deployed',
        description: 'New trading strategy has been deployed.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Strategy Deployment Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Default values in case data is not yet loaded
  const aiComponents = aiComponentsData?.components || [
    {
      name: "Transformer Engine",
      description: "Quantum-inspired processing",
      icon: "memory",
      iconColor: "primary",
      status: "Active"
    },
    {
      name: "Trading Agent",
      description: "Opportunity detection",
      icon: "smart_toy",
      iconColor: "info",
      status: "Scanning"
    },
    {
      name: "Transaction Engine",
      description: "Trade execution",
      icon: "sync",
      iconColor: "warning",
      status: "Ready"
    },
    {
      name: "Security Layer",
      description: "Quantum-inspired encryption",
      icon: "security",
      iconColor: "danger",
      status: "Secured"
    }
  ];

  const transformers = transformersData?.transformers || [
    {
      name: "Market Data Transformer",
      description: "Real-time price analysis",
      icon: "analytics",
      iconColor: "primary",
      status: "Active"
    },
    {
      name: "Signal Generator",
      description: "Trading opportunity detection",
      icon: "radar",
      iconColor: "info",
      status: "Active"
    },
    {
      name: "Strategy Optimizer",
      description: "Performance improvement",
      icon: "tune",
      iconColor: "success",
      status: "Active"
    },
    {
      name: "Risk Manager",
      description: "Trade safety controls",
      icon: "health_and_safety",
      iconColor: "warning",
      status: "Active"
    }
  ];

  const strategies: Strategy[] = strategiesData?.strategies || [
    {
      id: "1",
      name: "Alpha-7 Arbitrage",
      description: "Cross-DEX arbitrage opportunities",
      icon: "smart_toy",
      iconColor: "primary",
      performance: {
        value: "+3.2% 24h",
        isPositive: true
      },
      isActive: true
    },
    {
      id: "2",
      name: "Beta-3 Liquidity",
      description: "Automated liquidity provision",
      icon: "smart_toy",
      iconColor: "warning",
      performance: {
        value: "+2.1% 24h",
        isPositive: true
      },
      isActive: true
    },
    {
      id: "3",
      name: "Gamma-1 Momentum",
      description: "Short-term trend following",
      icon: "smart_toy",
      iconColor: "danger",
      performance: {
        value: "-0.8% 24h",
        isPositive: false
      },
      isActive: true
    }
  ];

  const toggleStrategy = (id: string) => {
    toggleStrategyMutation.mutate(id);
  };

  const deployNewStrategy = () => {
    deployStrategyMutation.mutate();
  };

  return {
    aiComponents,
    transformers,
    strategies,
    toggleStrategy,
    deployNewStrategy,
  };
};
