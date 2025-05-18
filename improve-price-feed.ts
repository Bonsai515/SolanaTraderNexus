/**
 * Improve Price Feed With Better Rate Limit Handling
 * 
 * This script updates the price feed service to better handle rate limits
 * and implement exponential backoff and source rotation.
 */

import * as fs from 'fs';
import * as path from 'path';

// Configuration Constants
const CONFIG_DIR = './config';
const DATA_DIR = './data';
const PRICE_FEED_CONFIG_PATH = path.join(DATA_DIR, 'enhanced-price-feeds.json');

/**
 * Helper function to log messages
 */
function log(message: string): void {
  console.log(message);
  
  // Also log to file
  const logDir = './logs';
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(path.join(logDir, 'price-feed-improvement.log'), logMessage);
}

/**
 * Improve the price feed configuration with better rate limit handling
 */
function improvePriceFeedConfig(): boolean {
  try {
    log('Updating price feed configuration with better rate limit handling...');
    
    // Check if price feed config exists
    if (!fs.existsSync(PRICE_FEED_CONFIG_PATH)) {
      log('⚠️ Price feed configuration file not found. Creating default config...');
      
      // Ensure directory exists
      const parentDir = path.dirname(PRICE_FEED_CONFIG_PATH);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      
      // Create default config
      const defaultConfig = {
        version: "2.0.0",
        primarySources: [
          {
            name: "Jupiter",
            url: "https://price.jup.ag/v4/price",
            priority: 1,
            refreshIntervalMs: 2000
          },
          {
            name: "Birdeye",
            url: "https://public-api.birdeye.so/public",
            priority: 2,
            refreshIntervalMs: 3000
          }
        ],
        secondarySources: [
          {
            name: "Pyth",
            url: "https://xc-mainnet.pyth.network/api",
            priority: 3,
            refreshIntervalMs: 5000
          },
          {
            name: "PumpFun",
            url: "https://api.pump.fun/solana/tokens",
            priority: 4,
            refreshIntervalMs: 10000
          }
        ],
        specializedSources: [
          {
            name: "SolanaFM",
            url: "https://api.solana.fm/v0/tokens",
            priority: 5,
            refreshIntervalMs: 15000
          }
        ],
        tokenSpecificOverrides: {
          "SOL": {
            primarySource: "Jupiter",
            minRefreshIntervalMs: 2000
          },
          "USDC": {
            primarySource: "Jupiter",
            minRefreshIntervalMs: 3000
          },
          "BONK": {
            primarySource: "Birdeye",
            minRefreshIntervalMs: 5000
          }
        },
        backupStrategies: {
          failoverEnabled: true,
          rotationEnabled: true,
          cacheTimeMs: 60000
        }
      };
      
      fs.writeFileSync(PRICE_FEED_CONFIG_PATH, JSON.stringify(defaultConfig, null, 2));
      log('✅ Created default price feed configuration');
    }
    
    // Read current configuration
    const currentConfig = JSON.parse(fs.readFileSync(PRICE_FEED_CONFIG_PATH, 'utf-8'));
    
    // Update config with improved rate limit handling
    const improvedConfig = {
      ...currentConfig,
      version: "2.1.0", // Increment version for improved rate limit handling
      rateLimitHandling: {
        enabled: true,
        strategies: [
          "exponential_backoff",
          "source_rotation",
          "cache_fallback",
          "adaptive_intervals"
        ],
        maxRetries: 5,
        initialBackoffMs: 500,
        maxBackoffMs: 10000,
        backoffMultiplier: 2,
        adaptiveRefreshEnabled: true
      },
      sourceRotation: {
        enabled: true,
        rotationIntervalMs: 120000, // Rotate sources every 2 minutes
        priorityWeighting: true // Higher priority sources used more frequently
      },
      resilienceOptions: {
        cacheStaleDataTimeoutMs: 300000, // Use data up to 5 minutes old if needed
        allowPartialFailures: true, // Continue with partial data if some sources fail
        healthCheckIntervalMs: 60000, // Check source health every minute
        circuitBreakerThreshold: 3, // Disable sources that fail 3 times in a row
        circuitBreakerResetTimeMs: 1800000 // Reset circuit breaker after 30 minutes
      }
    };
    
    // Increase intervals for rate-limited sources
    if (improvedConfig.secondarySources) {
      improvedConfig.secondarySources = improvedConfig.secondarySources.map(source => {
        if (source.name === "PumpFun") {
          return {
            ...source,
            refreshIntervalMs: 30000, // Increase to 30 seconds
            rateLimit: {
              requestsPerMinute: 15,
              cooldownAfterLimitMs: 60000
            }
          };
        }
        return source;
      });
    }
    
    // Save updated configuration
    fs.writeFileSync(PRICE_FEED_CONFIG_PATH, JSON.stringify(improvedConfig, null, 2));
    log('✅ Updated price feed configuration with improved rate limit handling');
    
    return true;
  } catch (error) {
    log(`⚠️ Error updating price feed configuration: ${error}`);
    return false;
  }
}

