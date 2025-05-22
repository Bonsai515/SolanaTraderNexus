/**
 * Connection Monitor
 * 
 * Monitors RPC endpoints and API connections to ensure
 * trading system remains operational.
 */

import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

// Configuration
const LOG_PATH = path.join('.', 'connection-monitor.log');
const CHECK_INTERVAL = 60 * 1000; // 1 minute
const SYSTEM_STATE_PATH = path.join('./data', 'system-state-memory.json');

// RPC endpoints to check
const RPC_ENDPOINTS = [
  'https://empty-hidden-spring.solana-mainnet.quiknode.pro/ea24f1bb95ea3b2dc4cddbe74a4bce8e10eaa88e/',
  'https://api.mainnet-beta.solana.com',
  'https://solana-api.syndica.io' // Default public endpoint
];

// Logging function
function log(message: string): void {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  
  // Append to log file
  fs.appendFileSync(LOG_PATH, logMessage + '\n');
}

// Initialize log file
if (!fs.existsSync(LOG_PATH)) {
  fs.writeFileSync(LOG_PATH, '--- CONNECTION MONITOR LOG ---\n');
}

// Check RPC endpoint health
async function checkRpcEndpoint(endpoint: string): Promise<boolean> {
  try {
    const response = await axios.post(endpoint, {
      jsonrpc: '2.0',
      id: 1,
      method: 'getHealth'
    });
    
    return response.data && response.data.result === 'ok';
  } catch (error) {
    return false;
  }
}

// Check all RPC endpoints
async function checkAllRpcEndpoints(): Promise<void> {
  log('Checking RPC endpoints...');
  
  for (const endpoint of RPC_ENDPOINTS) {
    try {
      const isHealthy = await checkRpcEndpoint(endpoint);
      log(`RPC endpoint ${endpoint}: ${isHealthy ? '✅ Healthy' : '❌ Unhealthy'}`);
    } catch (error) {
      log(`Error checking ${endpoint}: ${(error as Error).message}`);
    }
  }
}

// Update system state with RPC status
async function updateSystemState(): Promise<void> {
  try {
    if (fs.existsSync(SYSTEM_STATE_PATH)) {
      const systemStateText = fs.readFileSync(SYSTEM_STATE_PATH, 'utf8');
      const systemState = JSON.parse(systemStateText);
      
      // Update RPC status
      if (!systemState.connectionStatus) {
        systemState.connectionStatus = {};
      }
      
      // Check primary RPC endpoint
      const primaryEndpoint = RPC_ENDPOINTS[0];
      const isPrimaryHealthy = await checkRpcEndpoint(primaryEndpoint);
      
      // Update connection status
      systemState.connectionStatus = {
        lastChecked: new Date().toISOString(),
        primaryRpcHealthy: isPrimaryHealthy,
        healthyRpcCount: (await Promise.all(RPC_ENDPOINTS.map(endpoint => checkRpcEndpoint(endpoint))))
          .filter(Boolean).length,
        status: isPrimaryHealthy ? 'healthy' : 'degraded'
      };
      
      // Save updated system state
      fs.writeFileSync(SYSTEM_STATE_PATH, JSON.stringify(systemState, null, 2));
      log('Updated system state with RPC status');
    }
  } catch (error) {
    log(`Error updating system state: ${(error as Error).message}`);
  }
}

// Main function to continuously monitor connections
async function monitorConnections(): Promise<void> {
  log('Starting connection monitor...');
  
  // Initial check
  await checkAllRpcEndpoints();
  await updateSystemState();
  
  // Set up continuous monitoring
  setInterval(async () => {
    await checkAllRpcEndpoints();
    await updateSystemState();
  }, CHECK_INTERVAL);
  
  log(`Connection monitor running, checking every ${CHECK_INTERVAL / 1000} seconds`);
}

// Run the monitor
monitorConnections().catch(error => {
  log(`Error in connection monitor: ${error.message}`);
});
