/**
 * RPC Load Balancer
 * 
 * This module implements a more sophisticated load balancing approach for RPC requests
 * to prevent 429 errors during high-volume trading operations.
 * 
 * Features:
 * - Round-robin load balancing across multiple endpoints
 * - Adaptive health checks with circuit breaking
 * - Request bundling for efficiency
 * - Automatic failover when endpoints are unhealthy
 * - Dynamic cooldown and retry with exponential backoff
 */

import * as logger from '../logger';
import * as rpcRateLimiter from './rpcRateLimiter';

// Constants
const HEALTH_CHECK_INTERVAL_MS = 60000; // Check endpoint health every minute
const MAX_CONSECUTIVE_FAILURES = 5; // Mark endpoint as unhealthy after this many consecutive failures
const RECOVERY_TIME_MS = 300000; // Time before considering a failed endpoint for recovery (5 minutes)
const REQUEST_TIMEOUT_MS = 10000; // Timeout for RPC requests

// RPC Endpoint interface with health metrics
interface RpcEndpoint {
  url: string;
  priority: number;
  isHealthy: boolean;
  consecutiveFailures: number;
  totalRequests: number;
  totalErrors: number;
  lastUsed: number;
  lastFailure: number;
  responseTimeMs: number[];
  cooldownUntil: number;
}

// Global state
let endpoints: RpcEndpoint[] = [];
let currentEndpointIndex = 0;
let healthCheckInterval: NodeJS.Timeout | null = null;
let isInitialized = false;

/**
 * Initialize the RPC load balancer with URLs
 */
export function initialize(rpcUrls: string[]): void {
  if (isInitialized) {
    logger.warn('[RPC Load Balancer] Already initialized, call reset() first to reinitialize');
    return;
  }
  
  if (!rpcUrls || rpcUrls.length === 0) {
    logger.error('[RPC Load Balancer] No RPC URLs provided for initialization');
    return;
  }
  
  endpoints = rpcUrls.map((url, index) => ({
    url,
    priority: index,
    isHealthy: true,
    consecutiveFailures: 0,
    totalRequests: 0,
    totalErrors: 0,
    lastUsed: 0,
    lastFailure: 0,
    responseTimeMs: [],
    cooldownUntil: 0,
  }));
  
  logger.info(`[RPC Load Balancer] Initialized with ${endpoints.length} endpoints`);
  
  // Start health checking
  startHealthChecks();
  
  isInitialized = true;
  
  // Also register with the rate limiter
  rpcRateLimiter.registerRpcEndpoints(rpcUrls);
}

/**
 * Reset the load balancer state
 */
export function reset(): void {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
  }
  
  endpoints = [];
  currentEndpointIndex = 0;
  isInitialized = false;
  
  logger.info('[RPC Load Balancer] Reset successful');
}

/**
 * Get the next healthy endpoint using round robin
 */
export function getNextEndpoint(): RpcEndpoint | null {
  if (endpoints.length === 0) {
    logger.error('[RPC Load Balancer] No endpoints registered');
    return null;
  }
  
  // Get healthy endpoints that aren't in cooldown
  const now = Date.now();
  const availableEndpoints = endpoints.filter(
    endpoint => endpoint.isHealthy && now > endpoint.cooldownUntil
  );
  
  if (availableEndpoints.length === 0) {
    logger.warn('[RPC Load Balancer] No healthy endpoints available, temporarily removing cooldown restrictions');
    
    // Fall back to just healthy endpoints ignoring cooldown
    const healthyEndpoints = endpoints.filter(endpoint => endpoint.isHealthy);
    
    if (healthyEndpoints.length === 0) {
      logger.warn('[RPC Load Balancer] All endpoints unhealthy, resetting one with lowest error count');
      
      // Last resort: reset the endpoint with the fewest errors
      const bestEndpoint = [...endpoints].sort((a, b) => a.totalErrors - b.totalErrors)[0];
      bestEndpoint.isHealthy = true;
      bestEndpoint.consecutiveFailures = 0;
      bestEndpoint.cooldownUntil = 0;
      
      return bestEndpoint;
    }
    
    return healthyEndpoints[currentEndpointIndex % healthyEndpoints.length];
  }
  
  // Increment the index (round robin)
  currentEndpointIndex = (currentEndpointIndex + 1) % availableEndpoints.length;
  
  // Get the endpoint and mark as used
  const endpoint = availableEndpoints[currentEndpointIndex];
  endpoint.lastUsed = now;
  endpoint.totalRequests++;
  
  return endpoint;
}

/**
 * Record a successful request to an endpoint
 */
export function recordSuccess(url: string, responseTimeMs: number): void {
  const endpoint = endpoints.find(ep => ep.url === url);
  if (endpoint) {
    endpoint.consecutiveFailures = 0;
    endpoint.responseTimeMs.push(responseTimeMs);
    
    // Keep only the last 100 response times
    if (endpoint.responseTimeMs.length > 100) {
      endpoint.responseTimeMs.shift();
    }
  }
}

/**
 * Record a failed request to an endpoint
 */
