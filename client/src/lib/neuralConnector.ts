/**
 * Neural Connector Client
 * 
 * Provides client-side interface to the ultra-low latency neural connector
 * that links transformers and AI trading agents with minimal overhead.
 */

import { apiRequest } from './queryClient';

export interface NeuralSignal {
  id: string;
  timestamp: string;
  type: string;
  pair: string;
  source: string;
  target: string | string[];
  priority: string;
  data: {
    confidence: number;
    metadata: Record<string, any>;
    signals?: any[];
    timing?: {
      latencyMs: number;
      processingTimeMs: number;
    }
  };
}

interface NeuralConnectorStatus {
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  paths: number;
  clients: number;
  timestamp: string;
}

class NeuralConnectorClient {
  private pathsCache: Map<string, any> = new Map();
  
  // Get neural connector status
  async getStatus(): Promise<NeuralConnectorStatus> {
    try {
      const response = await apiRequest('GET', '/api/neural/status');
      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Error getting neural connector status:', error);
      return {
        status: 'error',
        paths: 0,
        clients: 0,
        timestamp: new Date().toISOString()
      };
    }
  }
  
  // Send a neural signal from source to target
  async sendSignal(source: string, target: string, pair: string, data: any): Promise<{ success: boolean; signalId?: string; message?: string }> {
    try {
      const response = await apiRequest('POST', '/api/neural/signal', {
        source,
        target,
        pair,
        data
      });
      
      const result = await response.json();
      return {
        success: result.status === 'success',
        signalId: result.signalId,
        message: result.message
      };
    } catch (error) {
      console.error('Error sending neural signal:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  // Send a neural signal from MicroQHC to Hyperion
  async sendHyperionFlashSignal(pair: string, profitEstimate: number, metadata: any = {}): Promise<{ success: boolean; signalId?: string; message?: string }> {
    return this.sendSignal('micro_qhc', 'hyperion-1', pair, {
      ...metadata,
      profitEstimate,
      signalType: 'flash_arbitrage',
      neuralLatencyMs: 0.3,
      detectionMethod: 'neural-quantum-pattern-recognition'
    });
  }
  
  // Send a neural signal from MEME Cortex to Quantum Omega
  async sendQuantumOmegaMemecoinSignal(pair: string, metadata: any = {}): Promise<{ success: boolean; signalId?: string; message?: string }> {
    return this.sendSignal('meme_cortex', 'quantum-omega-1', pair, {
      ...metadata,
      signalType: 'memecoin_opportunity',
      neuralLatencyMs: 0.5,
      detectionMethod: 'neural-social-volume-correlation'
    });
  }
}

// Export singleton instance
export const neuralConnector = new NeuralConnectorClient();