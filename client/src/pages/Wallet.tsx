import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../lib/queryClient';

export default function Wallet() {
  const [isCreating, setIsCreating] = useState(false);
  
  // Get wallets from API
  const { 
    data: wallets, 
    isLoading, 
    refetch 
  } = useQuery({
    queryKey: ['/api/wallets'],
    staleTime: 60 * 1000, // 1 minute
  });

  // Create a new wallet
  const createWallet = async (name: string) => {
    try {
      await apiRequest('/api/wallets', 'POST', { name });
      refetch();
      setIsCreating(false);
    } catch (error) {
      console.error('Error creating wallet:', error);
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Wallet</h1>
        <button 
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm"
          onClick={() => setIsCreating(true)}
        >
          New Wallet
        </button>
      </div>
      
      {/* Wallets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-full text-center py-10">Loading wallets...</div>
        ) : wallets?.length > 0 ? (
          wallets.map((wallet) => (
            <div key={wallet.id} className="bg-card rounded-lg shadow-md p-5 border border-border">
              <h3 className="text-lg font-semibold mb-2">{wallet.name}</h3>
              
              <div className="space-y-3">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Address</div>
                  <div className="font-mono text-xs bg-background p-2 rounded overflow-x-auto">
                    {wallet.address}
                  </div>
                </div>
                
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Balance</div>
                  <div className="text-2xl font-bold">{wallet.balance} SOL</div>
                </div>
                
                <div className="pt-2 flex gap-2">
                  <button className="flex-1 px-3 py-1.5 bg-primary/90 text-primary-foreground text-sm rounded-md">
                    Send
                  </button>
                  <button className="flex-1 px-3 py-1.5 border border-input text-sm rounded-md">
                    Receive
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full text-center py-10 text-muted-foreground">
            <p>No wallets found</p>
            <p className="text-sm mt-2">
              Create your first wallet to start trading
            </p>
            <button 
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm"
              onClick={() => setIsCreating(true)}
            >
              Create Wallet
            </button>
          </div>
        )}
      </div>
      
      {/* Create Wallet Modal */}
      {isCreating && (
        <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50 p-4">
          <div className="bg-card w-full max-w-md rounded-lg shadow-lg border border-border p-6">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-2xl font-bold">Create New Wallet</h2>
              <button 
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setIsCreating(false)}
              >
                ✕
              </button>
            </div>
            
            <form 
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const name = formData.get('name') as string;
                if (name) {
                  createWallet(name);
                }
              }}
            >
              <div>
                <label className="block text-sm font-medium mb-1">Wallet Name</label>
                <input 
                  type="text" 
                  name="name"
                  className="w-full px-3 py-2 bg-background border border-input rounded-md"
                  placeholder="My Trading Wallet"
                  required
                />
              </div>
              
              <div className="py-2">
                <div className="text-sm text-muted-foreground mb-2">
                  This will generate a new Solana wallet keypair. The private key will be securely
                  stored in the backend.
                </div>
              </div>
              
              <div className="pt-2 flex justify-end gap-3">
                <button 
                  type="button"
                  className="px-4 py-2 border border-input rounded-md text-sm"
                  onClick={() => setIsCreating(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm"
                >
                  Create Wallet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}