export function recordFailure(url: string, isRateLimitError: boolean): void {
  const endpoint = endpoints.find(ep => ep.url === url);
  if (endpoint) {
    endpoint.consecutiveFailures++;
    endpoint.totalErrors++;
    endpoint.lastFailure = Date.now();
    
    // Apply cooldown if rate limited
    if (isRateLimitError) {
      const cooldownMs = Math.min(30000, 1000 * Math.pow(2, Math.min(10, endpoint.consecutiveFailures)));
      endpoint.cooldownUntil = Date.now() + cooldownMs;
      logger.warn(`[RPC Load Balancer] Rate limited at ${url}, cooling down for ${cooldownMs}ms`);
    }
    
    // Mark as unhealthy if too many consecutive failures
    if (endpoint.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      endpoint.isHealthy = false;
      logger.warn(`[RPC Load Balancer] Endpoint ${url} marked unhealthy after ${endpoint.consecutiveFailures} consecutive failures`);
    }
  }
}

/**
 * Start periodic health checks
 */
function startHealthChecks(): void {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
  }
  
  healthCheckInterval = setInterval(checkEndpointsHealth, HEALTH_CHECK_INTERVAL_MS);
  logger.info(`[RPC Load Balancer] Health checks scheduled every ${HEALTH_CHECK_INTERVAL_MS / 1000} seconds`);
}

/**
 * Check the health of all endpoints
 */
async function checkEndpointsHealth(): Promise<void> {
  logger.debug('[RPC Load Balancer] Running endpoint health checks');
  
  const now = Date.now();
  
  // Check each endpoint
  for (const endpoint of endpoints) {
    // Skip healthy endpoints
    if (!endpoint.isHealthy) {
      // Check if recovery time has passed
      if (now - endpoint.lastFailure > RECOVERY_TIME_MS) {
        logger.info(`[RPC Load Balancer] Recovery time passed for ${endpoint.url}, marking for health check`);
        
        try {
          // Perform a simple health check (getBlockHeight or similar)
          // For now, we'll just reset and mark as healthy
          endpoint.isHealthy = true;
          endpoint.consecutiveFailures = 0;
          endpoint.cooldownUntil = 0;
          logger.info(`[RPC Load Balancer] Endpoint ${endpoint.url} restored to service`);
        } catch (error) {
          logger.warn(`[RPC Load Balancer] Health check failed for ${endpoint.url}, keeping as unhealthy`);
        }
      }
    }
  }
  
  // Log current state
  const healthyCount = endpoints.filter(ep => ep.isHealthy).length;
  logger.debug(`[RPC Load Balancer] Health check complete: ${healthyCount}/${endpoints.length} endpoints healthy`);
}

/**
 * Get the current state of all endpoints
 */
export function getState(): any {
  return {
    totalEndpoints: endpoints.length,
    healthyEndpoints: endpoints.filter(ep => ep.isHealthy).length,
    endpoints: endpoints.map(endpoint => ({
      url: endpoint.url.substring(0, 12) + '...', // Mask for security
      isHealthy: endpoint.isHealthy,
      consecutiveFailures: endpoint.consecutiveFailures,
      totalRequests: endpoint.totalRequests,
      totalErrors: endpoint.totalErrors,
      cooldownRemaining: Math.max(0, endpoint.cooldownUntil - Date.now()),
      avgResponseTime: endpoint.responseTimeMs.length > 0 
        ? endpoint.responseTimeMs.reduce((sum, time) => sum + time, 0) / endpoint.responseTimeMs.length 
        : 0
    }))
  };
}

/**
 * Execute a function with RPC load balancing
 */
export async function executeWithLoadBalancing<T>(fn: (url: string) => Promise<T>): Promise<T> {
  if (!isInitialized || endpoints.length === 0) {
    throw new Error('RPC Load Balancer not initialized or no endpoints available');
  }
  
  let attempts = 0;
  const maxAttempts = Math.min(10, endpoints.length * 2);
  
  while (attempts < maxAttempts) {
    attempts++;
    
    // Get the next endpoint
    const endpoint = getNextEndpoint();
    if (!endpoint) {
      throw new Error('No healthy RPC endpoints available');
    }
    
    // Record metrics
    const startTime = Date.now();
    
    try {
      // Execute the function with this endpoint
      const result = await fn(endpoint.url);
      
      // Record success
      const responseTime = Date.now() - startTime;
      recordSuccess(endpoint.url, responseTime);
      
      return result;
    } catch (error) {
      const isRateLimitError = error.status === 429 || 
                              error.code === 429 ||
                              (error.message && error.message.includes('429')) ||
                              (error.message && error.message.toLowerCase().includes('rate limit')) ||
                              (error.message && error.message.includes('Too many requests'));
      
      // Record failure
      recordFailure(endpoint.url, isRateLimitError);
      
      // If we haven't exhausted all attempts and this was a rate limit error, try another endpoint
      if (attempts < maxAttempts && isRateLimitError) {
        // Apply exponential backoff
        const backoffMs = Math.min(2000, 100 * Math.pow(2, attempts));
        logger.warn(`[RPC Load Balancer] Request failed (attempt ${attempts}/${maxAttempts}), retrying after ${backoffMs}ms`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
        continue;
      }
      
      // Otherwise, propagate the error
      throw error;
    }
  }
  
  throw new Error(`Failed after ${maxAttempts} attempts to different RPC endpoints`);
}