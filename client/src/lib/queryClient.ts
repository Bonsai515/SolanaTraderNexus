// TanStack Query client setup

import {
  QueryClient,
  QueryClientProvider as TanStackQueryClientProvider,
  DefaultOptions,
} from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState, ReactNode } from 'react';

// Default query options
const defaultOptions: DefaultOptions = {
  queries: {
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 60 * 1000, // 1 minute
  },
};

// Default fetch function for queries
export const defaultQueryFn = async <T>({ queryKey }: { queryKey: string[] }) => {
  const [url] = queryKey;
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  if (!res.ok) {
    let errorText = await res.text();
    try {
      // Try to parse as JSON first
      const errorJson = JSON.parse(errorText);
      throw new Error(errorJson.error || errorJson.message || `API Error: ${res.status}`);
    } catch (e) {
      // If not JSON, use the raw text
      throw new Error(errorText || `API Error: ${res.status}`);
    }
  }
  
  return (await res.json()) as T;
};

// API request function for mutations
export const apiRequest = async <T>(
  url: string,
  method: 'POST' | 'PATCH' | 'DELETE' | 'PUT' = 'POST',
  data?: any
): Promise<T> => {
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: data ? JSON.stringify(data) : undefined,
  });
  
  if (!res.ok) {
    let errorText = await res.text();
    try {
      // Try to parse as JSON first
      const errorJson = JSON.parse(errorText);
      throw new Error(errorJson.error || errorJson.message || `API Error: ${res.status}`);
    } catch (e) {
      // If not JSON, use the raw text
      throw new Error(errorText || `API Error: ${res.status}`);
    }
  }
  
  // For DELETE operations, we might not have a response body
  if (method === 'DELETE' && res.status === 204) {
    return {} as T;
  }
  
  return (await res.json()) as T;
};

// Create a client
export const queryClient = new QueryClient({
  defaultOptions,
  queryCache: {},
});

// Query client provider component
interface QueryClientProviderProps {
  children: ReactNode;
}

export const QueryClientProvider = ({ children }: QueryClientProviderProps) => {
  const [client] = useState(() => queryClient);
  
  return (
    <TanStackQueryClientProvider client={client}>
      {children}
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </TanStackQueryClientProvider>
  );
};

export default queryClient;