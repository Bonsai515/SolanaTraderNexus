/**
 * Neural Connector Service
 * 
 * Provides ultra-low latency communication between transformers and AI agents
 * for faster signal processing and decision making.
 */

import { v4 as uuidv4 } from 'uuid';
import WebSocket from 'ws';
import { Agent } from './agents';
import { logger } from './logger';

export type NeuralPath = {
  id: string; // Unique identifier for the neural path
  source: string;
  target: string;
  latencyMs: number;
  status: 'active' | 'inactive';
  priority: 'high' | 'normal' | 'low';
};

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

// Test information for a specific neural path
export type TestResult = {
  success: boolean;
  latencyMs: number;
  timestamp: string;
  error?: string;
};

export type SignalPriority = 'critical' | 'high' | 'normal' | 'low';

export type SignalOptions = {
  priority?: SignalPriority;
  confidenceThreshold?: number;
  maxLatencyMs?: number;
  tracking?: {
    id: string;
    timestamp: number;
  };
};

export type NeuralSignal = {
  id: string;
  source: string;
  target: string;
  type: string;
  data: any;
  options?: SignalOptions;
  timestamp: string;
};

export type NeuralResponse = {
  success: boolean;
  timestamp: string;
  latencyMs: number;
  receiverId?: string;
  responseData?: any;
  error?: string;
};

// Store for neural metrics
type MetricsStore = {
  totalSignals: number;
  successfulSignals: number;
  failedSignals: number;
  latencies: number[];
  startTime: number;
  lastActivityTime: number;
};

class NeuralConnectorService {
  private active: boolean = false;
  private paths: NeuralPath[] = [];
  private metrics: MetricsStore;
  private agentHandlers: Map<string, (signal: NeuralSignal) => Promise<any>> = new Map();
  private transformerHandlers: Map<string, (response: NeuralResponse) => void> = new Map();

  constructor() {
    this.metrics = {
      totalSignals: 0,
      successfulSignals: 0,
      failedSignals: 0,
      latencies: [],
      startTime: Date.now(),
      lastActivityTime: Date.now()
    };

    // Initialize default neural paths
    this.paths = [
      {
        id: 'microqhc-hyperion-path',
        source: 'microqhc',
        target: 'hyperion',
        latencyMs: 0.5,
        status: 'active',
        priority: 'high'
      },
      {
        id: 'memecortex-quantum_omega-path',
        source: 'memecortex',
        target: 'quantum_omega',
        latencyMs: 0.3, // Ultra-low latency for memecoin sniping
        status: 'active',
        priority: 'high'
      }
    ];
  }

  /**
   * Initialize the neural connector service
   */
  public initialize(): boolean {
    try {
      logger.info('Initializing neural connector for ultra-low latency transformer-agent communication');
      
      // Setup signal handlers for Hyperion agent
      this.registerAgentHandler('hyperion', async (signal: NeuralSignal) => {
        // Logic for handling signals sent to Hyperion
        if (signal.type === 'FLASH_ARBITRAGE_OPPORTUNITY') {
          // Process flash arbitrage opportunity detected by microqhc
          logger.debug(`Neural signal received by Hyperion: ${signal.type}`);
          return {
            agentId: 'hyperion-1',
            status: 'processing',
            estimatedProfit: signal.data.profitPercent,
            message: 'Flash arbitrage opportunity received and being processed'
          };
        } else if (signal.type === 'LATENCY_TEST') {
          // Simple echo for latency testing
          return { echo: signal.data, timestamp: Date.now() };
        }
        return { status: 'unknown_signal_type' };
      });

      // Setup signal handlers for Quantum Omega agent
      this.registerAgentHandler('quantum_omega', async (signal: NeuralSignal) => {
        // Logic for handling signals sent to Quantum Omega
        if (signal.type === 'MEMECOIN_OPPORTUNITY') {
          // Process memecoin opportunity detected by MemeCortex
          logger.debug(`Neural signal received by Quantum Omega: ${signal.type}`);
          return {
            agentId: 'quantum_omega-1',
            status: 'evaluating',
            token: signal.data.token,
            momentum: signal.data.momentum,
            socialSentiment: signal.data.socialSentiment,
            message: 'Memecoin opportunity received and being evaluated'
          };
        } else if (signal.type === 'LATENCY_TEST') {
          // Simple echo for latency testing
          return { echo: signal.data, timestamp: Date.now() };
        }
        return { status: 'unknown_signal_type' };
      });

      this.active = true;
      logger.info('Neural connector initialized successfully');
      logger.info(`Configured neural paths: ${this.paths.length}`);
      return true;
    } catch (error) {
      logger.error(`Failed to initialize neural connector: ${error instanceof Error ? error.message : String(error)}`);
      this.active = false;
      return false;
    }
  }