/**
 * Create improved price feed integration code
 */
function createImprovedPriceFeedIntegration(): boolean {
  try {
    log('Creating improved price feed integration code...');
    
    const priceFeedIntegrationPath = path.join('./src', 'price-feed-integration.ts');
    
    // Create src directory if it doesn't exist
    if (!fs.existsSync('./src')) {
      fs.mkdirSync('./src', { recursive: true });
    }
    
    // Create improved price feed integration
    const improvedIntegrationCode = `/**
 * Enhanced Price Feed Integration with Improved Rate Limit Handling
 * 
 * This module provides an enhanced price feed integration with proper
 * rate limit handling, exponential backoff, and source rotation.
 */

import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

// Types
interface PriceSource {
  name: string;
  url: string;
  priority: number;
  refreshIntervalMs: number;
  rateLimit?: {
    requestsPerMinute: number;
    cooldownAfterLimitMs: number;
  };
  lastUsed?: number;
  consecutiveFailures?: number;
  disabled?: boolean;
}

interface TokenOverride {
  primarySource: string;
  minRefreshIntervalMs: number;
}

interface RateLimitHandling {
  enabled: boolean;
  strategies: string[];
  maxRetries: number;
  initialBackoffMs: number;
  maxBackoffMs: number;
  backoffMultiplier: number;
  adaptiveRefreshEnabled: boolean;
}

interface SourceRotation {
  enabled: boolean;
  rotationIntervalMs: number;
  priorityWeighting: boolean;
}

interface ResilienceOptions {
  cacheStaleDataTimeoutMs: number;
  allowPartialFailures: boolean;
  healthCheckIntervalMs: number;
  circuitBreakerThreshold: number;
  circuitBreakerResetTimeMs: number;
}

interface PriceFeedConfig {
  version: string;
  primarySources: PriceSource[];
  secondarySources: PriceSource[];
  specializedSources?: PriceSource[];
  tokenSpecificOverrides: {
    [key: string]: TokenOverride;
  };
  backupStrategies: {
    failoverEnabled: boolean;
    rotationEnabled: boolean;
    cacheTimeMs: number;
  };
  rateLimitHandling?: RateLimitHandling;
  sourceRotation?: SourceRotation;
  resilienceOptions?: ResilienceOptions;
}

interface TokenPrice {
  symbol: string;
  price: number;
  lastUpdated: number;
  source: string;
  confidence: number;
}

// Cache for price data
const priceCache: { [key: string]: TokenPrice } = {};

// Source status tracking
const sourceStatus: { [key: string]: { 
  lastSuccess: number,
  consecutiveFailures: number,
  disabled: boolean,
  disabledUntil: number
} } = {};

// Load price feed configuration
function loadPriceFeedConfig(): PriceFeedConfig {
  try {
    const configPath = path.join('./data', 'enhanced-price-feeds.json');
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
  } catch (error) {
    console.error('Error loading price feed config:', error);
  }
  
  // Return default config if loading fails
  return {
    version: "1.0.0",
    primarySources: [
      {
        name: "Jupiter",
        url: "https://price.jup.ag/v4/price",
        priority: 1,
        refreshIntervalMs: 2000
      }
    ],
    secondarySources: [],
    tokenSpecificOverrides: {},
    backupStrategies: {
      failoverEnabled: true,
      rotationEnabled: false,
      cacheTimeMs: 60000
    }
  };
}

// Select appropriate source for a token
function selectSourceForToken(
  token: string,
  config: PriceFeedConfig
): PriceSource | null {
  // Check if token has specific override
  const override = config.tokenSpecificOverrides[token];
  if (override) {
    // Find the specific source for this token
    const allSources = [
      ...config.primarySources,
      ...config.secondarySources,
      ...(config.specializedSources || [])
    ];
    
    const specificSource = allSources.find(s => s.name === override.primarySource);
    if (specificSource && !isSourceDisabled(specificSource)) {
      return specificSource;
    }
  }
  
  // If source rotation is enabled, rotate through available sources
  if (config.sourceRotation?.enabled) {
    return rotateSource(config);
  }
  
  // Default to first available primary source
  for (const source of config.primarySources) {
    if (!isSourceDisabled(source)) {
      return source;
    }
  }
  
  // Fallback to secondary sources if all primary are disabled
  for (const source of config.secondarySources) {
    if (!isSourceDisabled(source)) {
      return source;
    }
  }
  
  // If all sources are disabled, reset the least recently failed one
  const allSources = [
    ...config.primarySources,
    ...config.secondarySources,
    ...(config.specializedSources || [])
  ];
  
  let leastRecentlyFailed = allSources[0];
  let oldestFailure = Date.now();
  
  for (const source of allSources) {
    const status = sourceStatus[source.name] || { lastSuccess: 0, consecutiveFailures: 0, disabled: false, disabledUntil: 0 };
    if (status.disabledUntil < oldestFailure) {
      oldestFailure = status.disabledUntil;
      leastRecentlyFailed = source;
    }
  }
  
  // Reset this source and try again
  if (leastRecentlyFailed) {
    sourceStatus[leastRecentlyFailed.name] = { 
      lastSuccess: 0, 
      consecutiveFailures: 0, 
      disabled: false, 
      disabledUntil: 0 
    };
    return leastRecentlyFailed;
  }
  
  return null;
}

// Check if a source is currently disabled
function isSourceDisabled(source: PriceSource): boolean {
  const status = sourceStatus[source.name];
  if (!status) return false;
  
  // If source is disabled and the cooldown period hasn't elapsed, it's still disabled
  if (status.disabled && status.disabledUntil > Date.now()) {
    return true;
  }
  
  // If cooldown period has elapsed, reset the disabled status
  if (status.disabled && status.disabledUntil <= Date.now()) {
    status.disabled = false;
    status.consecutiveFailures = 0;
    return false;
  }
  
  return false;
}

// Rotate through available sources
function rotateSource(config: PriceFeedConfig): PriceSource | null {
  const allSources = [
    ...config.primarySources,
    ...config.secondarySources,
    ...(config.specializedSources || [])
  ].filter(s => !isSourceDisabled(s));
  
  if (allSources.length === 0) return null;
  
  // If priority weighting is enabled, favor higher priority sources
  if (config.sourceRotation?.priorityWeighting) {
    // Sort by priority (lower number = higher priority)
    allSources.sort((a, b) => a.priority - b.priority);
    
    // Use a probabilistic approach - higher priority sources have higher chance
    const totalSources = allSources.length;
    const weights = allSources.map((_, index) => totalSources - index);
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    
    const random = Math.random() * totalWeight;
    let cumulativeWeight = 0;
    
    for (let i = 0; i < allSources.length; i++) {
      cumulativeWeight += weights[i];
      if (random <= cumulativeWeight) {
        return allSources[i];
      }
    }
    
    return allSources[0]; // Fallback to first source
  }
  
  // Simple round-robin rotation
  // Find source that was used least recently
  const now = Date.now();
  
  allSources.sort((a, b) => {
    const aLastUsed = a.lastUsed || 0;
    const bLastUsed = b.lastUsed || 0;
    return aLastUsed - bLastUsed;
  });
  
  const selectedSource = allSources[0];
  selectedSource.lastUsed = now;
  
  return selectedSource;
}

// Handle rate limiting by implementing exponential backoff
async function fetchWithExponentialBackoff(
  url: string,
  token: string,
  config: PriceFeedConfig,
  source: PriceSource,
  attempt: number = 1
): Promise<any> {
  try {
    // Make the API call
    const response = await axios.get(url);
    
    // Update source status on success
    updateSourceStatus(source.name, true);
    
    return response.data;
  } catch (error: any) {
    // Check if this is a rate limit error
    const isRateLimitError = error.response && 
      (error.response.status === 429 || 
       error.response.status === 403 ||
       (error.response.data && error.response.data.includes && error.response.data.includes('rate limit')));
    
    // Update source status on failure
    updateSourceStatus(source.name, false, isRateLimitError);
    
    // If we should disable this source due to repeated failures, do so
    const rateLimitHandling = config.rateLimitHandling;
    if (rateLimitHandling && rateLimitHandling.enabled) {
      // Check if we've exceeded max retries
      if (attempt >= rateLimitHandling.maxRetries) {
        console.warn(\`Exceeded max retries (${rateLimitHandling.maxRetries}) for source \${source.name}. Using fallback.\`);
        
        // Disable this source temporarily if it's a rate limit error
        if (isRateLimitError) {
          const cooldownTime = source.rateLimit?.cooldownAfterLimitMs || 60000; // Default 1 minute
          disableSource(source.name, cooldownTime);
        }
        
        throw new Error(\`Rate limit exceeded for source \${source.name}\`);
      }
      
      // Calculate backoff time
      const backoffTime = Math.min(
        rateLimitHandling.initialBackoffMs * Math.pow(rateLimitHandling.backoffMultiplier, attempt - 1),
        rateLimitHandling.maxBackoffMs
      );
      
      console.warn(\`Server responded with \${error.response?.status || 'error'}. Retrying after \${backoffTime}ms delay...\`);
      
      // Wait for backoff time
      await new Promise(resolve => setTimeout(resolve, backoffTime));
      
      // Try again with increased attempt count
      return fetchWithExponentialBackoff(url, token, config, source, attempt + 1);
    }
    
    throw error;
  }
}

// Update source status tracking
function updateSourceStatus(sourceName: string, success: boolean, isRateLimit: boolean = false): void {
  // Initialize status if it doesn't exist
  if (!sourceStatus[sourceName]) {
    sourceStatus[sourceName] = {
      lastSuccess: 0,
      consecutiveFailures: 0,
      disabled: false,
      disabledUntil: 0
    };
  }
  
  const status = sourceStatus[sourceName];
  
  if (success) {
    status.lastSuccess = Date.now();
    status.consecutiveFailures = 0;
  } else {
    status.consecutiveFailures++;
    
    // If this is a rate limit issue, we may want to handle it differently
    if (isRateLimit) {
      // Disable for longer if it's a rate limit issue
      const config = loadPriceFeedConfig();
      if (config.resilienceOptions && status.consecutiveFailures >= config.resilienceOptions.circuitBreakerThreshold) {
        disableSource(sourceName, 300000); // Disable for 5 minutes on rate limit
      }
    } else {
      // Regular failure handling
      const config = loadPriceFeedConfig();
      if (config.resilienceOptions && status.consecutiveFailures >= config.resilienceOptions.circuitBreakerThreshold) {
        disableSource(sourceName, config.resilienceOptions.circuitBreakerResetTimeMs);
      }
    }
  }
}

// Disable a source temporarily
function disableSource(sourceName: string, disableDurationMs: number): void {
  if (!sourceStatus[sourceName]) {
    sourceStatus[sourceName] = {
      lastSuccess: 0,
      consecutiveFailures: 0,
      disabled: false,
      disabledUntil: 0
    };
  }
  
  const status = sourceStatus[sourceName];
  status.disabled = true;
  status.disabledUntil = Date.now() + disableDurationMs;
  
  console.warn(\`Source \${sourceName} has been disabled until \${new Date(status.disabledUntil).toLocaleTimeString()}\`);
}

// Format the URL for a specific token and source
function formatUrlForToken(source: PriceSource, token: string): string {
  let url = source.url;
  
  // Handle different API formats
  switch (source.name) {
    case 'Jupiter':
      return \`\${url}?ids=\${token}\`;
    case 'Birdeye':
      return \`\${url}/price?address=\${token}\`;
    case 'Pyth':
      return \`\${url}/price?symbol=\${token}\`;
    case 'PumpFun':
      return \`\${url}/token/\${token}\`;
    case 'SolanaFM':
      return \`\${url}/\${token}\`;
    default:
      return \`\${url}?token=\${token}\`;
  }
}

// Parse price data from different source formats
function parsePriceData(data: any, source: PriceSource, token: string): number | null {
  try {
    switch (source.name) {
      case 'Jupiter':
        return data.data?.[token]?.price || null;
      case 'Birdeye':
        return data.data?.value || null;
      case 'Pyth':
        return data.result?.price || null;
      case 'PumpFun':
        return data.price || null;
      case 'SolanaFM':
        return data.attributes?.price || null;
      default:
        // Try some common patterns
        return data.price || data.data?.price || data.result?.price || data.value || null;
    }
  } catch (error) {
    console.error(\`Error parsing price data from \${source.name}:\`, error);
    return null;
  }
}

// Get price of a token with fallback mechanisms
export async function getTokenPrice(token: string): Promise<TokenPrice | null> {
  const config = loadPriceFeedConfig();
  
  // Check cache first
  const cachedPrice = priceCache[token];
  const now = Date.now();
  
  if (cachedPrice && (now - cachedPrice.lastUpdated < config.backupStrategies.cacheTimeMs)) {
    return cachedPrice;
  }
  
  // Select appropriate source
  const source = selectSourceForToken(token, config);
  
  if (!source) {
    console.error('No available price sources. All sources may be rate-limited or disabled.');
    
    // If cache is available but stale, still return it as last resort
    if (cachedPrice && config.resilienceOptions && 
        (now - cachedPrice.lastUpdated < config.resilienceOptions.cacheStaleDataTimeoutMs)) {
      console.warn(\`Using stale cache data for \${token} from \${cachedPrice.source} (\${Math.round((now - cachedPrice.lastUpdated) / 1000)}s old)\`);
      return {
        ...cachedPrice,
        confidence: Math.max(0.1, cachedPrice.confidence * 0.5) // Reduce confidence for stale data
      };
    }
    
    return null;
  }
  
  try {
    // Format URL for this token and source
    const url = formatUrlForToken(source, token);
    
    // Fetch with rate limit handling
    const data = await fetchWithExponentialBackoff(url, token, config, source);
    
    // Parse price from response
    const price = parsePriceData(data, source, token);
    
    if (price !== null) {
      const tokenPrice: TokenPrice = {
        symbol: token,
        price: price,
        lastUpdated: now,
        source: source.name,
        confidence: 0.9 // High confidence for fresh data
      };
      
      // Update cache
      priceCache[token] = tokenPrice;
      
      return tokenPrice;
    }
    
    throw new Error(\`Could not parse price data for \${token} from \${source.name}\`);
  } catch (error) {
    console.error(\`Error fetching price for \${token} from \${source.name}:\`, error);
    
    // Try fallback sources if enabled
    if (config.backupStrategies.failoverEnabled) {
      return fallbackToAlternativeSource(token, config, source);
    }
    
    // Return cached data as last resort if available
    if (cachedPrice && config.resilienceOptions && 
        (now - cachedPrice.lastUpdated < config.resilienceOptions.cacheStaleDataTimeoutMs)) {
      console.warn(\`Using stale cache data for \${token} from \${cachedPrice.source} (\${Math.round((now - cachedPrice.lastUpdated) / 1000)}s old)\`);
      return {
        ...cachedPrice,
        confidence: Math.max(0.1, cachedPrice.confidence * 0.5) // Reduce confidence for stale data
      };
    }
    
    return null;
  }
}

// Try alternative sources when primary fails
async function fallbackToAlternativeSource(
  token: string,
  config: PriceFeedConfig,
  failedSource: PriceSource
): Promise<TokenPrice | null> {
  // Get all sources excluding the failed one
  const allSources = [
    ...config.primarySources,
    ...config.secondarySources,
    ...(config.specializedSources || [])
  ].filter(s => s.name !== failedSource.name && !isSourceDisabled(s));
  
  // Try each alternative source
  for (const source of allSources) {
    try {
      // Format URL for this token and source
      const url = formatUrlForToken(source, token);
      
      // Fetch with rate limit handling
      const data = await fetchWithExponentialBackoff(url, token, config, source);
      
      // Parse price from response
      const price = parsePriceData(data, source, token);
      
      if (price !== null) {
        const now = Date.now();
        const tokenPrice: TokenPrice = {
          symbol: token,
          price: price,
          lastUpdated: now,
          source: source.name,
          confidence: 0.8 // Slightly lower confidence for fallback source
        };
        
        // Update cache
        priceCache[token] = tokenPrice;
        
        console.log(\`Successfully fetched \${token} price from fallback source \${source.name}: \${price}\`);
        return tokenPrice;
      }
    } catch (error) {
      console.warn(\`Fallback source \${source.name} failed for \${token}:\`, error);
      // Continue to next fallback
    }
  }
  
  // All fallbacks failed, return cached data if available
  const cachedPrice = priceCache[token];
  const now = Date.now();
  
  if (cachedPrice && config.resilienceOptions && 
      (now - cachedPrice.lastUpdated < config.resilienceOptions.cacheStaleDataTimeoutMs)) {
    console.warn(\`All sources failed. Using stale cache data for \${token} from \${cachedPrice.source} (\${Math.round((now - cachedPrice.lastUpdated) / 1000)}s old)\`);
    return {
      ...cachedPrice,
      confidence: Math.max(0.1, cachedPrice.confidence * 0.3) // Significantly reduce confidence for stale data after all fallbacks failed
    };
  }
  
  return null;
}

// Get latest prices for multiple tokens
export async function getTokenPrices(tokens: string[]): Promise<{ [key: string]: TokenPrice | null }> {
  const results: { [key: string]: TokenPrice | null } = {};
  
  // Process tokens in parallel with a concurrency limit
  const concurrency = 3; // Max concurrent requests
  const chunks = [];
  
  // Split tokens into chunks
  for (let i = 0; i < tokens.length; i += concurrency) {
    chunks.push(tokens.slice(i, i + concurrency));
  }
  
  // Process each chunk sequentially to avoid overwhelming APIs
  for (const chunk of chunks) {
    const chunkPromises = chunk.map(token => getTokenPrice(token));
    const chunkResults = await Promise.all(chunkPromises);
    
    // Combine results
    chunk.forEach((token, index) => {
      results[token] = chunkResults[index];
    });
    
    // Add a small delay between chunks
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  return results;
}

// Check health of all price sources
export async function checkPriceSourcesHealth(): Promise<{ [key: string]: boolean }> {
  const config = loadPriceFeedConfig();
  const results: { [key: string]: boolean } = {};
  
  const allSources = [
    ...config.primarySources,
    ...config.secondarySources,
    ...(config.specializedSources || [])
  ];
  
  for (const source of allSources) {
    try {
      // Use a common token like SOL for health check
      const url = formatUrlForToken(source, 'SOL');
      await axios.get(url, { timeout: 5000 });
      results[source.name] = true;
    } catch (error) {
      results[source.name] = false;
    }
  }
  
  return results;
}

// Get source status report
export function getPriceSourcesStatus(): { [key: string]: any } {
  const config = loadPriceFeedConfig();
  const report: { [key: string]: any } = {};
  
  const allSources = [
    ...config.primarySources,
    ...config.secondarySources,
    ...(config.specializedSources || [])
  ];
  
  for (const source of allSources) {
    const status = sourceStatus[source.name] || { 
      lastSuccess: 0, 
      consecutiveFailures: 0, 
      disabled: false, 
      disabledUntil: 0 
    };
    
    report[source.name] = {
      priority: source.priority,
      refreshIntervalMs: source.refreshIntervalMs,
      lastSuccess: status.lastSuccess ? new Date(status.lastSuccess).toISOString() : 'never',
      consecutiveFailures: status.consecutiveFailures,
      status: status.disabled ? 'disabled' : 'active',
      enabledAt: status.disabled ? new Date(status.disabledUntil).toISOString() : 'now'
    };
  }
  
  return report;
}

// Reset all disabled sources
export function resetAllSources(): void {
  const config = loadPriceFeedConfig();
  const allSources = [
    ...config.primarySources,
    ...config.secondarySources,
    ...(config.specializedSources || [])
  ];
  
  for (const source of allSources) {
    sourceStatus[source.name] = {
      lastSuccess: 0,
      consecutiveFailures: 0,
      disabled: false,
      disabledUntil: 0
    };
  }
  
  console.log('All price sources have been reset.');
}

// Initialize source status tracking for all configured sources
export function initializePriceFeeds(): void {
  const config = loadPriceFeedConfig();
  const allSources = [
    ...config.primarySources,
    ...config.secondarySources,
    ...(config.specializedSources || [])
  ];
  
  for (const source of allSources) {
    if (!sourceStatus[source.name]) {
      sourceStatus[source.name] = {
        lastSuccess: 0,
        consecutiveFailures: 0,
        disabled: false,
        disabledUntil: 0
      };
    }
  }
  
  console.log(\`Initialized price feeds with \${allSources.length} sources:\`);
  allSources.forEach(source => {
    console.log(\`- \${source.name} (priority: \${source.priority}, refresh: \${source.refreshIntervalMs}ms)\`);
  });
}
`;
    
    fs.writeFileSync(priceFeedIntegrationPath, improvedIntegrationCode);
    log('✅ Created improved price feed integration code');
    
    return true;
  } catch (error) {
    log(`⚠️ Error creating price feed integration: ${error}`);
    return false;
  }
}

