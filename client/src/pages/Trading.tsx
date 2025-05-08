import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import useWsStore from '../lib/wsClient';

export default function Trading() {
  const [activeTab, setActiveTab] = useState('signals');
  const { messages, sendMessage } = useWsStore();
  
  // Get signals from API
  const { data: signals, isLoading: loadingSignals } = useQuery({
    queryKey: ['/api/signals'],
    staleTime: 10 * 1000, // 10 seconds
  });
  
  // Get transactions from API
  const { data: transactions, isLoading: loadingTransactions } = useQuery({
    queryKey: ['/api/transactions'],
    staleTime: 10 * 1000, // 10 seconds
  });
  
  // Request real-time signals through WebSocket
  useEffect(() => {
    // Request signals on mount
    sendMessage({ type: 'GET_SIGNALS' });
    
    // Periodic refresh
    const interval = setInterval(() => {
      sendMessage({ type: 'GET_SIGNALS' });
    }, 30000); // Every 30 seconds
    
    return () => clearInterval(interval);
  }, [sendMessage]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Trading</h1>
        <div className="bg-card rounded-lg overflow-hidden flex">
          <button 
            className={`px-4 py-2 ${activeTab === 'signals' ? 'bg-accent' : ''}`}
            onClick={() => setActiveTab('signals')}
          >
            Signals
          </button>
          <button 
            className={`px-4 py-2 ${activeTab === 'transactions' ? 'bg-accent' : ''}`}
            onClick={() => setActiveTab('transactions')}
          >
            Transactions
          </button>
          <button 
            className={`px-4 py-2 ${activeTab === 'market' ? 'bg-accent' : ''}`}
            onClick={() => setActiveTab('market')}
          >
            Market
          </button>
        </div>
      </div>
      
      {/* Signals Tab */}
      {activeTab === 'signals' && (
        <div className="bg-card rounded-lg shadow-md p-6 border border-border">
          <h2 className="text-xl font-semibold mb-4">Trading Signals</h2>
          
          {loadingSignals ? (
            <div className="text-center py-4">Loading signals...</div>
          ) : signals?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-4">Pair</th>
                    <th className="text-left py-2 px-4">Type</th>
                    <th className="text-left py-2 px-4">Strength</th>
                    <th className="text-left py-2 px-4">Price</th>
                    <th className="text-left py-2 px-4">Time</th>
                    <th className="text-left py-2 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {signals.map(signal => (
                    <tr key={signal.id} className="border-b border-border hover:bg-accent/20">
                      <td className="py-3 px-4">{signal.pair}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-block px-2 py-1 rounded-full text-xs ${
                          signal.type === 'BUY' ? 'bg-success/20 text-success' : 
                          signal.type === 'SELL' ? 'bg-destructive/20 text-destructive' : 
                          'bg-muted text-muted-foreground'
                        }`}>
                          {signal.type}
                        </span>
                      </td>
                      <td className="py-3 px-4">{signal.strength}</td>
                      <td className="py-3 px-4">{signal.price}</td>
                      <td className="py-3 px-4">
                        {new Date(signal.created_at).toLocaleTimeString()}
                      </td>
                      <td className="py-3 px-4">
                        <button className="text-sm px-2 py-1 bg-primary text-primary-foreground rounded">
                          Execute
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground">No signals available</div>
          )}
        </div>
      )}
      
      {/* Transactions Tab */}
      {activeTab === 'transactions' && (
        <div className="bg-card rounded-lg shadow-md p-6 border border-border">
          <h2 className="text-xl font-semibold mb-4">Transactions</h2>
          
          {loadingTransactions ? (
            <div className="text-center py-4">Loading transactions...</div>
          ) : transactions?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-4">ID</th>
                    <th className="text-left py-2 px-4">Type</th>
                    <th className="text-left py-2 px-4">Pair</th>
                    <th className="text-left py-2 px-4">Amount</th>
                    <th className="text-left py-2 px-4">Status</th>
                    <th className="text-left py-2 px-4">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(tx => (
                    <tr key={tx.id} className="border-b border-border hover:bg-accent/20">
                      <td className="py-3 px-4 font-mono text-xs">{tx.id.substring(0, 8)}...</td>
                      <td className="py-3 px-4">{tx.type}</td>
                      <td className="py-3 px-4">{tx.pair}</td>
                      <td className="py-3 px-4">{tx.amount}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-block px-2 py-1 rounded-full text-xs ${
                          tx.status === 'CONFIRMED' ? 'bg-success/20 text-success' : 
                          tx.status === 'PENDING' ? 'bg-warning/20 text-warning' : 
                          tx.status === 'FAILED' ? 'bg-destructive/20 text-destructive' : 
                          'bg-muted text-muted-foreground'
                        }`}>
                          {tx.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {new Date(tx.created_at).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground">No transactions available</div>
          )}
        </div>
      )}
      
      {/* Market Tab */}
      {activeTab === 'market' && (
        <div className="bg-card rounded-lg shadow-md p-6 border border-border">
          <h2 className="text-xl font-semibold mb-4">Market Data</h2>
          
          <div className="text-center py-8 text-muted-foreground">
            <p>Market data visualization coming soon</p>
            <p className="text-sm mt-2">This will display real-time price charts and market depth</p>
          </div>
        </div>
      )}
    </div>
  );
}