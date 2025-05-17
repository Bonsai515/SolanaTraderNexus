/**
 * Health Monitor Service
 * 
 * Monitors the health of all system components and dependencies
 * to provide real-time status information and proactive failover
 */

import { rpcManager } from './enhancedRpcManager';
import { priceAggregator } from './advancedPriceAggregator';
import { pythPriceService } from './pythPriceService';

// Health statuses
export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
  UNKNOWN = 'unknown'
}

// Service health interface
interface ServiceHealth {
  name: string;
  status: HealthStatus;
  lastCheck: number;
  details?: any;
}

/**
 * System Health Monitor
 */
export class HealthMonitor {
  private serviceHealth: Map<string, ServiceHealth> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL = 60000; // 1 minute

  constructor() {
    // Initialize service health
    this.initializeServiceHealth();
  }

  /**
   * Initialize service health states
   */
  private initializeServiceHealth(): void {
    // Core RPC service
    this.serviceHealth.set('rpc', {
      name: 'Solana RPC',
      status: HealthStatus.UNKNOWN,
      lastCheck: 0
    });

    // Price services
    this.serviceHealth.set('priceAggregator', {
      name: 'Price Aggregator',
      status: HealthStatus.UNKNOWN,
      lastCheck: 0
    });

    this.serviceHealth.set('pythNetwork', {
      name: 'Pyth Network',
      status: HealthStatus.UNKNOWN,
      lastCheck: 0
    });

    // External APIs
    this.serviceHealth.set('coinGecko', {
      name: 'CoinGecko API',
      status: HealthStatus.UNKNOWN,
      lastCheck: 0
    });

    this.serviceHealth.set('jupiterAggregator', {
      name: 'Jupiter Aggregator',
      status: HealthStatus.UNKNOWN,
      lastCheck: 0
    });

    console.log('[HealthMonitor] Initialized service health monitoring');
  }

  /**
   * Start health monitoring
   */
  startMonitoring(): void {
    if (this.healthCheckInterval) return;

    // Run initial health check
    this.performHealthCheck();

    // Set up interval for regular checks
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.CHECK_INTERVAL);

