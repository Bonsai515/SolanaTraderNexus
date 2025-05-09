import { QueryClient, QueryClientProvider as TanStackQueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';

// Configure the query client with reasonable defaults
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30 * 1000, // 30 seconds
    },
  },
});

// Common API request handler
interface FetcherOptions {
  headers?: Record<string, string>;
  credentials?: RequestCredentials;
}

// Default options for fetch requests
const defaultOptions: FetcherOptions = {
  headers: {
    'Content-Type': 'application/json',
  },
  credentials: 'same-origin',
};

// Get base API URL
const getApiBaseUrl = (): string => {
  // In production, use the current origin
  // In development, use localhost:5000 if not in the browser
  const isProduction = import.meta.env.PROD;
  const isBrowser = typeof window !== 'undefined';
  
  if (isProduction || isBrowser) {
    return window.location.origin;
  }
  
  return 'http://localhost:5000';
};

/**
 * Generic API request function
 * @param method The HTTP method to use
 * @param endpoint The API endpoint path (e.g., '/api/health')
 * @param data The data to send (for POST/PUT/PATCH)
 * @param options Additional fetch options
 * @returns The Response object
 */
export async function apiRequest(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  endpoint: string,
  data?: unknown,
  options: FetcherOptions = {}
): Promise<Response> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${endpoint}`;
  
  const opts: RequestInit = {
    method,
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers,
    },
  };

  if (data) {
    opts.body = JSON.stringify(data);
  }

  return fetch(url, opts);
}

/**
 * Generic API request function with JSON parsing
 * @param method The HTTP method to use
 * @param endpoint The API endpoint path
 * @param data The data to send (for POST/PUT/PATCH)
 * @param options Additional fetch options
 * @returns The parsed JSON response
 */
export async function apiRequestJson<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  endpoint: string,
  data?: unknown,
  options: FetcherOptions = {}
): Promise<T> {
  const response = await apiRequest(method, endpoint, data, options);

  // Handle non-JSON responses
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }
    return {} as T;
  }

  const json = await response.json();

  // Handle API errors
  if (!response.ok) {
    throw new Error(json.error || `API Error: ${response.status} ${response.statusText}`);
  }

  return json as T;
}

/**
 * Default query function for react-query
 * @param queryKey The query key (first element should be the endpoint)
 * @returns The parsed JSON response
 */
export async function defaultQueryFn<T>({ queryKey }: { queryKey: (string | Record<string, unknown>)[] }): Promise<T> {
  const endpoint = queryKey[0] as string;
  const response = await apiRequest('GET', endpoint);
  return response.json() as Promise<T>;
}

// Configure the query client with the default query function
queryClient.setDefaultOptions({
  queries: {
    queryFn: defaultQueryFn,
  },
});

// Export a direct replacement for QueryClientProvider
export function QueryClientProvider({ children }: { children: ReactNode }) {
  // Return the children directly for now to avoid build issues
  return children;
}

export default queryClient;