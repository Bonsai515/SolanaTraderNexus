import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { QueryClientProvider } from './lib/queryClient';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);