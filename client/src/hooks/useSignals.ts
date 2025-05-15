import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import useWsStore from '../lib/wsStore';

export interface Signal {
  id: string;
  timestamp: string;
  type: string;
  sourceToken?: string;
  targetToken?: string;
  confidence?: number;
  sentiment?: string;
  source?: string;
  status: 'pending' | 'processing' | 'executed' | 'failed';
  signature?: string;
  executionTime?: number;
}

export function useSignals() {
  const [wsSignals, setWsSignals] = useState<Signal[]>([]);
  const { registerHandler } = useWsStore();
  
  // Fetch signals from API
  const { 
    data: apiSignals, 
    isLoading, 
    error, 
    refetch 
  } = useQuery<Signal[]>({
    queryKey: ['/api/signals'],
    staleTime: 30 * 1000, // 30 seconds
  });
  
  // Merge API and WebSocket signals
  const signals = mergeSignals(apiSignals || [], wsSignals);
  
  useEffect(() => {
    // Listen for signal updates from WebSocket
    const unregister = registerHandler('SIGNAL', (message) => {
      try {
        const data = typeof message === 'string' ? JSON.parse(message) : message;
        
        if (data.data && data.type === 'SIGNAL') {
          const newSignal: Signal = {
            id: data.data.id || data.id,
            timestamp: data.data.timestamp || data.timestamp,
            type: data.data.type,
            sourceToken: data.data.sourceToken,
            targetToken: data.data.targetToken,
            confidence: data.data.confidence,
            sentiment: data.data.sentiment,
            source: data.data.source,
            status: data.data.status || 'pending',
            signature: data.data.signature,
            executionTime: data.data.executionTime
          };
          
          setWsSignals(prev => {
            // Check if signal already exists by ID
            const exists = prev.some(s => s.id === newSignal.id);
            
            if (exists) {
              // Update existing signal
              return prev.map(s => 
                s.id === newSignal.id ? { ...s, ...newSignal } : s
              );
            } else {
              // Add new signal
              return [newSignal, ...prev];
            }
          });
        }
      } catch (err) {
        console.error('Error processing signal from WebSocket:', err);
      }
    });
    
    return () => {
      unregister();
    };
  }, [registerHandler]);
  
  return {
    signals,
    isLoading,
    error,
    refetch
  };
}

// Helper function to merge and deduplicate signals from both sources
function mergeSignals(apiSignals: Signal[], wsSignals: Signal[]): Signal[] {
  const mergedMap = new Map<string, Signal>();
  
  // Add API signals to map
  apiSignals.forEach(signal => {
    mergedMap.set(signal.id, signal);
  });
  
  // Add or update with WebSocket signals
  wsSignals.forEach(signal => {
    const existing = mergedMap.get(signal.id);
    if (existing) {
      // WebSocket data is likely more recent, but keep API data if WS is missing fields
      mergedMap.set(signal.id, { ...existing, ...signal });
    } else {
      mergedMap.set(signal.id, signal);
    }
  });
  
  // Convert map back to array and sort by timestamp (newest first)
  return Array.from(mergedMap.values())
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}