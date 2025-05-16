/**
 * Perplexity AI Integration
 * 
 * This module integrates the Perplexity AI API for:
 * 1. Market sentiment analysis
 * 2. Token research and due diligence
 * 3. Strategy optimization based on market conditions
 * 
 * IMPORTANT: Usage of this API must be carefully managed as the user only
 * has $30 of credit available. We implement strict usage limits and caching
 * to ensure the API is used efficiently.
 */

import axios from 'axios';
import * as logger from './logger';
import * as fs from 'fs';
import * as path from 'path';

// API configuration
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const API_URL = 'https://api.perplexity.ai/chat/completions';

// Usage control
const MAX_DAILY_REQUESTS = 50; // Limit to 50 requests per day
const COST_PER_REQUEST = 0.04; // Approximate cost per request in $
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours cache TTL

// Cache and usage tracking
interface CacheEntry {
  response: any;
  timestamp: number;
}

interface UsageMetrics {
  dailyRequestCount: number;
  totalRequestsSinceStart: number;
  lastResetTimestamp: number;
  estimatedCostToDate: number;
  requestLog: Array<{
    timestamp: number;
    query: string;
    tokens: number;
    estimated_cost: number;
  }>;
}

const responseCache: Map<string, CacheEntry> = new Map();
let usageMetrics: UsageMetrics = {
  dailyRequestCount: 0,
  totalRequestsSinceStart: 0,
  lastResetTimestamp: Date.now(),
  estimatedCostToDate: 0,
  requestLog: []
};

// Initialize the module
export async function initializePerplexityIntegration(): Promise<boolean> {
  try {
    logger.info('[Perplexity] Initializing Perplexity AI integration');
    
    if (!PERPLEXITY_API_KEY) {
      logger.error('[Perplexity] API key not found. Perplexity integration disabled.');
      return false;
    }
    
    // Load previous usage metrics if available
    const dataDir = path.join(process.cwd(), 'data', 'ai');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    const metricsPath = path.join(dataDir, 'perplexity_usage.json');
    if (fs.existsSync(metricsPath)) {
      try {
        usageMetrics = JSON.parse(fs.readFileSync(metricsPath, 'utf8'));
        
        // Reset daily counter if last reset was more than 24 hours ago
        if (Date.now() - usageMetrics.lastResetTimestamp > 24 * 60 * 60 * 1000) {
          usageMetrics.dailyRequestCount = 0;
          usageMetrics.lastResetTimestamp = Date.now();
        }
        
        logger.info(`[Perplexity] Loaded usage metrics: ${usageMetrics.totalRequestsSinceStart} total requests, $${usageMetrics.estimatedCostToDate.toFixed(2)} estimated cost`);
      } catch (error) {
        logger.error(`[Perplexity] Error loading usage metrics: ${error}`);
        // Continue with fresh metrics
      }
    }
    
    // Start daily reset timer
    startDailyResetTimer();
    
    logger.info('[Perplexity] Successfully initialized Perplexity AI integration');
    logger.info(`[Perplexity] Daily request limit: ${MAX_DAILY_REQUESTS}, Cache TTL: ${CACHE_TTL_MS / (60 * 60 * 1000)} hours`);
    
    return true;
  } catch (error) {
    logger.error(`[Perplexity] Initialization error: ${error}`);
    return false;
  }
}

// Reset daily request counter at midnight
function startDailyResetTimer() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  
  const timeUntilMidnight = tomorrow.getTime() - now.getTime();
  
  setTimeout(() => {
    usageMetrics.dailyRequestCount = 0;
    usageMetrics.lastResetTimestamp = Date.now();
    saveUsageMetrics();
    
    // Restart timer for next day
    startDailyResetTimer();
  }, timeUntilMidnight);
  
  logger.info(`[Perplexity] Daily reset timer scheduled for midnight (${timeUntilMidnight / (60 * 60 * 1000)} hours from now)`);
}

