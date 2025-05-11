import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { QueryClientProvider } from './lib/queryClient';

// Fix for TypeScript's error if root element is null
const rootElement = document.getElementById('root');
if (!rootElement) {
  // Create root element if it doesn't exist (fallback)
  const fallbackRoot = document.createElement('div');
  fallbackRoot.id = 'root';
  document.body.appendChild(fallbackRoot);
}

ReactDOM.createRoot(rootElement || document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider>
        <App />
    </QueryClientProvider>
  </React.StrictMode>
);