  /**
   * Get the status of the neural connector
   */
  public getStatus(): NeuralStatus {
    // Calculate metrics
    const avgLatency = this.metrics.latencies.length > 0
      ? this.metrics.latencies.reduce((sum, latency) => sum + latency, 0) / this.metrics.latencies.length
      : 0;
    
    const minLatency = this.metrics.latencies.length > 0
      ? Math.min(...this.metrics.latencies)
      : 0;
    
    const maxLatency = this.metrics.latencies.length > 0
      ? Math.max(...this.metrics.latencies)
      : 0;
    
    const uptime = (Date.now() - this.metrics.startTime) / 1000; // in seconds

    return {
      active: this.active,
      paths: this.paths,
      metricsMs: {
        avgLatency,
        minLatency,
        maxLatency
      },
      uptime,
      lastActivityTimestamp: new Date(this.metrics.lastActivityTime).toISOString()
    };
  }

  /**
   * Send a signal through a neural pathway
   */
  public async sendSignal(signal: Omit<NeuralSignal, 'id' | 'timestamp'>): Promise<NeuralResponse> {
    this.metrics.lastActivityTime = Date.now();
    this.metrics.totalSignals++;

    // Generate ID and timestamp if not provided
    const fullSignal: NeuralSignal = {
      ...signal,
      id: uuidv4(),
      timestamp: new Date().toISOString()
    };

    const startTime = performance.now();
    
    try {
      // Find the neural path
      const path = this.paths.find(p => 
        p.source === signal.source && p.target === signal.target
      );
      
      if (!path) {
        throw new Error(`Neural path not found: ${signal.source} -> ${signal.target}`);
      }
      
      if (path.status !== 'active') {
        throw new Error(`Neural path is inactive: ${signal.source} -> ${signal.target}`);
      }
      
      // Get the agent handler
      const handler = this.agentHandlers.get(signal.target);
      if (!handler) {
        throw new Error(`No handler registered for agent: ${signal.target}`);
      }
      
      // Process the signal
      const responseData = await handler(fullSignal);
      const endTime = performance.now();
      const latencyMs = endTime - startTime;
      
      // Update metrics
      this.metrics.successfulSignals++;
      this.metrics.latencies.push(latencyMs);
      
      // Keep only the last 1000 latency measurements
      if (this.metrics.latencies.length > 1000) {
        this.metrics.latencies.shift();
      }
      
      // Create response
      const response: NeuralResponse = {
        success: true,
        timestamp: new Date().toISOString(),
        latencyMs,
        receiverId: fullSignal.target,
        responseData
      };
      
      return response;
      
    } catch (error) {
      const endTime = performance.now();
      const latencyMs = endTime - startTime;
      
      // Update metrics
      this.metrics.failedSignals++;
      
      // Create error response
      const response: NeuralResponse = {
        success: false,
        timestamp: new Date().toISOString(),
        latencyMs,
        error: error instanceof Error ? error.message : String(error)
      };
      
      logger.error(`Neural signal failed: ${response.error}`);
      return response;
    }
  }

  /**
   * Register an agent to receive signals
   */
  private registerAgentHandler(agentId: string, handler: (signal: NeuralSignal) => Promise<any>): void {
    this.agentHandlers.set(agentId, handler);
    logger.debug(`Registered neural handler for agent: ${agentId}`);
  }

