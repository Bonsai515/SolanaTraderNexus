/**
 * Signal Monitoring Service
 * 
 * This module provides real-time monitoring of trading signals
 * through WebSocket connections and broadcasts updates to clients.
 * Enhanced with component-specific targeting and health metrics.
 */

import WebSocket from 'ws';
import { logger } from './logger';
import { v4 as uuidv4 } from 'uuid';
import { SignalSource, SignalType } from '../shared/signalTypes';

// WebSocket client with subscription information
interface MonitoringClient {
  ws: WebSocket;
  id: string;
  subscribedComponents: Set<string>;
  subscribedSignalTypes: Set<SignalType>;
  subscribedSources: Set<SignalSource>;
  lastActivity: Date;
  metadata: Record<string, any>;
}

// Collection of connected WebSocket clients for signal monitoring
const signalMonitoringClients: Map<string, MonitoringClient> = new Map();

// Component health status and metadata
interface ComponentHealth {
  status: 'healthy' | 'degraded' | 'failing';
  lastUpdated: Date;
  metrics: Record<string, any>;
  errorCount: number;
  lastError?: string;
  responseTime?: number;
  activeConnections?: number;
}

// Monitoring metrics with enhanced typing
interface MonitoringMetrics {
  signalsProcessed: number;
  signalsRejected: number;
  averageLatency: number;
  latencyMeasurements: number;
  componentHealth: Record<string, ComponentHealth>;
  errors: number;
  lastError: string | null;
  signalsSent: number;
  signalThroughput: number; // signals per second
  connectedClients: number;
  systemLoad: Record<string, number>;
  started: string;
}

// Initialize monitoring metrics
let metrics: MonitoringMetrics = {
  signalsProcessed: 0,
  signalsRejected: 0,
  averageLatency: 0,
  latencyMeasurements: 0,
  componentHealth: {},
  errors: 0,
  lastError: null,
  signalsSent: 0,
  signalThroughput: 0,
  connectedClients: 0,
  systemLoad: {
    cpu: 0,
    memory: 0,
    network: 0
  },
  started: new Date().toISOString(),
};

/**
 * Add a WebSocket client to the signal monitoring service with enhanced tracking
 * @param ws WebSocket client to add
 * @param metadata Optional client metadata
 * @returns Client ID
 */
function addSignalMonitoringClient(ws: WebSocket, metadata: Record<string, any> = {}): string {
  const clientId = uuidv4();
  
  const client: MonitoringClient = {
    ws,
    id: clientId,
    subscribedComponents: new Set<string>(),
    subscribedSignalTypes: new Set<SignalType>(),
    subscribedSources: new Set<SignalSource>(),
    lastActivity: new Date(),
    metadata
  };
  
  signalMonitoringClients.set(clientId, client);
  metrics.connectedClients = signalMonitoringClients.size;
  
  logger.debug(`Signal monitoring client added. ID: ${clientId}. Total clients: ${signalMonitoringClients.size}`);
  
  // Send welcome message with client ID
  try {
    ws.send(JSON.stringify({
      type: 'MONITORING_CONNECTED',
      clientId,
      timestamp: new Date().toISOString(),
      message: 'Connected to signal monitoring service'
    }));
  } catch (err) {
    logger.error('Error sending welcome message to new monitoring client', err);
  }
  
  return clientId;
}

/**
 * Remove a WebSocket client from the signal monitoring service
 * @param ws WebSocket client to remove
 */
function removeSignalMonitoringClient(ws: WebSocket): void {
  // Find client ID by websocket instance
  let clientIdToRemove: string | null = null;
  
  for (const [clientId, client] of signalMonitoringClients.entries()) {
    if (client.ws === ws) {
      clientIdToRemove = clientId;
      break;
    }
  }
  
  if (clientIdToRemove) {
    signalMonitoringClients.delete(clientIdToRemove);
    metrics.connectedClients = signalMonitoringClients.size;
    logger.debug(`Signal monitoring client removed. ID: ${clientIdToRemove}. Total clients: ${signalMonitoringClients.size}`);
  }
}

/**
 * Get client by ID
 * @param clientId Client ID
 * @returns MonitoringClient or undefined if not found
 */
function getClient(clientId: string): MonitoringClient | undefined {
  return signalMonitoringClients.get(clientId);
}

/**
 * Get client by WebSocket instance
 * @param ws WebSocket instance
 * @returns MonitoringClient or undefined if not found
 */
function getClientByWs(ws: WebSocket): MonitoringClient | undefined {
  for (const client of signalMonitoringClients.values()) {
    if (client.ws === ws) {
      return client;
    }
  }
  return undefined;
}

