/**
 * Start Price Feed Service
 * 
 * This script starts the price feed service and connects it to the trading system.
 * It also implements alert mechanisms for price source failures.
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

// Configuration
const LOGS_DIR = './logs';
const PRICE_FEED_LOG_DIR = path.join(LOGS_DIR, 'price-feed');
const ALERTS_DIR = path.join(LOGS_DIR, 'alerts');
const PRICE_FEED_PORT = 3030;
const SOURCE_FAILURE_THRESHOLD = 2; // Alert if more than 2 sources fail
const CHECK_INTERVAL_MS = 60000; // Check sources every minute
const RESTART_ATTEMPT_LIMIT = 3;

// Ensure directories exist
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

if (!fs.existsSync(PRICE_FEED_LOG_DIR)) {
  fs.mkdirSync(PRICE_FEED_LOG_DIR, { recursive: true });
}

if (!fs.existsSync(ALERTS_DIR)) {
  fs.mkdirSync(ALERTS_DIR, { recursive: true });
}

// Log message to file and console
function log(message: string): void {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  
  console.log(logMessage);
  
  // Append to log file
  const logFile = path.join(PRICE_FEED_LOG_DIR, `price-feed-service-${new Date().toISOString().slice(0, 10)}.log`);
  fs.appendFileSync(logFile, logMessage + '\n');
}

// Create an alert
function createAlert(title: string, message: string, severity: 'info' | 'warning' | 'error' | 'critical'): void {
  const timestamp = new Date().toISOString();
  const alert = {
    timestamp,
    title,
    message,
    severity
  };
  
  // Log the alert
  log(`[${severity.toUpperCase()}] ${title}: ${message}`);
  
  // Save alert to file
  const alertFile = path.join(ALERTS_DIR, `alert-${timestamp.replace(/:/g, '-')}.json`);
  fs.writeFileSync(alertFile, JSON.stringify(alert, null, 2));
}

// Start the price feed server
function startPriceFeedServer(): any {
  log('Starting Price Feed Server...');
  
  const logFile = path.join(PRICE_FEED_LOG_DIR, `price-feed-output-${new Date().toISOString().slice(0, 10)}.log`);
  const logStream = fs.createWriteStream(logFile, { flags: 'a' });
  
  // Start the server process
  const serverProcess = spawn('npx', ['tsx', 'src/price-feed-server.ts'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false
  });
  
  // Log server stdout
  serverProcess.stdout.on('data', (data) => {
    const output = data.toString();
    logStream.write(output);
    
    // Check for source failure mentions
    if (output.includes('Error fetching') || output.includes('failed to fetch')) {
      log('Price source error detected: ' + output.split('\n')[0]);
    }
  });
  
  // Log server stderr
  serverProcess.stderr.on('data', (data) => {
    const error = data.toString();
    logStream.write(error);
    log('Price feed server error: ' + error.split('\n')[0]);
  });
  
  // Handle server exit
  serverProcess.on('exit', (code, signal) => {
    log(`Price feed server exited with code ${code} and signal ${signal}`);
    
    // Create an alert for unexpected exit
    if (code !== 0) {
      createAlert(
        'Price Feed Server Crashed',
        `The price feed server exited unexpectedly with code ${code} and signal ${signal}`,
        'error'
      );
      
      // Attempt to restart
      handleServerCrash();
    }
  });
  
  log(`Price Feed Server started with PID ${serverProcess.pid}`);
  return serverProcess;
}

// Check price sources health
async function checkPriceSourcesHealth(): Promise<void> {
  try {
    // Fetch sources metrics from the API
    const response = await fetch(`http://localhost:${PRICE_FEED_PORT}/api/metrics/sources`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch source metrics: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    const { metrics } = data;
    
    // Calculate number of failed sources
    let failedSources = 0;
    let totalFailures = 0;
    let details = '';
    
    metrics.forEach((source: any) => {
      const successRate = source.successRate || 0;
      const failures = source.failures || 0;
      
      if (successRate < 0.5) { // Less than 50% success rate
        failedSources++;
        details += `${source.source} (${Math.round(successRate * 100)}% success), `;
      }
      
      totalFailures += failures;
    });
    
    // Create an alert if too many sources are failing
    if (failedSources > SOURCE_FAILURE_THRESHOLD) {
      createAlert(
        'Multiple Price Sources Failing',
        `${failedSources} price sources are experiencing issues: ${details.slice(0, -2)}`,
        'warning'
      );
    }
    
    log(`Price sources health check: ${metrics.length} sources, ${failedSources} failing, ${totalFailures} total failures`);
  } catch (error) {
    log(`Error checking price sources health: ${error}`);
  }
}

// Handle server crash
let restartAttempts = 0;
function handleServerCrash(): void {
  if (restartAttempts >= RESTART_ATTEMPT_LIMIT) {
    createAlert(
      'Price Feed Server Restart Limit Reached',
      `The price feed server has failed to start after ${RESTART_ATTEMPT_LIMIT} attempts`,
      'critical'
    );
    log(`Reached restart attempt limit (${RESTART_ATTEMPT_LIMIT}). Please manually restart the price feed server.`);
    return;
  }
  
  restartAttempts++;
  log(`Attempting to restart price feed server (attempt ${restartAttempts}/${RESTART_ATTEMPT_LIMIT})...`);
  
  // Wait a bit before restarting
  setTimeout(() => {
    serverProcess = startPriceFeedServer();
  }, 5000);
}

// Main function
function main(): void {
  // Display banner
  console.log('\n=======================================================');
  console.log('🚀 STARTING ENHANCED PRICE FEED SERVICE');
  console.log('=======================================================');
  
  // Start the price feed server
  let serverProcess = startPriceFeedServer();
  
  // Set up periodic price sources health check
  setInterval(checkPriceSourcesHealth, CHECK_INTERVAL_MS);
  
  console.log(`\nPrice Feed Service started. Monitoring sources health every ${CHECK_INTERVAL_MS / 1000} seconds.`);
  console.log('Dashboard available at: http://localhost:3030/');
  console.log('\n=======================================================');
  
  // Handle process termination
  process.on('SIGINT', () => {
    log('Received SIGINT. Shutting down price feed service...');
    
    if (serverProcess) {
      serverProcess.kill();
    }
    
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    log('Received SIGTERM. Shutting down price feed service...');
    
    if (serverProcess) {
      serverProcess.kill();
    }
    
    process.exit(0);
  });
}

// Run the main function
main();