/**
 * Create an example usage script
 */
function createExampleUsage(): boolean {
  try {
    log('Creating example usage script...');
    
    const exampleUsagePath = path.join('./src', 'price-feed-example.ts');
    
    // Create example usage script
    const exampleUsageCode = `/**
 * Example usage of the improved price feed integration
 */

import { getTokenPrice, getTokenPrices, initializePriceFeeds, getPriceSourcesStatus } from './price-feed-integration';

// Initialize price feeds
initializePriceFeeds();

// Example of checking price sources status
async function checkSourceStatus() {
  const status = getPriceSourcesStatus();
  console.log('\\nPrice Sources Status:');
  console.log(JSON.stringify(status, null, 2));
}

// Example of getting a single token price
async function getSingleTokenPrice() {
  console.log('\\nGetting SOL price...');
  const solPrice = await getTokenPrice('SOL');
  console.log('SOL Price:', solPrice);
}

// Example of getting multiple token prices
async function getMultipleTokenPrices() {
  console.log('\\nGetting multiple token prices...');
  const tokens = ['SOL', 'BONK', 'JUP', 'PYTH'];
  const prices = await getTokenPrices(tokens);
  
  console.log('Token Prices:');
  for (const [token, price] of Object.entries(prices)) {
    console.log(\`\${token}: \${price ? \`\${price.price} USD (source: \${price.source}, confidence: \${price.confidence})\` : 'Not available'}\`);
  }
}

// Run the examples
async function runExamples() {
  try {
    await checkSourceStatus();
    await getSingleTokenPrice();
    await getMultipleTokenPrices();
  } catch (error) {
    console.error('Error running examples:', error);
  }
}

runExamples();
`;
    
    fs.writeFileSync(exampleUsagePath, exampleUsageCode);
    log('✅ Created example usage script');
    
    return true;
  } catch (error) {
    log(`⚠️ Error creating example usage: ${error}`);
    return false;
  }
}