    console.log('[HealthMonitor] Started health monitoring');
  }

  /**
   * Stop health monitoring
   */
  stopMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    console.log('[HealthMonitor] Stopped health monitoring');
  }

  /**
   * Perform health check on all services
   */
  async performHealthCheck(): Promise<void> {
    console.log('[HealthMonitor] Performing health check on all services');

    // Check RPC health
    await this.checkRpcHealth();

    // Check price aggregator health
    this.checkPriceAggregatorHealth();

    // Check Pyth Network health
    await this.checkPythNetworkHealth();

    // Check external APIs
    await this.checkExternalApisHealth();

    // Log overall system health
    this.logSystemHealth();
  }

  /**
   * Check RPC health
   */
  private async checkRpcHealth(): Promise<void> {
    try {
      // Get RPC endpoint status
      const status = rpcManager.getEndpointStatus();
      const healthyEndpoints = status.filter(e => e.healthy).length;
      
      // Determine health status
      let healthStatus = HealthStatus.HEALTHY;
      if (healthyEndpoints === 0) {
        healthStatus = HealthStatus.UNHEALTHY;
      } else if (healthyEndpoints < status.length / 2) {
        healthStatus = HealthStatus.DEGRADED;
      }

      // Update service health
      this.serviceHealth.set('rpc', {
        name: 'Solana RPC',
        status: healthStatus,
        lastCheck: Date.now(),
        details: {
          totalEndpoints: status.length,
          healthyEndpoints,
          endpoints: status
        }
      });
    } catch (error) {
      // Set service as unhealthy
      this.serviceHealth.set('rpc', {
        name: 'Solana RPC',
        status: HealthStatus.UNHEALTHY,
        lastCheck: Date.now(),
        details: {
          error: error instanceof Error ? error.message : String(error)
        }
      });
    }
  }

  /**
   * Check price aggregator health
   */
  private checkPriceAggregatorHealth(): void {
    try {
      // Check price aggregator status
      const circuitStatus = priceAggregator.getCircuitStatus();
      const openCircuits = circuitStatus.filter((c: any) => c.state === 'OPEN').length;
      
      // Determine health status
      let healthStatus = HealthStatus.HEALTHY;
      if (openCircuits === circuitStatus.length) {
        healthStatus = HealthStatus.UNHEALTHY;
      } else if (openCircuits > 0) {
        healthStatus = HealthStatus.DEGRADED;
      }

      // Update service health
      this.serviceHealth.set('priceAggregator', {
        name: 'Price Aggregator',
        status: healthStatus,
        lastCheck: Date.now(),
        details: {
          circuits: circuitStatus
        }
      });
    } catch (error) {
      // Set service as unhealthy
      this.serviceHealth.set('priceAggregator', {
        name: 'Price Aggregator',
        status: HealthStatus.UNHEALTHY,
        lastCheck: Date.now(),
        details: {
          error: error instanceof Error ? error.message : String(error)
        }
      });
    }
  }

  /**
   * Check Pyth Network health
   */
  private async checkPythNetworkHealth(): Promise<void> {
    try {
      // Check Pyth Network status
      const isHealthy = await pythPriceService.checkHealth();
      const circuitStatus = pythPriceService.getCircuitStatus();
      
      // Update service health
      this.serviceHealth.set('pythNetwork', {
        name: 'Pyth Network',
        status: isHealthy ? HealthStatus.HEALTHY : HealthStatus.DEGRADED,
        lastCheck: Date.now(),
        details: {
          circuitBreakers: circuitStatus
        }
      });
    } catch (error) {
      // Set service as unhealthy
      this.serviceHealth.set('pythNetwork', {
        name: 'Pyth Network',
        status: HealthStatus.UNHEALTHY,
        lastCheck: Date.now(),
        details: {
          error: error instanceof Error ? error.message : String(error)
        }
      });
    }
  }

  /**
   * Check external APIs health
   */
  private async checkExternalApisHealth(): Promise<void> {
    // Check CoinGecko health
    const cgCircuit = pythPriceService.getCircuitStatus()
      .find((c: any) => c.source === 'coingecko');
    
    this.serviceHealth.set('coinGecko', {
      name: 'CoinGecko API',
      status: cgCircuit && cgCircuit.state === 'OPEN' ? 
        HealthStatus.UNHEALTHY : HealthStatus.HEALTHY,
      lastCheck: Date.now(),
      details: cgCircuit
    });

    // Check Jupiter health - simulated for now
    this.serviceHealth.set('jupiterAggregator', {
      name: 'Jupiter Aggregator',
      status: HealthStatus.HEALTHY, // Assuming working
      lastCheck: Date.now()
    });
  }

  /**
   * Log overall system health
   */
  private logSystemHealth(): void {
    const services = Array.from(this.serviceHealth.values());
    const healthyCount = services.filter(s => s.status === HealthStatus.HEALTHY).length;
    const degradedCount = services.filter(s => s.status === HealthStatus.DEGRADED).length;
    const unhealthyCount = services.filter(s => s.status === HealthStatus.UNHEALTHY).length;

    if (unhealthyCount > 0) {
      console.warn(`[HealthMonitor] System health: ${healthyCount} healthy, ${degradedCount} degraded, ${unhealthyCount} unhealthy services`);
    } else if (degradedCount > 0) {
      console.log(`[HealthMonitor] System health: ${healthyCount} healthy, ${degradedCount} degraded, ${unhealthyCount} unhealthy services`);
    } else {
      console.log(`[HealthMonitor] System health: All ${healthyCount} services healthy`);
    }
  }

  /**
   * Get current health status of all services
   */
  getServiceHealth(): ServiceHealth[] {
    return Array.from(this.serviceHealth.values());
  }

  /**
   * Check RPC for endpoint issues
   */
  checkRpcEndpointHealth(): void {
    // Force health check for RPC endpoints
    const rpcStatus = rpcManager.getEndpointStatus();
    
    // Update RPC health
    const healthyEndpoints = rpcStatus.filter(e => e.healthy).length;
    const totalEndpoints = rpcStatus.length;
    
    // Report status
    if (healthyEndpoints === 0) {
      console.error(`[HealthMonitor] CRITICAL: All ${totalEndpoints} RPC endpoints are unhealthy!`);
    } else if (healthyEndpoints < totalEndpoints / 2) {
      console.warn(`[HealthMonitor] WARNING: Only ${healthyEndpoints}/${totalEndpoints} RPC endpoints are healthy`);
    }
  }
  
  /**
   * Get overall system health
   */
  getSystemHealth(): {
    status: HealthStatus;
    services: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
    unknown: number;
    lastCheck: number;
  } {
    const services = Array.from(this.serviceHealth.values());
    const total = services.length;
    const healthy = services.filter(s => s.status === HealthStatus.HEALTHY).length;
    const degraded = services.filter(s => s.status === HealthStatus.DEGRADED).length;
    const unhealthy = services.filter(s => s.status === HealthStatus.UNHEALTHY).length;
    const unknown = services.filter(s => s.status === HealthStatus.UNKNOWN).length;

    let status = HealthStatus.HEALTHY;
    if (unhealthy > 0) {
      status = HealthStatus.UNHEALTHY;
    } else if (degraded > 0) {
      status = HealthStatus.DEGRADED;
    } else if (unknown > 0) {
      status = HealthStatus.UNKNOWN;
    }

    return {
      status,
      services: total,
      healthy,
      degraded,
      unhealthy,
      unknown,
      lastCheck: Math.max(...services.map(s => s.lastCheck))
    };
  }
}

// Export singleton instance
export const healthMonitor = new HealthMonitor();
export default healthMonitor;