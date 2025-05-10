/**
 * Signal Monitoring Client
 * 
 * This module provides client-side access to the signal monitoring and validation
 * system. It offers methods to retrieve metrics, validate signals, and monitor
 * component health.
 */

import { apiRequest } from './queryClient';

// Interfaces for signal monitoring data
export interface SignalMetrics {
  lastMinute: TimeFrameStats;
  last10Minutes: TimeFrameStats;
  lastHour: TimeFrameStats;
  last24Hours: TimeFrameStats;
  components: ComponentHealth[];
  validation: ValidationStats;
}

export interface TimeFrameStats {
  total: number;
  valid: number;
  invalid: number;
  withWarnings: number;
  validRatio: number;
  actionable: number;
  byType: Record<string, number>;
  bySource: Record<string, number>;
  byTarget: Record<string, number>;
  byPriority: Record<string, number>;
  validationErrors: Record<string, number>;
  averageProcessingTimeMs: number;
}

export interface ComponentHealth {
  name: string;
  lastActive: Date;
  processedCount: number;
  errorCount: number;
  errorRate: number;
  averageProcessingTimeMs: number;
  status: 'healthy' | 'degraded' | 'error' | 'inactive';
}

export interface ValidationStats {
  totalValidated: number;
  validSignals: number;
  invalidSignals: number;
  warningSignals: number;
  errorsByRule: Record<string, number>;
  latency: {
    average: {
      generation: number;
      validation: number;
      processing: number;
      delivery: number;
      total: number;
    };
    p95: number;
  };
}

export interface DashboardData {
  summary: {
    signalsLastHour: number;
    validRatio: number;
    actionableRatio: number;
    averageLatencyMs: number;
    p95LatencyMs: number;
    activeComponents: number;
    totalComponents: number;
  };
  trends: {
    signal: number;
    validation: number;
    latency: number;
  };
  health: {
    systemStatus: 'healthy' | 'degraded' | 'critical';
    unhealthyComponents: Array<{
      name: string;
      status: string;
      errorRate: number;
      lastActive: Date;
    }>;
  };
  topSignalTypes: Array<{ type: string; count: number }>;
  topSignalSources: Array<{ source: string; count: number }>;
}

export interface HealthStatus {
  status: 'optimal' | 'warning' | 'degraded' | 'critical';
  lastUpdated: Date;
  signalFlow: 'active' | 'inactive';
  validationRate: number;
  componentHealth: {
    healthy: number;
    degraded: number;
    error: number;
    inactive: number;
  };
  alertCount: number;
}

/**
 * Get complete signal metrics and statistics
 * @returns Promise resolving to signal metrics
 */
export async function getSignalMetrics(): Promise<SignalMetrics> {
  const response = await apiRequest('GET', '/api/signal-monitoring/metrics');
  const data = await response.json();
  return data.data;
}

/**
 * Get validation statistics
 * @returns Promise resolving to validation stats
 */
export async function getValidationStats(): Promise<ValidationStats> {
  const response = await apiRequest('GET', '/api/signal-monitoring/validation');
  const data = await response.json();
  return data.data;
}

/**
 * Get component health information
 * @returns Promise resolving to component health array
 */
export async function getComponentHealth(): Promise<ComponentHealth[]> {
  const response = await apiRequest('GET', '/api/signal-monitoring/components');
  const data = await response.json();
  return data.data;
}

/**
 * Get dashboard performance data
 * @returns Promise resolving to dashboard data
 */
export async function getDashboardData(): Promise<DashboardData> {
  const response = await apiRequest('GET', '/api/signal-monitoring/dashboard');
  const data = await response.json();
  return data.data;
}

/**
 * Reset all metrics
 * @returns Promise resolving to success status
 */
export async function resetMetrics(): Promise<{ success: boolean }> {
  const response = await apiRequest('POST', '/api/signal-monitoring/reset');
  const data = await response.json();
  return { success: data.status === 'success' };
}

/**
 * Set up a polling interval to get updated metrics
 * @param callback Function to call with new metrics
 * @param intervalMs Interval in milliseconds
 * @returns Function to cancel the polling
 */
export function setupMetricsPolling(
  callback: (metrics: SignalMetrics) => void,
  intervalMs: number = 5000
): () => void {
  const interval = setInterval(async () => {
    try {
      const metrics = await getSignalMetrics();
      callback(metrics);
    } catch (error) {
      console.error('Error polling signal metrics:', error);
    }
  }, intervalMs);
  
  return () => clearInterval(interval);
}

/**
 * Set up a polling interval to get updated dashboard data
 * @param callback Function to call with new dashboard data
 * @param intervalMs Interval in milliseconds
 * @returns Function to cancel the polling
 */
export function setupDashboardPolling(
  callback: (data: DashboardData) => void,
  intervalMs: number = 5000
): () => void {
  const interval = setInterval(async () => {
    try {
      const data = await getDashboardData();
      callback(data);
    } catch (error) {
      console.error('Error polling dashboard data:', error);
    }
  }, intervalMs);
  
  return () => clearInterval(interval);
}

/**
 * Get real-time signal health for status displays
 * @returns Promise resolving to health status
 */
export async function getSystemHealth(): Promise<HealthStatus> {
  try {
    const response = await apiRequest('GET', '/api/system/health');
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error getting system health:', error);
    return {
      status: 'critical',
      lastUpdated: new Date(),
      signalFlow: 'inactive',
      validationRate: 0,
      componentHealth: {
        healthy: 0,
        degraded: 0,
        error: 0,
        inactive: 0
      },
      alertCount: 1
    };
  }
}