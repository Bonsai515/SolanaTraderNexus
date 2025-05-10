/**
 * Signal Monitoring Client
 * 
 * This module provides functions to retrieve monitoring data from the server
 * for display in the system dashboard.
 */

export interface SignalMetric {
  type: string;
  count: number;
  validCount: number;
  errorCount: number;
  averageProcessingTimeMs: number;
  pairDistribution: Record<string, number>;
}

export interface ComponentHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'error' | 'inactive';
  lastActive: string;
  averageProcessingTimeMs: number;
  errorRate: number;
  processedCount: number;
}

export interface SystemHealthMetrics {
  status: 'optimal' | 'warning' | 'critical';
  lastUpdated: string;
  signalFlow: 'active' | 'inactive';
  validationRate: number;
  componentHealth: {
    healthy: number;
    degraded: number;
    error: number;
    inactive: number;
  };
  alertCount: number;
  alertDetails?: Array<{
    component: string;
    message: string;
    severity: 'low' | 'medium' | 'high';
    timestamp: string;
  }>;
  performance: {
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    networkLatency: number;
  };
}

export interface SignalType {
  type: string;
  count: number;
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
  topSignalTypes: SignalType[];
  recentAlerts: Array<{
    component: string;
    message: string;
    severity: 'low' | 'medium' | 'high';
    timestamp: string;
  }>;
}

/**
 * Get overall dashboard data
 * @returns Promise resolving to dashboard data
 */
export async function getDashboardData(): Promise<DashboardData> {
  const response = await fetch('/api/signal-monitoring/dashboard');
  if (!response.ok) {
    throw new Error(`Failed to fetch dashboard data: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.data;
}

/**
 * Get metrics for a specific signal type
 * @param type Signal type to get metrics for
 * @returns Promise resolving to signal metrics
 */
export async function getSignalMetrics(type: string): Promise<SignalMetric> {
  const response = await fetch(`/api/signal-monitoring/metrics?type=${encodeURIComponent(type)}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch signal metrics: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.metrics;
}

/**
 * Get component health data
 * @returns Promise resolving to array of component health data
 */
export async function getComponentHealth(): Promise<ComponentHealth[]> {
  const response = await fetch('/api/signal-monitoring/components');
  if (!response.ok) {
    throw new Error(`Failed to fetch component health: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.components;
}

/**
 * Get overall system health
 * @returns Promise resolving to system health metrics
 */
export async function getSystemHealth(): Promise<SystemHealthMetrics> {
  const response = await fetch('/api/signal-monitoring/metrics?includeSystem=true');
  if (!response.ok) {
    throw new Error(`Failed to fetch system health: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.systemHealth;
}

/**
 * Get signal volume over time
 * @param timeframe Timeframe to get volume for (1h, 24h, 7d)
 * @returns Promise resolving to signal volume data
 */
export async function getSignalVolume(timeframe: '1h' | '24h' | '7d'): Promise<Array<{ timestamp: string; count: number }>> {
  const response = await fetch(`/api/signal-monitoring/metrics?volumeTimeframe=${timeframe}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch signal volume: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.volumeData || [];
}

/**
 * Get alert history
 * @param count Number of alerts to retrieve
 * @returns Promise resolving to array of alerts
 */
export async function getAlertHistory(count: number = 10): Promise<Array<{
  component: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
  timestamp: string;
}>> {
  const response = await fetch(`/api/signal-monitoring/metrics?alertCount=${count}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch alert history: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.alerts || [];
}