/**
 * Update system memory with improved price feed integration
 */
function updateSystemMemory(): boolean {
  try {
    log('Updating system memory with improved price feed integration...');
    
    // Create system memory directory if it doesn't exist
    const systemMemoryDir = path.join(DATA_DIR, 'system-memory');
    if (!fs.existsSync(systemMemoryDir)) {
      fs.mkdirSync(systemMemoryDir, { recursive: true });
    }
    
    // Read current system memory if it exists
    let systemMemory: any = {};
    const systemMemoryPath = path.join(systemMemoryDir, 'system-memory.json');
    
    if (fs.existsSync(systemMemoryPath)) {
      try {
        const systemMemoryData = fs.readFileSync(systemMemoryPath, 'utf-8');
        systemMemory = JSON.parse(systemMemoryData);
      } catch (error) {
        console.warn('Error reading system memory, creating new one:', error);
      }
    }
    
    // Update price feed configuration in system memory
    systemMemory.priceFeed = {
      ...systemMemory.priceFeed,
      version: "2.1.0", // Increment version for improved rate limit handling
      improvedRateLimitHandling: true,
      adaptiveRefresh: true,
      sourceRotation: true,
      exponentialBackoff: true,
      cacheFallback: true,
      lastUpdated: new Date().toISOString()
    };
    
    // Save updated system memory
    fs.writeFileSync(systemMemoryPath, JSON.stringify(systemMemory, null, 2));
    log('✅ Updated system memory with improved price feed integration');
    
    return true;
  } catch (error) {
    log(`⚠️ Error updating system memory: ${error}`);
    return false;
  }
}

