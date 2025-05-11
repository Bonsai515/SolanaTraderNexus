/**
 * Signal Monitoring Service
 * 
 * This module provides real-time monitoring of trading signals
 * through WebSocket connections and broadcasts updates to clients.
 */

import { WebSocket } from 'ws';
import { logger } from './logger';

// Collection of connected WebSocket clients for signal monitoring
const signalMonitoringClients: Set<WebSocket> = new Set();

/**
 * Add a WebSocket client to the signal monitoring service
 * @param ws WebSocket client to add
 */
export function addSignalMonitoringClient(ws: WebSocket): void {
  signalMonitoringClients.add(ws);
  logger.debug(`Signal monitoring client added. Total clients: ${signalMonitoringClients.size}`);
}

/**
 * Remove a WebSocket client from the signal monitoring service
 * @param ws WebSocket client to remove
 */
export function removeSignalMonitoringClient(ws: WebSocket): void {
  signalMonitoringClients.delete(ws);
  logger.debug(`Signal monitoring client removed. Total clients: ${signalMonitoringClients.size}`);
}

/**
 * Broadcast a message to all connected signal monitoring clients
 * @param data Data to broadcast
 */
export function broadcastSignalUpdate(data: any): void {
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
export function initializeSignalMonitoring(): void {
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
export function handleSignalMonitoringMessage(ws: WebSocket, message: any): void {
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

export default {
  addSignalMonitoringClient,
  removeSignalMonitoringClient,
  broadcastSignalUpdate,
  initializeSignalMonitoring,
  handleSignalMonitoringMessage
};