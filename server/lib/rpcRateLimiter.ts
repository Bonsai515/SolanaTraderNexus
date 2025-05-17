/**
 * Advanced RPC Rate Limiter with Provider-Specific Settings
 * 
 * This module provides intelligent rate limiting for Solana RPC requests
 * with provider-specific limits, exponential backoff, and circuit breaker patterns.
 */

import * as logger from '../logger';

// Time constants
const MINUTE_MS = 60 * 1000;
const SECOND_MS = 1000;

// Priority levels - higher priority requests get processed first
export enum RequestPriority {
  CRITICAL = 0,   // System-critical operations (e.g. emergency shutdown)
  HIGH = 1,       // Time-sensitive operations (e.g. trade execution)
  NORMAL = 2,     // Regular operations (e.g. balance checks)
  LOW = 3,        // Background operations (e.g. metrics collection)
  BATCH = 4       // Bulk operations (e.g. historical data fetching)
}

// Provider-specific rate limits
interface ProviderRateLimit {
  name: string;           // Provider name
  urlPattern: RegExp;     // Pattern to match RPC URL
  requestsPerMinute: number; // Rate limit
  requestsPerSecond: number; // Burst limit
  priority: boolean;      // Whether this is a priority provider
  cooldownPeriod: number; // Cooldown period after rate limit in ms
}

// Provider rate limits
const PROVIDER_RATE_LIMITS: ProviderRateLimit[] = [
  {
    name: 'Instant Nodes',
    urlPattern: /instantnodes|instantnode|instnode/i,
    requestsPerMinute: 90, // Based on 4M requests/month ≈ 93 requests/minute, using 90 for safety margin
    requestsPerSecond: 5,  // Max 5 requests per second to prevent bursts
    priority: true,
    cooldownPeriod: 2000   // 2 second cooldown on rate limits
  },
  {
    name: 'Helius',
    urlPattern: /helius/i,
    requestsPerMinute: 60, // More conservative limit
    requestsPerSecond: 4,
    priority: true,
    cooldownPeriod: 3000
  },
  {
    name: 'Alchemy',
    urlPattern: /alchemy/i,
    requestsPerMinute: 50,
    requestsPerSecond: 3,
    priority: false,
    cooldownPeriod: 3000
  },
  {
    name: 'Public RPC',
    urlPattern: /api\.mainnet-beta\.solana\.com/i,
    requestsPerMinute: 30, // Public nodes have stricter limits
    requestsPerSecond: 2,
    priority: false,
    cooldownPeriod: 5000
  }
];

// Default rate limit for unknown providers
const DEFAULT_RATE_LIMIT: ProviderRateLimit = {
  name: 'Unknown',
  urlPattern: /.*/,
  requestsPerMinute: 40,  // Conservative default for unknown providers
  requestsPerSecond: 3,
  priority: false,
  cooldownPeriod: 5000    // Longer cooldown for unknown providers
};

// Maximum queue size to prevent memory issues
const MAX_QUEUE_SIZE = 2000;

// Request interface
interface QueuedRequest {
  fn: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  priority: RequestPriority;
  endpoint: string;
  timestamp: number;
  retries: number;
  maxRetries: number;
}

// Provider state
interface ProviderState {
  provider: ProviderRateLimit;
  requestsPerMinuteWindow: number[];
  requestsPerSecondWindow: number[];
  isRateLimited: boolean;
  rateLimitedUntil: number;
  consecutiveFailures: number;
  circuitBreakerTripped: boolean;
  circuitBreakerResetTime: number;
}

// State tracking
class RateLimiterState {
  providerStates: Map<string, ProviderState> = new Map();
  requestQueues: Map<string, QueuedRequest[]> = new Map();
  processingEndpoints: Set<string> = new Set();
  
  // Circuit breaker settings
  maxConsecutiveFailures = 5;
  circuitBreakerCooldown = 30000; // 30 seconds
  
  // Jitter settings for backoff
  jitterFactor = 0.25;
}

// Global state
const state = new RateLimiterState();

/**
 * Get or create provider state for an endpoint
 */