/**
 * Create script to restart price feed service
 */
function createRestartScript(): boolean {
  try {
    log('Creating restart script for price feed service...');
    
    const restartScriptPath = path.join('./', 'restart-price-feed.sh');
    
    // Create restart script
    const restartScript = `#!/bin/bash

# Restart Price Feed Service with Improved Rate Limit Handling

echo "=========================================="
echo "🚀 RESTARTING PRICE FEED SERVICE"
echo "=========================================="

# Kill any running price feed service
pkill -f "node.*price-feed" || true

# Wait for processes to terminate
sleep 2

# Start the improved price feed service
npx tsx src/price-feed-example.ts &

echo "✅ Price feed service restarted with improved rate limit handling"
echo "=========================================="
`;
    
    fs.writeFileSync(restartScriptPath, restartScript);
    fs.chmodSync(restartScriptPath, 0o755); // Make executable
    log('✅ Created restart script for price feed service');
    
    return true;
  } catch (error) {
    log(`⚠️ Error creating restart script: ${error}`);
    return false;
  }
}

/**
 * Main function to improve price feed
 */
function improvePriceFeed(): void {
  log('\n=======================================================');
  log('🚀 IMPROVING PRICE FEED WITH BETTER RATE LIMIT HANDLING');
  log('=======================================================');
  
  // Ensure config directory exists
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  
  // Ensure data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  
  let completedTasks = 0;
  
  // Update price feed configuration
  if (improvePriceFeedConfig()) {
    log('✅ Successfully updated price feed configuration');
    completedTasks++;
  }
  
  // Create improved price feed integration
  if (createImprovedPriceFeedIntegration()) {
    log('✅ Successfully created improved price feed integration');
    completedTasks++;
  }
  
  // Create example usage
  if (createExampleUsage()) {
    log('✅ Successfully created example usage script');
    completedTasks++;
  }
  
  // Update system memory
  if (updateSystemMemory()) {
    log('✅ Successfully updated system memory');
    completedTasks++;
  }
  
  // Create restart script
  if (createRestartScript()) {
    log('✅ Successfully created restart script');
    completedTasks++;
  }
  
  // Summary
  log('\n=======================================================');
  log(`✅ Successfully completed ${completedTasks}/5 tasks`);
  log('=======================================================');
  log('\nImprovements made:');
  log('1. Added exponential backoff for rate-limited sources');
  log('2. Implemented automatic source rotation');
  log('3. Enhanced fallback mechanisms with better caching');
  log('4. Added circuit breaker for repeatedly failing sources');
  log('5. Created easy restart mechanism for price feed service');
  
  if (completedTasks === 5) {
    log('\nYour price feed service is now more resilient to rate limits!');
    log('To restart the price feed service with these improvements, run:');
    log('./restart-price-feed.sh');
  } else {
    log('\n⚠️ Some tasks failed. Please check the logs and try again.');
  }
  
  log('=======================================================');
}

// Execute the improvement process
improvePriceFeed();