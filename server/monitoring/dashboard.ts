/**
 * Command-line Trading Platform Monitoring Dashboard
 * 
 * A TypeScript-based monitoring system that displays real-time metrics
 * without requiring a web interface
 */

import { rpcManager } from '../lib/enhancedRpcManager';
import { multiSourcePriceFeed } from '../lib/multiSourcePriceFeed';
import { pythPriceService } from '../lib/pythPriceService';
import { healthMonitor } from '../lib/healthMonitor';
import * as fs from 'fs';
import * as path from 'path';

// Dashboard settings
const REFRESH_INTERVAL = 5000; // 5 seconds
const LOG_DIR = path.join(process.cwd(), 'logs');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  underscore: '\x1b[4m',
  blink: '\x1b[5m',
  reverse: '\x1b[7m',
  hidden: '\x1b[8m',
  
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m'
};

/**
 * Monitoring Dashboard
 */
export class MonitoringDashboard {
  private refreshInterval: NodeJS.Timeout | null = null;
  private metricsLog: any[] = [];
  private startTime: number = Date.now();
  private previousRpcCalls: number = 0;
  private previousRPCUtilization: Record<string, number> = {};
  
  constructor() {
    // Ensure log directory exists
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
  }
  
  /**
   * Start the monitoring dashboard
   */
  start(): void {
    console.log(`${colors.bright}${colors.cyan}Starting Trading Platform Monitoring Dashboard${colors.reset}`);
    
    // Clear the console
    console.clear();
    
    // Display initial dashboard
    this.refreshDashboard();
    
    // Set up refresh interval
    this.refreshInterval = setInterval(() => {
      this.refreshDashboard();
    }, REFRESH_INTERVAL);
    
    // Handle process exit
    process.on('SIGINT', () => {
      this.stop();
      process.exit(0);
    });
  }
  
  /**
   * Stop the monitoring dashboard
   */
  stop(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
    
    console.log(`${colors.bright}${colors.yellow}Monitoring Dashboard Stopped${colors.reset}`);
  }
  
  /**
   * Refresh the dashboard
   */
  private refreshDashboard(): void {
    // Clear the console
    console.clear();
    
    // Get current metrics
    const metrics = this.collectMetrics();
    
    // Add to metrics log
    this.metricsLog.push(metrics);
    
    // Keep only the last 100 entries
    if (this.metricsLog.length > 100) {
      this.metricsLog.shift();
    }
    
    // Write metrics to log file
    this.writeMetricsToFile(metrics);
    
    // Display the dashboard
    this.renderDashboard(metrics);
  }
  
  /**
   * Collect system metrics
   */
  private collectMetrics(): any {
    const now = Date.now();
    const uptime = now - this.startTime;
    
    // Memory usage
    const memoryUsage = process.memoryUsage();
    
    // RPC metrics
    const rpcStatus = rpcManager.getEndpointStatus();
    const rpcEndpoints = rpcStatus.map(endpoint => ({
      url: endpoint.url,
      label: endpoint.label || 'Unnamed',
      healthy: endpoint.healthy,
      state: endpoint.circuitState,
      latency: endpoint.latency
    }));
    
    // Calculate RPC calls per second
    const currentRpcCalls = rpcEndpoints.reduce((sum, endpoint) => {
      const prevCalls = this.previousRPCUtilization[endpoint.url] || 0;
      const diff = (endpoint.latency || 0) - prevCalls;
      this.previousRPCUtilization[endpoint.url] = endpoint.latency || 0;
      return sum + (diff > 0 ? diff : 0);
    }, 0);
    
    const rpcCallsPerSecond = currentRpcCalls / (REFRESH_INTERVAL / 1000);
    this.previousRpcCalls = currentRpcCalls;
    
    // Price feed metrics
    const priceSourceStatus = multiSourcePriceFeed.getSourceStatus();
    const pythStatus = pythPriceService ? pythPriceService.getCircuitStatus() : [];
    
    // Health metrics
    const systemHealth = healthMonitor.getSystemHealth();
    const serviceHealth = healthMonitor.getServiceHealth();
    
    return {
      timestamp: now,
      uptime,
      memory: {
        rss: Math.round(memoryUsage.rss / (1024 * 1024)),
        heapTotal: Math.round(memoryUsage.heapTotal / (1024 * 1024)),
        heapUsed: Math.round(memoryUsage.heapUsed / (1024 * 1024)),
        external: Math.round(memoryUsage.external / (1024 * 1024))
      },
      rpc: {
        endpoints: rpcEndpoints,
        callsPerSecond: rpcCallsPerSecond,
        healthyEndpoints: rpcEndpoints.filter(e => e.healthy).length,
        totalEndpoints: rpcEndpoints.length
      },
      priceFeeds: {
        sources: priceSourceStatus,
        pyth: pythStatus,
        sourceCount: priceSourceStatus.length,
        healthySources: priceSourceStatus.filter((s: any) => s.state === 'CLOSED').length
      },
      health: {
        status: systemHealth.status,
        services: serviceHealth,
        healthyServices: systemHealth.healthy,
        unhealthyServices: systemHealth.unhealthy,
        totalServices: systemHealth.services
      }
    };
  }
  