/**
 * Broadcast a message to all connected signal monitoring clients
 * @param data Data to broadcast
 * @param targetComponents Optional array of component IDs to target (if empty, broadcast to all)
 * @returns Number of clients the message was sent to
 */
function broadcastSignalUpdate(data: any, targetComponents: string[] = []): number {
  try {
    const message = JSON.stringify(data);
    let sentCount = 0;
    
    // If we have specific target components
    const hasTargetComponents = targetComponents && targetComponents.length > 0;
    
    for (const client of signalMonitoringClients.values()) {
      // Skip clients that aren't subscribed to targeted components
      if (hasTargetComponents && client.subscribedComponents.size > 0) {
        let shouldSend = false;
        for (const component of targetComponents) {
          if (client.subscribedComponents.has(component)) {
            shouldSend = true;
            break;
          }
        }
        if (!shouldSend) continue;
      }
      
      // Update last activity timestamp
      client.lastActivity = new Date();
      
      // Only send to open connections
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message);
        sentCount++;
      }
    }
    
    if (sentCount > 0) {
      metrics.signalsSent++;
      
      // Update signal throughput (signals per second)
      const now = Date.now();
      const uptimeMs = now - new Date(metrics.started).getTime();
      metrics.signalThroughput = metrics.signalsSent / (uptimeMs / 1000);
      
      logger.debug(`Signal update broadcast to ${sentCount} clients ${hasTargetComponents ? `for target components: ${targetComponents.join(', ')}` : ''}`);
    }
    
    return sentCount;
  } catch (error) {
    logger.error('Error broadcasting signal monitoring updates:', error);
    metrics.errors++;
    metrics.lastError = error.message;
    return 0;
  }
}

/**
 * Send a message to a specific client
 * @param clientId Client ID
 * @param data Message data
 * @returns Whether the message was sent successfully
 */
function sendToClient(clientId: string, data: any): boolean {
  try {
    const client = signalMonitoringClients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) {
      return false;
    }
    
    const message = JSON.stringify(data);
    client.ws.send(message);
    client.lastActivity = new Date();
    return true;
  } catch (error) {
    logger.error(`Error sending message to client ${clientId}:`, error);
    return false;
  }
}

/**
 * Initialize the signal monitoring service
 */
function initializeSignalMonitoring(): void {
  logger.info('Signal monitoring service initialized');
  
  // Periodically check connection status
  setInterval(() => {
    if (signalMonitoringClients.size > 0) {
      logger.debug(`Active signal monitoring connections: ${signalMonitoringClients.size}`);
    }
  }, 60000);
}

/**
 * Handle signal monitoring WebSocket messages
 * @param ws WebSocket client
 * @param message Parsed message object
 */