// Save usage metrics to disk
function saveUsageMetrics() {
  try {
    const dataDir = path.join(process.cwd(), 'data', 'ai');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    const metricsPath = path.join(dataDir, 'perplexity_usage.json');
    fs.writeFileSync(metricsPath, JSON.stringify(usageMetrics, null, 2), 'utf8');
  } catch (error) {
    logger.error(`[Perplexity] Error saving usage metrics: ${error}`);
  }
}

// Function to check if a request is allowed based on daily limits
function canMakeRequest(): boolean {
  return usageMetrics.dailyRequestCount < MAX_DAILY_REQUESTS;
}

// Generate cache key from request parameters
function generateCacheKey(messages: any[], model: string): string {
  return JSON.stringify({ messages, model });
}

// Check cache for existing response
function getCachedResponse(messages: any[], model: string): any | null {
  const cacheKey = generateCacheKey(messages, model);
  const cachedEntry = responseCache.get(cacheKey);
  
  if (cachedEntry && Date.now() - cachedEntry.timestamp < CACHE_TTL_MS) {
    logger.info('[Perplexity] Using cached response');
    return cachedEntry.response;
  }
  
  return null;
}

// Cache a response
function cacheResponse(messages: any[], model: string, response: any) {
  const cacheKey = generateCacheKey(messages, model);
  responseCache.set(cacheKey, {
    response,
    timestamp: Date.now()
  });
}