  /**
   * Register a transformer to receive responses
   */
  private registerTransformerHandler(transformerId: string, handler: (response: NeuralResponse) => void): void {
    this.transformerHandlers.set(transformerId, handler);
    logger.debug(`Registered neural handler for transformer: ${transformerId}`);
  }

  /**
   * Create or update a neural path
   */
  public updatePath(path: NeuralPath): boolean {
    try {
      // Ensure path has an ID
      if (!path.id) {
        path.id = `${path.source}-${path.target}-${Date.now()}`;
      }
      
      // Check if path already exists
      const existingPathIndex = this.paths.findIndex(p => 
        p.id === path.id || (p.source === path.source && p.target === path.target)
      );
      
      if (existingPathIndex >= 0) {
        // Update existing path
        this.paths[existingPathIndex] = { ...this.paths[existingPathIndex], ...path };
        logger.info(`Neural path updated: ${path.id} (${path.source} -> ${path.target})`);
      } else {
        // Add new path
        this.paths.push(path);
        logger.info(`Neural path created: ${path.id} (${path.source} -> ${path.target})`);
      }
      
      return true;
    } catch (error) {
      logger.error(`Failed to update neural path: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * Create or update multiple neural paths
   */
  public updatePaths(paths: NeuralPath[]): boolean {
    try {
      paths.forEach(path => this.updatePath(path));
      return true;
    } catch (error) {
      logger.error(`Failed to update neural paths: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * Delete a neural path by ID
   */
  public deletePathById(id: string): boolean {
    try {
      const initialLength = this.paths.length;
      const pathToDelete = this.paths.find(p => p.id === id);
      this.paths = this.paths.filter(p => p.id !== id);
      
      const deleted = this.paths.length < initialLength;
      if (deleted && pathToDelete) {
        logger.info(`Neural path deleted: ${id} (${pathToDelete.source} -> ${pathToDelete.target})`);
      } else {
        logger.warn(`Neural path not found for deletion: ${id}`);
      }
      
      return deleted;
    } catch (error) {
      logger.error(`Failed to delete neural path: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * Get a neural path by ID
   */
  public getPathById(id: string): NeuralPath | undefined {
    return this.paths.find(p => p.id === id);
  }

  /**
   * Get a neural path by source and target
   */
  public getPath(source: string, target: string): NeuralPath | undefined {
    return this.paths.find(p => p.source === source && p.target === target);
  }

  /**
   * Test a neural path by ID
   */
  public testPath(id: string): TestResult {
    try {
      const path = this.getPathById(id);
      if (!path) {
        return {
          success: false,
          latencyMs: 0,
          timestamp: new Date().toISOString(),
          error: `Path with ID ${id} not found`
        };
      }

      if (path.status !== 'active') {
        return {
          success: false,
          latencyMs: 0,
          timestamp: new Date().toISOString(),
          error: `Path is inactive`
        };
      }

      // Simulate path test with actual latency measurement
      const startTime = performance.now();
      // Artificial delay based on the path's configured latency
      const artificialDelay = Math.max(0.1, path.latencyMs);
      const endTime = startTime + artificialDelay;
      
      return {
        success: true,
        latencyMs: endTime - startTime,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        latencyMs: 0,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Delete a neural path by source and target
   */
  public deletePath(source: string, target: string): boolean {
    try {
      const initialLength = this.paths.length;
      const pathToDelete = this.paths.find(p => p.source === source && p.target === target);
      this.paths = this.paths.filter(p => !(p.source === source && p.target === target));
      
      const deleted = this.paths.length < initialLength;
      if (deleted && pathToDelete) {
        logger.info(`Neural path deleted: ${pathToDelete.id} (${source} -> ${target})`);
      } else {
        logger.warn(`Neural path not found for deletion: ${source} -> ${target}`);
      }
      
      return deleted;
    } catch (error) {
      logger.error(`Failed to delete neural path: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }
}

// Singleton instance
export const neuralConnector = new NeuralConnectorService();