function handleSignalMonitoringMessage(ws: WebSocket, message: any): void {
  try {
    const client = getClientByWs(ws);
    if (!client) {
      logger.error('Received message from unregistered WebSocket client');
      return;
    }
    
    // Update client activity timestamp
    client.lastActivity = new Date();
    
    // Handle subscription requests
    if (message.type === 'subscribe') {
      // Subscribe to components
      if (message.components && Array.isArray(message.components)) {
        message.components.forEach((component: string) => {
          client.subscribedComponents.add(component);
        });
        logger.info(`Client ${client.id} subscribed to components: ${message.components.join(', ')}`);
      }
      
      // Subscribe to signal types
      if (message.signalTypes && Array.isArray(message.signalTypes)) {
        message.signalTypes.forEach((type: SignalType) => {
          client.subscribedSignalTypes.add(type);
        });
        logger.info(`Client ${client.id} subscribed to signal types: ${message.signalTypes.join(', ')}`);
      }
      
      // Subscribe to signal sources
      if (message.sources && Array.isArray(message.sources)) {
        message.sources.forEach((source: SignalSource) => {
          client.subscribedSources.add(source);
        });
        logger.info(`Client ${client.id} subscribed to sources: ${message.sources.join(', ')}`);
      }
      
      // Legacy channel subscription support
      if (message.channels && Array.isArray(message.channels)) {
        logger.info(`Client ${client.id} subscribed to channels: ${message.channels.join(', ')}`);
        
        // Map channels to components for backward compatibility
        const channelToComponentMap: Record<string, string[]> = {
          'system_health': ['system', 'server', 'database'],
          'component_health': ['hyperion-agent', 'quantum-omega-agent', 'transaction-engine', 'price-feed'],
          'alerts': ['alert-system'],
          'signal_flow': ['signal-hub', 'signal-validator'],
        };
        
        // Subscribe to mapped components
        message.channels.forEach((channel: string) => {
          const components = channelToComponentMap[channel] || [];
          components.forEach(component => client.subscribedComponents.add(component));
        });
      }
      
      // Send confirmation with all active subscriptions
      ws.send(JSON.stringify({
        type: 'subscription_confirmed',
        clientId: client.id,
        components: Array.from(client.subscribedComponents),
        signalTypes: Array.from(client.subscribedSignalTypes),
        sources: Array.from(client.subscribedSources),
        timestamp: new Date().toISOString()
      }));
    }
    
    // Handle component health check requests
    else if (message.type === 'get_component_health') {
      const componentId = message.componentId;
      
      // If requesting a specific component
      if (componentId) {
        const healthData = metrics.componentHealth[componentId];
        ws.send(JSON.stringify({
          type: 'component_health_status',
          componentId,
          status: healthData?.status || 'unknown',
          metrics: healthData?.metrics || {},
          lastUpdated: healthData?.lastUpdated || null,
          timestamp: new Date().toISOString()
        }));
      } 
      // If requesting all components
      else {
        ws.send(JSON.stringify({
          type: 'component_health_status',
          components: metrics.componentHealth,
          timestamp: new Date().toISOString()
        }));
      }
    }
    
    // Handle signal processing requests
    else if (message.type === 'process_signal' && message.signal) {
      const startTime = Date.now();
      logger.info(`Processing signal request: ${message.signal.id}`);
      
      try {
        // Process the signal (in a real implementation, this would involve more logic)
        const processingResult = {
          success: true,
          processingTime: Date.now() - startTime,
          timestamp: new Date().toISOString()
        };
        
        // Send confirmation
        ws.send(JSON.stringify({
          type: 'signal_processed',
          signalId: message.signal.id,
          result: processingResult
        }));
        
        // Broadcast the processed signal to all monitoring clients
        broadcastSignalUpdate({
          type: 'SIGNAL_PROCESSED',
          data: {
            id: message.signal.id,
            status: 'processed',
            result: processingResult,
            timestamp: new Date().toISOString()
          }
        });
        
        // Track signal processing
        metrics.signalsProcessed++;
        
        // Update latency metrics
        const totalLatency = metrics.averageLatency * metrics.latencyMeasurements + processingResult.processingTime;
        metrics.latencyMeasurements++;
        metrics.averageLatency = totalLatency / metrics.latencyMeasurements;
      } catch (error) {
        // Handle processing error
        metrics.errors++;
        metrics.lastError = `Error processing signal ${message.signal.id}: ${error.message}`;
        metrics.signalsRejected++;
        
        // Send error response
        ws.send(JSON.stringify({
          type: 'signal_processing_error',
          signalId: message.signal.id,
          error: error.message,
          timestamp: new Date().toISOString()
        }));
      }
    }
    
    // Handle metrics request
    else if (message.type === 'get_metrics') {
      ws.send(JSON.stringify({
        type: 'monitoring_metrics',
        metrics: getMetrics(),
        timestamp: new Date().toISOString()
      }));
    }
    
    // Handle unknown message types
    else {
      logger.warn(`Unknown message type: ${message.type}`);
    }
  } catch (error: any) {
    logger.error('Error handling signal monitoring message:', error);
    metrics.errors++;
    metrics.lastError = `Error handling WebSocket message: ${error.message}`;
    
    try {
      ws.send(JSON.stringify({
        type: 'error',
        message: `Error processing message: ${error.message}`,
        timestamp: new Date().toISOString()
      }));
    } catch (sendError) {
      // If we can't even send the error message, just log it
      logger.error('Failed to send error message to client', sendError);
    }
  }
}

/**
 * Track a signal's lifecycle metrics
 * @param signal The signal being tracked
 * @param validationResult Result of signal validation
 * @param processingTime Total processing time in ms
 */
function trackSignal(signal: any, validationResult: any, processingTime: number): void {
  if (validationResult && validationResult.valid) {
    metrics.signalsProcessed++;
    
    // Update average latency
    const totalLatency = metrics.averageLatency * metrics.latencyMeasurements + processingTime;
    metrics.latencyMeasurements++;
    metrics.averageLatency = totalLatency / metrics.latencyMeasurements;
  } else {
    metrics.signalsRejected++;
  }
}

/**
 * Track latency for a specific phase of signal processing
 * @param signalId ID of the signal
 * @param phase Phase of processing (e.g., 'validation', 'delivery')
 * @param timeMs Time taken in milliseconds
 */
function trackLatency(signalId: string, phase: string, timeMs: number): void {
  logger.debug(`Signal ${signalId} ${phase} latency: ${timeMs}ms`);
}

/**
 * Track component health status
 * @param componentId ID of the component
 * @param status Health status
 * @param componentMetrics Component-specific metrics
 * @param errorMessage Optional error message if status is 'degraded' or 'failing'
 * @param responseTime Optional response time in milliseconds
 */
