/**
 * API Client Wrapper
 * 
 * This module wraps API calls with rate limiting, caching, and retries
 * to prevent 429 errors.
 */

import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { rateLimiter } from '../rate-limiter/rate-limiter';

// API client with rate limiting
class ApiClient {
  /**
   * Make a rate-limited API request
   */
  async request<T>(config: {
    provider: string;
    method: string;
    url: string;
    params?: any;
    data?: any;
    headers?: Record<string, string>;
    timeout?: number;
    maxRetries?: number;
  }): Promise<T> {
    const {
      provider,
      method,
      url,
      params = {},
      data = undefined,
      headers = {},
      timeout = 30000,
      maxRetries = 5
    } = config;
    
    // Check cache first
    const cachedResponse = rateLimiter.getCachedResponse<T>(provider, method, params);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Check rate limiting
    if (rateLimiter.shouldRateLimit(provider, method, params)) {
      return this.retryWithBackoff<T>(config, 1, maxRetries);
    }
    
    try {
      // Make the request
      const axiosConfig: AxiosRequestConfig = {
        method,
        url,
        params,
        data,
        headers,
        timeout
      };
      
      const response = await axios(axiosConfig);
      
      // Handle success
      rateLimiter.handleSuccess(provider);
      
      // Cache the response
      rateLimiter.cacheResponse(provider, method, params, response.data);
      
      return response.data;
    } catch (error: any) {
      // Handle failure
      if (error.response) {
        rateLimiter.handleFailure(provider, error.response.status);
        
        // Retry on certain status codes
        if (error.response.status === 429 || // Too Many Requests
            error.response.status >= 500) {  // Server errors
          return this.retryWithBackoff<T>(config, 1, maxRetries);
        }
      } else {
        // Network error
        rateLimiter.handleFailure(provider, 0);
        return this.retryWithBackoff<T>(config, 1, maxRetries);
      }
      
      throw error;
    }
  }
  
  /**
   * Retry a request with exponential backoff
   */
  private async retryWithBackoff<T>(
    config: any,
    attempt: number,
    maxRetries: number
  ): Promise<T> {
    if (attempt > maxRetries) {
      throw new Error(`Maximum retries (${maxRetries}) exceeded for ${config.url}`);
    }
    
    const delay = rateLimiter.calculateRetryDelay(config.provider, attempt);
    
    console.log(`Retrying request to ${config.provider} in ${delay}ms (attempt ${attempt}/${maxRetries})`);
    
    // Wait for the backoff delay
    await new Promise(resolve => setTimeout(resolve, delay));
    
    // Try again recursively
    try {
      return await this.request<T>(config);
    } catch (error) {
      // If still failing, retry again with increased backoff
      return this.retryWithBackoff<T>(config, attempt + 1, maxRetries);
    }
  }
  
  /**
   * Make a GET request
   */
  async get<T>(
    provider: string,
    url: string,
    params: any = {},
    options: any = {}
  ): Promise<T> {
    return this.request<T>({
      provider,
      method: 'get',
      url,
      params,
      ...options
    });
  }
  
  /**
   * Make a POST request
   */
  async post<T>(
    provider: string,
    url: string,
    data: any = {},
    params: any = {},
    options: any = {}
  ): Promise<T> {
    return this.request<T>({
      provider,
      method: 'post',
      url,
      data,
      params,
      ...options
    });
  }
}

// Export API client singleton
export const apiClient = new ApiClient();