  /**
   * Write metrics to log file
   */
  private writeMetricsToFile(metrics: any): void {
    const logFile = path.join(LOG_DIR, `metrics-${new Date().toISOString().split('T')[0]}.json`);
    
    try {
      let logs = [];
      
      // Read existing logs if file exists
      if (fs.existsSync(logFile)) {
        const content = fs.readFileSync(logFile, 'utf8');
        logs = JSON.parse(content);
      }
      
      // Add new metrics
      logs.push(metrics);
      
      // Keep only the last 1000 entries
      if (logs.length > 1000) {
        logs = logs.slice(logs.length - 1000);
      }
      
      // Write back to file
      fs.writeFileSync(logFile, JSON.stringify(logs, null, 2));
    } catch (error) {
      console.error(`Error writing metrics to file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Format uptime into human-readable string
   */
  private formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    return `${days}d ${hours % 24}h ${minutes % 60}m ${seconds % 60}s`;
  }
  
  /**
   * Format bytes into human-readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
  
  /**
   * Get color for health status
   */
  private getStatusColor(status: string): string {
    switch (status.toLowerCase()) {
      case 'healthy':
        return colors.green;
      case 'degraded':
        return colors.yellow;
      case 'unhealthy':
        return colors.red;
      default:
        return colors.white;
    }
  }
  
  /**
   * Render monitoring dashboard
   */
  private renderDashboard(metrics: any): void {
    // Display header
    console.log(`${colors.bgBlue}${colors.white}${colors.bright} SOLANA TRADING PLATFORM MONITORING ${colors.reset}`);
    console.log(`${colors.dim}Last Updated: ${new Date().toISOString()} | Uptime: ${this.formatUptime(metrics.uptime)}${colors.reset}`);
    console.log();
    
    // Display system health
    const healthStatus = metrics.health.status;
    const healthColor = this.getStatusColor(healthStatus);
    console.log(`${colors.bright}SYSTEM HEALTH:${colors.reset} ${healthColor}${healthStatus.toUpperCase()}${colors.reset}`);
    console.log(`Services: ${colors.green}${metrics.health.healthyServices} healthy${colors.reset}, ${colors.yellow}${metrics.health.totalServices - metrics.health.healthyServices - metrics.health.unhealthyServices} degraded${colors.reset}, ${colors.red}${metrics.health.unhealthyServices} unhealthy${colors.reset}`);
    console.log();
    
    // Display RPC status
    console.log(`${colors.bright}RPC ENDPOINTS (${metrics.rpc.healthyEndpoints}/${metrics.rpc.totalEndpoints} healthy)${colors.reset}`);
    metrics.rpc.endpoints.forEach((endpoint: any) => {
      const statusColor = endpoint.healthy ? colors.green : colors.red;
      console.log(`${statusColor}• ${endpoint.label}${colors.reset} - ${endpoint.state} (${endpoint.latency}ms)`);
    });
    console.log(`RPC Calls/sec: ${metrics.rpc.callsPerSecond.toFixed(2)}`);
    console.log();
    
    // Display price feed status
    console.log(`${colors.bright}PRICE FEEDS (${metrics.priceFeeds.healthySources}/${metrics.priceFeeds.sourceCount} healthy)${colors.reset}`);
    metrics.priceFeeds.sources.forEach((source: any) => {
      const statusColor = source.state === 'CLOSED' ? colors.green : colors.red;
      console.log(`${statusColor}• ${source.name}${colors.reset} - ${source.state} (${source.isRateLimited ? 'Rate Limited' : 'OK'})`);
    });
    console.log();
    
    // Display memory usage
    console.log(`${colors.bright}MEMORY USAGE${colors.reset}`);
    console.log(`RSS: ${metrics.memory.rss} MB | Heap: ${metrics.memory.heapUsed}/${metrics.memory.heapTotal} MB | External: ${metrics.memory.external} MB`);
    console.log();
    
    // Display service health details
    console.log(`${colors.bright}SERVICE HEALTH DETAILS${colors.reset}`);
    metrics.health.services.forEach((service: any) => {
      const statusColor = this.getStatusColor(service.status);
      console.log(`${statusColor}• ${service.name}: ${service.status}${colors.reset} (Last checked: ${new Date(service.lastCheck).toISOString()})`);
    });
    
    // Display footer
    console.log();
    console.log(`${colors.dim}Press CTRL+C to exit dashboard${colors.reset}`);
  }
}

// Entry point when run directly
if (require.main === module) {
  const dashboard = new MonitoringDashboard();
  dashboard.start();
}

export default MonitoringDashboard;