// Core function to query Perplexity API
export async function queryPerplexity(
  userMessage: string,
  systemMessage: string = "Be precise and concise.",
  model: string = "llama-3.1-sonar-small-128k-online"
): Promise<any> {
  try {
    // Check if we've hit our daily limit
    if (!canMakeRequest()) {
      logger.warn('[Perplexity] Daily request limit reached. Using fallback analysis.');
      return {
        error: "Daily request limit reached",
        fallback: true,
        content: "Analysis unavailable due to API usage limits. Please try again tomorrow."
      };
    }
    
    // Prepare the messages
    const messages = [
      { role: "system", content: systemMessage },
      { role: "user", content: userMessage }
    ];
    
    // Check cache first
    const cachedResponse = getCachedResponse(messages, model);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Log the request intent
    logger.info(`[Perplexity] Querying API: "${userMessage.substring(0, 100)}${userMessage.length > 100 ? '...' : ''}"`);
    
    // Make the API request
    const response = await axios.post(
      API_URL,
      {
        model,
        messages,
        max_tokens: 1024,
        temperature: 0.2,
        frequency_penalty: 1,
        presence_penalty: 0,
        search_recency_filter: "month",
        return_related_questions: false,
        stream: false
      },
      {
        headers: {
          'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    // Update usage metrics
    const tokens = response.data.usage.total_tokens;
    const estimatedCost = (tokens / 1000) * COST_PER_REQUEST;
    
    usageMetrics.dailyRequestCount++;
    usageMetrics.totalRequestsSinceStart++;
    usageMetrics.estimatedCostToDate += estimatedCost;
    usageMetrics.requestLog.push({
      timestamp: Date.now(),
      query: userMessage.substring(0, 100),
      tokens,
      estimated_cost: estimatedCost
    });
    
    // Trim request log if it gets too large
    if (usageMetrics.requestLog.length > 1000) {
      usageMetrics.requestLog = usageMetrics.requestLog.slice(-1000);
    }
    
    // Save updated metrics
    saveUsageMetrics();
    
    // Log usage information
    logger.info(`[Perplexity] Request completed: ${tokens} tokens, est. cost: $${estimatedCost.toFixed(4)}`);
    logger.info(`[Perplexity] Usage status: ${usageMetrics.dailyRequestCount}/${MAX_DAILY_REQUESTS} daily requests, est. total cost: $${usageMetrics.estimatedCostToDate.toFixed(2)}`);
    
    // Extract the response content
    const content = response.data.choices[0].message.content;
    
    // Cache the response
    cacheResponse(messages, model, { content, citations: response.data.citations });
    
    return { content, citations: response.data.citations };
  } catch (error) {
    logger.error(`[Perplexity] API request error: ${error}`);
    return {
      error: "API request failed",
      fallback: true,
      content: "Analysis unavailable due to API error."
    };
  }
}

// Get token market sentiment analysis
export async function analyzeTokenSentiment(tokenSymbol: string): Promise<any> {
  const systemMessage = "You are an expert cryptocurrency market analyst AI. Provide an objective sentiment analysis of the specified token. Include relevant metrics, recent news, on-chain behavior, and reliable predictive model outcomes. Focus on quantitative data over qualitative opinions. Keep your response concise, 250 words or less.";
  
  const userMessage = `Analyze the current market sentiment for ${tokenSymbol}. Include:
1. Overall sentiment (bullish/bearish/neutral)
2. Key on-chain metrics
3. Recent price action
4. Whale activity
5. Recent news impact
6. Support/resistance levels if applicable`;
  
  return queryPerplexity(userMessage, systemMessage);
}

// Research a specific token
export async function researchToken(tokenSymbol: string): Promise<any> {
  const systemMessage = "You are an expert cryptocurrency researcher AI. Provide comprehensive but concise information about the specified token. Include real data about tokenomics, team, technical aspects, and market position. Focus on facts not speculation. Your response should be informative and balanced, approximately 300 words.";
  
  const userMessage = `Research the ${tokenSymbol} token and provide:
1. Core project details and purpose
2. Tokenomics (supply, distribution, emission schedule)
3. Technology strengths and weaknesses
4. Competitive positioning
5. Major partnerships or integrations
6. Recent milestones achieved`;
  
  return queryPerplexity(userMessage, systemMessage);
}

// Analyze cross-chain opportunities
export async function analyzeCrossChainOpportunities(): Promise<any> {
  const systemMessage = "You are an expert cross-chain DeFi analyst AI. Identify current arbitrage, yield farming, or other profit opportunities across multiple blockchains. Focus on concrete strategies that exploit price differences or yield variations. Provide specific examples with real protocols and quantitative estimates when possible. Be concise but thorough, approximately 350 words.";
  
  const userMessage = `Identify the top cross-chain opportunities between Solana and other chains (Ethereum, Arbitrum, etc.) available right now. Include:
1. Specific arbitrage opportunities with DEXs and percentage differences
2. Cross-chain yield farming strategies with estimated APYs
3. Any notable token bridge inefficiencies
4. Risk levels for each opportunity
5. Required capital to meaningfully capture the opportunity`;
  
  return queryPerplexity(userMessage, systemMessage);
}

// Analyze market conditions for strategy adjustments
export async function analyzeMarketForStrategyAdjustments(): Promise<any> {
  const systemMessage = "You are an expert cryptocurrency trading strategy AI. Based on current market conditions, recommend adjustments to trading strategies. Focus on quantitative insights, volatility measures, and systematic approaches. Avoid general advice in favor of specific tactical adjustments. Your response should be actionable and precise, approximately 300 words.";
  
  const userMessage = `Analyze current market conditions and suggest specific adjustments to trading strategies. Include:
1. Current market phase assessment (accumulation, uptrend, distribution, downtrend)
2. Volatility regime analysis and appropriate position sizing
3. Market correlation changes and diversification implications
4. Sector rotation insights (which crypto sectors are gaining/losing momentum)
5. Time frame adjustments for current conditions
6. Risk management parameter adjustments`;
  
  return queryPerplexity(userMessage, systemMessage);
}

// Get usage statistics
export function getUsageStatistics(): any {
  return {
    dailyRequests: usageMetrics.dailyRequestCount,
    dailyLimit: MAX_DAILY_REQUESTS,
    totalRequests: usageMetrics.totalRequestsSinceStart,
    estimatedCost: usageMetrics.estimatedCostToDate,
    cachedResponses: responseCache.size,
    lastResetTime: new Date(usageMetrics.lastResetTimestamp).toISOString()
  };
}

// Clean up cached responses older than TTL
export function cleanupCache(): number {
  const now = Date.now();
  let cleanedCount = 0;
  
  for (const [key, entry] of responseCache.entries()) {
    if (now - entry.timestamp > CACHE_TTL_MS) {
      responseCache.delete(key);
      cleanedCount++;
    }
  }
  
  logger.info(`[Perplexity] Cleaned up ${cleanedCount} expired cache entries`);
  return cleanedCount;
}