import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../lib/queryClient';

export default function Strategies() {
  const [isCreating, setIsCreating] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState(null);
  
  // Get strategies from API
  const { 
    data: strategies, 
    isLoading, 
    refetch 
  } = useQuery({
    queryKey: ['/api/strategies'],
    staleTime: 30 * 1000, // 30 seconds
  });
  
  // Toggle strategy status
  const toggleStrategyStatus = async (id: string, active: boolean) => {
    try {
      await apiRequest(`/api/strategies/${id}`, 'PATCH', { active: !active });
      refetch();
    } catch (error) {
      console.error('Error toggling strategy status:', error);
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Trading Strategies</h1>
        <button 
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm"
          onClick={() => setIsCreating(true)}
        >
          New Strategy
        </button>
      </div>
      
      {/* Strategies List */}
      <div className="bg-card rounded-lg shadow-md border border-border">
        {isLoading ? (
          <div className="text-center py-10">Loading strategies...</div>
        ) : strategies?.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4">Name</th>
                  <th className="text-left py-3 px-4">Type</th>
                  <th className="text-left py-3 px-4">Pair</th>
                  <th className="text-left py-3 px-4">Status</th>
                  <th className="text-left py-3 px-4">Created</th>
                  <th className="text-left py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {strategies.map((strategy) => (
                  <tr key={strategy.id} className="border-b border-border hover:bg-accent/20">
                    <td className="py-3 px-4 font-medium">{strategy.name}</td>
                    <td className="py-3 px-4">{strategy.type}</td>
                    <td className="py-3 px-4">{strategy.pair}</td>
                    <td className="py-3 px-4">
                      <div className={`inline-block px-2 py-1 rounded-full text-xs ${
                        strategy.active ? 'bg-success/20 text-success' : 'bg-muted text-muted-foreground'
                      }`}>
                        {strategy.active ? 'Active' : 'Inactive'}
                      </div>
                    </td>
                    <td className="py-3 px-4">{new Date(strategy.created_at).toLocaleDateString()}</td>
                    <td className="py-3 px-4">
                      <div className="flex gap-2">
                        <button 
                          className="text-xs px-2 py-1 bg-accent rounded"
                          onClick={() => setSelectedStrategy(strategy)}
                        >
                          Edit
                        </button>
                        <button 
                          className={`text-xs px-2 py-1 rounded ${
                            strategy.active
                              ? 'bg-muted text-muted-foreground'
                              : 'bg-success text-success-foreground'
                          }`}
                          onClick={() => toggleStrategyStatus(strategy.id, strategy.active)}
                        >
                          {strategy.active ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-10 text-muted-foreground">
            <p>No strategies found</p>
            <p className="text-sm mt-2">
              Create your first strategy to start automated trading
            </p>
            <button 
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm"
              onClick={() => setIsCreating(true)}
            >
              Create Strategy
            </button>
          </div>
        )}
      </div>
      
      {/* Strategy Types */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card rounded-lg shadow-md p-5 border border-border">
          <h3 className="text-xl font-semibold mb-2">Market Making</h3>
          <p className="text-muted-foreground">
            Place buy and sell orders simultaneously to profit from the spread between bid and ask prices.
          </p>
          <div className="mt-4 text-sm">
            <div className="text-muted-foreground mb-1">Key Parameters:</div>
            <ul className="list-disc list-inside space-y-1">
              <li>Spread threshold</li>
              <li>Order size</li>
              <li>Refresh interval</li>
            </ul>
          </div>
        </div>
        
        <div className="bg-card rounded-lg shadow-md p-5 border border-border">
          <h3 className="text-xl font-semibold mb-2">Momentum Trading</h3>
          <p className="text-muted-foreground">
            Capture price trends and momentum by entering positions in the direction of established trends.
          </p>
          <div className="mt-4 text-sm">
            <div className="text-muted-foreground mb-1">Key Parameters:</div>
            <ul className="list-disc list-inside space-y-1">
              <li>Momentum indicators</li>
              <li>Entry/exit thresholds</li>
              <li>Position sizing</li>
            </ul>
          </div>
        </div>
        
        <div className="bg-card rounded-lg shadow-md p-5 border border-border">
          <h3 className="text-xl font-semibold mb-2">Arbitrage</h3>
          <p className="text-muted-foreground">
            Exploit price discrepancies between different exchanges or trading pairs.
          </p>
          <div className="mt-4 text-sm">
            <div className="text-muted-foreground mb-1">Key Parameters:</div>
            <ul className="list-disc list-inside space-y-1">
              <li>Price difference threshold</li>
              <li>Maximum slippage</li>
              <li>Execution timing</li>
            </ul>
          </div>
        </div>
      </div>
      
      {/* Creating/Editing Modal */}
      {(isCreating || selectedStrategy) && (
        <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50 p-4">
          <div className="bg-card w-full max-w-lg rounded-lg shadow-lg border border-border p-6">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-2xl font-bold">
                {isCreating ? 'Create Strategy' : 'Edit Strategy'}
              </h2>
              <button 
                className="text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setIsCreating(false);
                  setSelectedStrategy(null);
                }}
              >
                ✕
              </button>
            </div>
            
            <form className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input 
                  type="text" 
                  className="w-full px-3 py-2 bg-background border border-input rounded-md"
                  placeholder="Strategy Name"
                  defaultValue={selectedStrategy?.name}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Type</label>
                <select className="w-full px-3 py-2 bg-background border border-input rounded-md">
                  <option value="">Select Type</option>
                  <option value="MARKET_MAKING">Market Making</option>
                  <option value="MOMENTUM">Momentum</option>
                  <option value="ARBITRAGE">Arbitrage</option>
                  <option value="RANGE_TRADING">Range Trading</option>
                  <option value="LIQUIDITY_PROVIDING">Liquidity Providing</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Token Pair</label>
                <input 
                  type="text" 
                  className="w-full px-3 py-2 bg-background border border-input rounded-md"
                  placeholder="SOL/USDC"
                  defaultValue={selectedStrategy?.pair}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea 
                  className="w-full px-3 py-2 bg-background border border-input rounded-md h-20"
                  placeholder="Strategy description..."
                  defaultValue={selectedStrategy?.description}
                />
              </div>
              
              <div className="pt-2 flex justify-end gap-3">
                <button 
                  type="button"
                  className="px-4 py-2 border border-input rounded-md text-sm"
                  onClick={() => {
                    setIsCreating(false);
                    setSelectedStrategy(null);
                  }}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm"
                >
                  {isCreating ? 'Create' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}