/**
 * Signal Monitoring Service
 * 
 * This module provides real-time monitoring of trading signals
 * through WebSocket connections and broadcasts updates to clients.
 */

import WebSocket from 'ws';
import { logger } from './logger';

// Collection of connected WebSocket clients for signal monitoring
const signalMonitoringClients: Set<WebSocket> = new Set();

// Monitoring metrics
let metrics: any = {
  signalsProcessed: 0,
  signalsRejected: 0,
  averageLatency: 0,
  latencyMeasurements: 0,
  componentHealth: {},
  errors: 0,
  lastError: null,
  signalsSent: 0,
  started: new Date().toISOString(),
};

/**
 * Add a WebSocket client to the signal monitoring service
 * @param ws WebSocket client to add
 */
function addSignalMonitoringClient(ws: WebSocket): void {
  signalMonitoringClients.add(ws);
  logger.debug(`Signal monitoring client added. Total clients: ${signalMonitoringClients.size}`);
}

/**
 * Remove a WebSocket client from the signal monitoring service
 * @param ws WebSocket client to remove
 */
function removeSignalMonitoringClient(ws: WebSocket): void {
  signalMonitoringClients.delete(ws);
  logger.debug(`Signal monitoring client removed. Total clients: ${signalMonitoringClients.size}`);
}

/**
 * Broadcast a message to all connected signal monitoring clients
 * @param data Data to broadcast
 */
function broadcastSignalUpdate(data: any): void {
  try {
    const message = JSON.stringify(data);
    let sentCount = 0;
    
    signalMonitoringClients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
        sentCount++;
      }
    });
    
    if (sentCount > 0) {
      logger.debug(`Signal update broadcast to ${sentCount} clients`);
    }
  } catch (error) {
    logger.error('Error broadcasting signal monitoring updates:', error);
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
    // Handle subscription requests
    if (message.type === 'subscribe' && message.channels) {
      logger.info(`Client subscribed to signal monitoring channels: ${message.channels.join(', ')}`);
      
      // Send confirmation
      ws.send(JSON.stringify({
        type: 'subscription_confirmed',
        channels: message.channels,
        timestamp: new Date().toISOString()
      }));
    }
    
    // Handle signal processing requests
    if (message.type === 'process_signal' && message.signal) {
      logger.info(`Processing signal request: ${message.signal.id}`);
      
      // Send confirmation
      ws.send(JSON.stringify({
        type: 'signal_processed',
        signalId: message.signal.id,
        result: {
          success: true,
          timestamp: new Date().toISOString()
        }
      }));
      
      // Broadcast the processed signal to all monitoring clients
      broadcastSignalUpdate({
        type: 'SIGNAL_PROCESSED',
        data: {
          id: message.signal.id,
          status: 'processed',
          timestamp: new Date().toISOString()
        }
      });
    }
  } catch (error) {
    logger.error('Error handling signal monitoring message:', error);
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
 */
function trackComponentHealth(
  componentId: string, 
  status: 'healthy' | 'degraded' | 'failing',
  componentMetrics: any = {}
): void {
  // Initialize componentHealth as an object if it's not already
  if (!metrics.componentHealth) {
    metrics.componentHealth = {};
  }
  
  // Now we can safely index it with componentId
  metrics.componentHealth[componentId] = {
    status,
    lastUpdated: new Date().toISOString(),
    ...componentMetrics
  };
}

/**
 * Get current monitoring metrics
 */
function getMetrics(): any {
  return {
    ...metrics,
    timestamp: new Date().toISOString(),
    uptime: Date.now() - new Date(metrics.started).getTime()
  };
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
    started: new Date().toISOString()
  };
  logger.info('Signal monitoring metrics reset');
}

// Create and export the signal monitoring module
const signalMonitoring = {
  addSignalMonitoringClient,
  removeSignalMonitoringClient,
  broadcastSignalUpdate,
  initializeSignalMonitoring,
  handleSignalMonitoringMessage,
  trackSignal,
  trackLatency,
  trackComponentHealth,
  getMetrics,
  resetMetrics
};

export default signalMonitoring;