function getProviderState(endpoint: string): ProviderState {
  if (!state.providerStates.has(endpoint)) {
    // Find matching provider rate limit
    const provider = PROVIDER_RATE_LIMITS.find(p => p.urlPattern.test(endpoint)) || DEFAULT_RATE_LIMIT;
    
    state.providerStates.set(endpoint, {
      provider,
      requestsPerMinuteWindow: [],
      requestsPerSecondWindow: [],
      isRateLimited: false,
      rateLimitedUntil: 0,
      consecutiveFailures: 0,
      circuitBreakerTripped: false,
      circuitBreakerResetTime: 0
    });
  }
  
  return state.providerStates.get(endpoint)!;
}

/**
 * Get or create request queue for an endpoint
 */
function getRequestQueue(endpoint: string): QueuedRequest[] {
  if (!state.requestQueues.has(endpoint)) {
    state.requestQueues.set(endpoint, []);
  }
  
  return state.requestQueues.get(endpoint)!;
}

/**
 * Calculate the current request rate per minute for a provider
 */
function getCurrentRequestRatePerMinute(providerState: ProviderState): number {
  const now = Date.now();
  
  // Filter out requests older than 1 minute
  providerState.requestsPerMinuteWindow = providerState.requestsPerMinuteWindow.filter(
    timestamp => now - timestamp < MINUTE_MS
  );
  
  return providerState.requestsPerMinuteWindow.length;
}

/**
 * Calculate the current request rate per second for a provider
 */
function getCurrentRequestRatePerSecond(providerState: ProviderState): number {
  const now = Date.now();
  
  // Filter out requests older than 1 second
  providerState.requestsPerSecondWindow = providerState.requestsPerSecondWindow.filter(
    timestamp => now - timestamp < SECOND_MS
  );
  
  return providerState.requestsPerSecondWindow.length;
}

/**
 * Check if an endpoint is rate limited
 */
function isRateLimited(endpoint: string): boolean {
  const providerState = getProviderState(endpoint);
  const now = Date.now();
  
  // Check if circuit breaker is tripped
  if (providerState.circuitBreakerTripped) {
    if (now >= providerState.circuitBreakerResetTime) {
      // Reset circuit breaker
      providerState.circuitBreakerTripped = false;
      providerState.consecutiveFailures = 0;
      logger.info(`[RPC Rate Limiter] Circuit breaker reset for ${providerState.provider.name}`);
    } else {
      return true;
    }
  }
  
  // Check if explicitly rate limited
  if (providerState.isRateLimited && now < providerState.rateLimitedUntil) {
    return true;
  }
  
  // Check rate limits
  const ratePerMinute = getCurrentRequestRatePerMinute(providerState);
  const ratePerSecond = getCurrentRequestRatePerSecond(providerState);
  
  return (
    ratePerMinute >= providerState.provider.requestsPerMinute ||
    ratePerSecond >= providerState.provider.requestsPerSecond
  );
}

/**
 * Mark an endpoint as rate limited
 */
function markRateLimited(endpoint: string, duration: number = 5000): void {
  const providerState = getProviderState(endpoint);
  const now = Date.now();
  
  providerState.isRateLimited = true;
  providerState.rateLimitedUntil = now + duration;
  
  // Add jitter to avoid thundering herd
  const jitter = Math.random() * state.jitterFactor * duration;
  providerState.rateLimitedUntil += jitter;
  
  logger.warn(`[RPC Rate Limiter] Rate limiting ${providerState.provider.name} for ${Math.round((duration + jitter) / 1000)} seconds`);
}

/**
 * Update endpoint failure count and potentially trip circuit breaker
 */
function recordFailure(endpoint: string, isRateLimitError: boolean): void {
  const providerState = getProviderState(endpoint);
  
  // If it's a rate limit error, mark as rate limited
  if (isRateLimitError) {
    markRateLimited(endpoint, providerState.provider.cooldownPeriod);
    return;
  }
  
  // Increment failure count
  providerState.consecutiveFailures += 1;
  
  // Check if we should trip circuit breaker
  if (providerState.consecutiveFailures >= state.maxConsecutiveFailures) {
    providerState.circuitBreakerTripped = true;
    providerState.circuitBreakerResetTime = Date.now() + state.circuitBreakerCooldown;
    
    logger.error(`[RPC Rate Limiter] Circuit breaker tripped for ${providerState.provider.name} after ${providerState.consecutiveFailures} consecutive failures`);
  }
}

