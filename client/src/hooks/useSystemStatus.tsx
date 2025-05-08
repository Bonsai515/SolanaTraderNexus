import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { wsClient } from '@/lib/wsClient';

export const useSystemStatus = () => {
  const [blockchainStatus, setBlockchainStatus] = useState<'Online' | 'Offline'>('Online');
  const [transactionEngineStatus, setTransactionEngineStatus] = useState<'Active' | 'Inactive'>('Active');
  const [aiAgentsStatus, setAIAgentsStatus] = useState<'Running' | 'Stopped'>('Running');

  // Fetch system status
  const { data: statusData } = useQuery({
    queryKey: ['/api/system/status'],
    staleTime: 10000,
  });

  // Update states when data is loaded
  useEffect(() => {
    if (statusData) {
      setBlockchainStatus(statusData.blockchain ? 'Online' : 'Offline');
      setTransactionEngineStatus(statusData.transactionEngine ? 'Active' : 'Inactive');
      setAIAgentsStatus(statusData.aiAgents ? 'Running' : 'Stopped');
    }
  }, [statusData]);

  // Listen for real-time status updates
  useEffect(() => {
    const handleStatusUpdate = (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      if (data.type === 'status') {
        if (data.component === 'blockchain') {
          setBlockchainStatus(data.status ? 'Online' : 'Offline');
        } else if (data.component === 'transactionEngine') {
          setTransactionEngineStatus(data.status ? 'Active' : 'Inactive');
        } else if (data.component === 'aiAgents') {
          setAIAgentsStatus(data.status ? 'Running' : 'Stopped');
        }
      }
    };

    wsClient.addEventListener('message', handleStatusUpdate);

    return () => {
      wsClient.removeEventListener('message', handleStatusUpdate);
    };
  }, []);

  return {
    blockchainStatus,
    transactionEngineStatus,
    aiAgentsStatus,
  };
};