function trackComponentHealth(
  componentId: string, 
  status: 'healthy' | 'degraded' | 'failing',
  componentMetrics: Record<string, any> = {},
  errorMessage?: string,
  responseTime?: number
): void {
  // Get current component data or initialize if it doesn't exist
  const currentData = metrics.componentHealth[componentId] || {
    status: 'healthy',
    lastUpdated: new Date(),
    metrics: {},
    errorCount: 0
  };

  // Update component health data
  const componentHealth: ComponentHealth = {
    status,
    lastUpdated: new Date(),
    metrics: {
      ...currentData.metrics,
      ...componentMetrics
    },
    errorCount: status === 'failing' ? currentData.errorCount + 1 : currentData.errorCount
  };

  // Add error message if provided
  if (errorMessage && (status === 'degraded' || status === 'failing')) {
    componentHealth.lastError = errorMessage;
  }
  
  // Add response time if provided
  if (responseTime !== undefined) {
    componentHealth.responseTime = responseTime;
  }
  
  // Update metrics
  metrics.componentHealth[componentId] = componentHealth;
  
  // Broadcast component health update
  broadcastSignalUpdate({
    type: 'COMPONENT_HEALTH_UPDATE',
    componentId,
    status,
    metrics: componentMetrics,
    errorMessage,
    timestamp: new Date().toISOString()
  });
  
  // Log component status changes
  logger.info(`Component ${componentId} health status: ${status}`);
  
  // If component is failing, increment system error count
  if (status === 'failing') {
    metrics.errors++;
    if (errorMessage) {
      metrics.lastError = `Component ${componentId} error: ${errorMessage}`;
    }
  }
}

/**
 * Get current monitoring metrics with additional calculated values
 */
function getMetrics(): any {
  // Calculate additional metrics
  const now = Date.now();
  const uptimeMs = now - new Date(metrics.started).getTime();
  
  // Calculate system load using a simple approximation
  // In a real implementation, this would use actual CPU/memory metrics
  const systemLoad = {
    cpu: Math.min(0.8, (metrics.errors / 1000) + (metrics.signalsProcessed / 10000)),
    memory: Math.min(0.7, signalMonitoringClients.size * 0.05 + (metrics.componentHealth ? Object.keys(metrics.componentHealth).length * 0.02 : 0)),
    network: Math.min(0.6, metrics.signalsSent / 1000)
  };
  
  // Update the system load metrics
  metrics.systemLoad = systemLoad;
  
  // Add calculated metrics
  return {
    ...metrics,
    timestamp: new Date().toISOString(),
    uptime: uptimeMs,
    uptimeFormatted: formatUptime(uptimeMs),
    activeClients: signalMonitoringClients.size,
    componentCount: Object.keys(metrics.componentHealth).length,
    systemStatus: getSystemStatus()
  };
}

/**
 * Format uptime in a human-readable format
 * @param uptimeMs Uptime in milliseconds
 */
function formatUptime(uptimeMs: number): string {
  const seconds = Math.floor(uptimeMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `${days}d ${hours % 24}h ${minutes % 60}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Get overall system status based on component health
 */
function getSystemStatus(): 'operational' | 'degraded' | 'critical' {
  const componentStatuses = Object.values(metrics.componentHealth).map(h => h.status);
  
  if (componentStatuses.some(status => status === 'failing')) {
    return 'critical';
  } else if (componentStatuses.some(status => status === 'degraded')) {
    return 'degraded';
  } else {
    return 'operational';
  }
}

/**
 * Reset monitoring metrics
 */
function resetMetrics(): void {
  metrics = {
    signalsProcessed: 0,
    signalsRejected: 0,
    averageLatency: 0,
    latencyMeasurements: 0,
    componentHealth: {},
    errors: 0,
    lastError: null,
    signalsSent: 0,
    signalThroughput: 0,
    connectedClients: signalMonitoringClients.size,
    systemLoad: {
      cpu: 0,
      memory: 0,
      network: 0
    },
    started: new Date().toISOString()
  };
  logger.info('Signal monitoring metrics reset');
  
  // Broadcast metrics reset to all clients
  broadcastSignalUpdate({
    type: 'METRICS_RESET',
    timestamp: new Date().toISOString()
  });
}

// Create and export the signal monitoring module
const signalMonitoring = {
  // Client management
  addSignalMonitoringClient,
  removeSignalMonitoringClient,
  getClient,
  getClientByWs,
  sendToClient,
  
  // Broadcast and communication
  broadcastSignalUpdate,
  
  // Service management
  initializeSignalMonitoring,
  handleSignalMonitoringMessage,
  
  // Monitoring and metrics
  trackSignal,
  trackLatency,
  trackComponentHealth,
  getMetrics,
  resetMetrics,
  getSystemStatus,
  formatUptime
};

export default signalMonitoring;