/**
 * Record a successful request
 */
function recordSuccess(endpoint: string): void {
  const providerState = getProviderState(endpoint);
  
  // Reset failure count
  if (providerState.consecutiveFailures > 0) {
    providerState.consecutiveFailures = 0;
  }
  
  // Add timestamps for rate tracking
  const now = Date.now();
  providerState.requestsPerMinuteWindow.push(now);
  providerState.requestsPerSecondWindow.push(now);
}

/**
 * Process the request queue for a specific endpoint
 */
async function processEndpointQueue(endpoint: string) {
  if (state.processingEndpoints.has(endpoint)) {
    return;
  }
  
  state.processingEndpoints.add(endpoint);
  
  try {
    const queue = getRequestQueue(endpoint);
    const providerState = getProviderState(endpoint);
    
    while (queue.length > 0) {
      // Check if rate limited
      if (isRateLimited(endpoint)) {
        const backoffTime = Math.min(
          500 + Math.random() * 500,
          providerState.isRateLimited ? 
            providerState.rateLimitedUntil - Date.now() : 
            providerState.provider.cooldownPeriod
        );
        
        await new Promise(resolve => setTimeout(resolve, backoffTime));
        continue;
      }
      
      // Sort queue by priority
      queue.sort((a, b) => a.priority - b.priority);
      
      // Get the next request
      const request = queue.shift();
      if (!request) continue;
      
      // Record this request
      recordSuccess(endpoint);
      
      try {
        // Execute the request
        const result = await request.fn();
        request.resolve(result);
      } catch (error) {
        // Check if it's a rate limit error
        const isRateLimitError = error instanceof Error && 
          (error.message.includes('429') || 
           error.message.toLowerCase().includes('rate limit') ||
           error.message.toLowerCase().includes('too many requests'));
        
        if (isRateLimitError) {
          recordFailure(endpoint, true);
          
          // Retry the request if we have retries left
          if (request.retries < request.maxRetries) {
            request.retries += 1;
            
            // Calculate backoff with jitter
            const backoff = Math.min(
              providerState.provider.cooldownPeriod * Math.pow(1.5, request.retries),
              30000
            );
            const jitter = Math.random() * state.jitterFactor * backoff;
            const totalBackoff = backoff + jitter;
            
            logger.info(`[RPC Rate Limiter] Retrying request to ${providerState.provider.name} in ${Math.round(totalBackoff / 1000)}s (attempt ${request.retries}/${request.maxRetries})`);
            
            // Re-queue with delay
            setTimeout(() => {
              queue.push(request);
              processEndpointQueue(endpoint);
            }, totalBackoff);
          } else {
            // No more retries, reject
            logger.error(`[RPC Rate Limiter] Request to ${providerState.provider.name} failed after ${request.maxRetries} attempts`);
            request.reject(error);
          }
        } else {
          // Not a rate limit error
          recordFailure(endpoint, false);
          request.reject(error);
        }
      }
      
      // Small delay between requests to avoid spikes
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  } catch (error) {
    logger.error(`[RPC Rate Limiter] Error processing queue for ${endpoint}:`, error);
  } finally {
    state.processingEndpoints.delete(endpoint);
    
    // If there are still requests, process them
    const queue = getRequestQueue(endpoint);
    if (queue.length > 0) {
      processEndpointQueue(endpoint);
    }
  }
}

/**
 * Execute a function with rate limiting based on endpoint
 */
export async function withRateLimiting<T>(
  fn: () => Promise<T>, 
  options: {
    endpoint?: string;
    priority?: RequestPriority;
    maxRetries?: number;
  } = {}
): Promise<T> {
  // Get current RPC endpoint from connection or use default
  let endpoint = options.endpoint || 'default';
  
  // Get options
  const priority = options.priority !== undefined ? options.priority : RequestPriority.NORMAL;
  const maxRetries = options.maxRetries !== undefined ? options.maxRetries : 3;
  
  // Get provider state
  const providerState = getProviderState(endpoint);
  const queue = getRequestQueue(endpoint);
  
  // Check if queue is too large
  if (queue.length > MAX_QUEUE_SIZE) {
    throw new Error(`RPC request queue for ${providerState.provider.name} is full`);
  }
  
  // Check if provider is high priority and under 50% capacity - execute immediately
  if (
    providerState.provider.priority && 
    !isRateLimited(endpoint) &&
    getCurrentRequestRatePerMinute(providerState) < providerState.provider.requestsPerMinute * 0.5 &&
    getCurrentRequestRatePerSecond(providerState) < providerState.provider.requestsPerSecond * 0.5
  ) {
    recordSuccess(endpoint);
    return fn();
  }
  
  // Otherwise, queue the request
  return new Promise<T>((resolve, reject) => {
    queue.push({
      fn,
      resolve,
      reject,
      priority,
      endpoint,
      timestamp: Date.now(),
      retries: 0,
      maxRetries
    });
    
    processEndpointQueue(endpoint);
  });
}

/**
 * Set endpoint information for rate limiting
 */
export function setEndpointInfo(endpoint: string): void {
  // Make sure we have provider state for this endpoint
  getProviderState(endpoint);
  getRequestQueue(endpoint);
}

/**
 * Get the current rate limit stats for all providers
 */
export function getRateLimitStats() {
  const stats: any = {};
  
  for (const [endpoint, providerState] of state.providerStates) {
    const ratePerMinute = getCurrentRequestRatePerMinute(providerState);
    const ratePerSecond = getCurrentRequestRatePerSecond(providerState);
    const queue = getRequestQueue(endpoint);
    
    stats[providerState.provider.name] = {
      endpoint,
      ratePerMinute,
      ratePerSecond,
      queueSize: queue.length,
      maxRequestsPerMinute: providerState.provider.requestsPerMinute,
      maxRequestsPerSecond: providerState.provider.requestsPerSecond,
      utilizationPercent: Math.round((ratePerMinute / providerState.provider.requestsPerMinute) * 100),
      isRateLimited: providerState.isRateLimited,
      rateLimitedUntil: providerState.rateLimitedUntil,
      circuitBreakerTripped: providerState.circuitBreakerTripped,
      consecutiveFailures: providerState.consecutiveFailures
    };
  }
  
  return stats;
}

/**
 * Reset rate limiter state for all providers
 */
export function resetRateLimiter(): void {
  state.providerStates.clear();
  state.requestQueues.clear();
  state.processingEndpoints.clear();
  
  logger.info('[RPC Rate Limiter] Rate limiter reset for all providers');
}

/**
 * Reset rate limiter state for a specific endpoint
 */
export function resetEndpointRateLimiter(endpoint: string): void {
  const providerState = getProviderState(endpoint);
  
  // Reset rate limit windows
  providerState.requestsPerMinuteWindow = [];
  providerState.requestsPerSecondWindow = [];
  providerState.isRateLimited = false;
  providerState.rateLimitedUntil = 0;
  providerState.consecutiveFailures = 0;
  providerState.circuitBreakerTripped = false;
  
  logger.info(`[RPC Rate Limiter] Rate limiter reset for ${providerState.provider.name}`);
}

/**
 * For testing: Set aggressive rate limiting
 */
export function setAggressiveRateLimiting(): void {
  // Reduce all rate limits by 33%
  for (const providerState of state.providerStates.values()) {
    providerState.provider.requestsPerMinute = Math.floor(providerState.provider.requestsPerMinute * 0.67);
    providerState.provider.requestsPerSecond = Math.floor(providerState.provider.requestsPerSecond * 0.67);
  }
  
  logger.info('[RPC Rate Limiter] Set aggressive rate limiting (67% of normal)');
}

/**
 * For testing: Restore normal rate limiting
 */
export function setNormalRateLimiting(): void {
  // Reset to default rate limits
  state.providerStates.clear();
  
  logger.info('[RPC Rate Limiter] Reset to normal rate limiting');
}

// Initialize
logger.info('[RPC Rate Limiter] Initialized advanced rate limiter with provider-specific settings');