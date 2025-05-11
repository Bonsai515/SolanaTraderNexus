/**
 * Client-side Neural Connector Interface
 * 
 * Provides a client-side interface to the server-side neural connector service
 * for ultra-low latency communication between transformers and AI agents.
 */

import { apiRequest } from './queryClient';

// Neural path between transformer and agent
export type NeuralPath = {
  source: string;
  target: string;
  latencyMs: number;
  status: 'active' | 'inactive';
  priority: 'high' | 'normal' | 'low';
};

// Neural connector status
export type NeuralStatus = {
  active: boolean;
  paths: NeuralPath[];
  metricsMs: {
    avgLatency: number;
    minLatency: number;
    maxLatency: number;
  };
  uptime: number;
  lastActivityTimestamp: string;
};

// Signal priority
export type SignalPriority = 'critical' | 'high' | 'normal' | 'low';

// Signal options
export type SignalOptions = {
  priority?: SignalPriority;
  confidenceThreshold?: number;
  maxLatencyMs?: number;
  tracking?: {
    id: string;
    timestamp: number;
  };
};

// Neural signal
export type NeuralSignal = {
  id?: string;
  source: string;
  target: string;
  type: string;
  data: any;
  options?: SignalOptions;
  timestamp?: string;
};

// Neural response
export type NeuralResponse = {
  success: boolean;
  timestamp: string;
  latencyMs: number;
  receiverId?: string;
  responseData?: any;
  error?: string;
};

// Test result
export type TestResult = {
  path: NeuralPath;
  latencyMs: number;
  success: boolean;
  timestamp: string;
  message?: string;
};

class NeuralConnectorClient {
  // Get the status of the neural connector
  async getStatus(): Promise<NeuralStatus> {
    try {
      const response = await apiRequest('GET', '/api/neural/status');
      const data = await response.json();
      
      if (data.status === 'success' && data.data) {
        return data.data;
      } else {
        throw new Error(data.message || 'Failed to get neural connector status');
      }
    } catch (error) {
      console.error('Failed to get neural connector status:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  // Send a signal through a neural pathway
  async sendSignal(signal: NeuralSignal): Promise<NeuralResponse> {
    try {
      const response = await apiRequest('POST', '/api/neural/signal', signal);
      const data = await response.json();
      
      if (data.status === 'success' && data.data) {
        return data.data;
      } else {
        throw new Error(data.error || data.message || 'Failed to send neural signal');
      }
    } catch (error) {
      console.error('Failed to send neural signal:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  // Update a neural path
  async updatePath(path: NeuralPath): Promise<{ success: boolean }> {
    try {
      const response = await apiRequest('POST', '/api/neural/path', path);
      const data = await response.json();
      
      return { 
        success: data.status === 'success'
      };
    } catch (error) {
      console.error('Failed to update neural path:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  // Delete a neural path
  async deletePath(source: string, target: string): Promise<{ success: boolean }> {
    try {
      const response = await apiRequest('DELETE', '/api/neural/path', { source, target });
      const data = await response.json();
      
      return { 
        success: data.status === 'success'
      };
    } catch (error) {
      console.error('Failed to delete neural path:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  // Test the latency of a neural path
  async testLatency(source: string, target: string, iterations: number = 10): Promise<TestResult[]> {
    try {
      const response = await apiRequest('POST', '/api/neural/test-latency', {
        source,
        target,
        iterations
      });
      
      const data = await response.json();
      
      if (data.status === 'success' && data.data && data.data.results) {
        return data.data.results;
      } else {
        throw new Error(data.error || data.message || 'Failed to test neural path latency');
      }
    } catch (error) {
      console.error('Failed to test neural path latency:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  // Get all available transformers
  async getTransformers(): Promise<string[]> {
    try {
      const response = await apiRequest('GET', '/api/neural/transformers');
      const data = await response.json();
      
      if (data.status === 'success' && data.data && data.data.transformers) {
        return data.data.transformers;
      } else {
        throw new Error(data.message || 'Failed to get transformers');
      }
    } catch (error) {
      console.error('Failed to get transformers:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  // Get all available agents
  async getAgents(): Promise<string[]> {
    try {
      const response = await apiRequest('GET', '/api/neural/agents');
      const data = await response.json();
      
      if (data.status === 'success' && data.data && data.data.agents) {
        return data.data.agents;
      } else {
        throw new Error(data.message || 'Failed to get agents');
      }
    } catch (error) {
      console.error('Failed to get agents:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }
}

// Singleton instance
export const neuralConnectorClient = new NeuralConnectorClient();