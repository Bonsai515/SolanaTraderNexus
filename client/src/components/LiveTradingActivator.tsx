import { useState } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { apiRequest } from '@/lib/queryClient';

export default function LiveTradingActivator() {
  const [isActivating, setIsActivating] = useState(false);
  const [isLiveTrading, setIsLiveTrading] = useState(false);
  const { toast } = useToast();

  const activateLiveTrading = async () => {
    if (isActivating || isLiveTrading) return;

    try {
      setIsActivating(true);
      const response = await apiRequest('POST', '/api/live-trading/activate', {});
      const result = await response.json();

      if (result.status === 'success') {
        toast({
          title: '✅ Live Trading Activated',
          description: 'All agents are now trading with real funds on the blockchain.',
          variant: 'success',
        });
        setIsLiveTrading(true);
      } else {
        toast({
          title: '❌ Live Trading Activation Failed',
          description: result.error || 'An error occurred while activating live trading.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error activating live trading:', error);
      toast({
        title: '❌ Live Trading Activation Failed',
        description: 'An unexpected error occurred while activating live trading.',
        variant: 'destructive',
      });
    } finally {
      setIsActivating(false);
    }
  };

  return (
    <div className="p-6 rounded-lg bg-gray-800 border border-gray-700">
      <h3 className="text-xl font-semibold mb-4">Live Trading Controls</h3>
      <p className="mb-4 text-gray-300">
        Activate real-money trading on the Solana blockchain with all three AI agents:
        Hyperion (flash arbitrage), Quantum Omega (token sniping), and Singularity (cross-chain).
      </p>
      
      <div className="flex flex-col space-y-2">
        <button
          onClick={activateLiveTrading}
          disabled={isActivating || isLiveTrading}
          className={`px-4 py-3 rounded-md font-medium flex items-center justify-center ${
            isLiveTrading 
              ? 'bg-green-700 text-white' 
              : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white'
          } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isActivating ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Activating Live Trading...
            </>
          ) : isLiveTrading ? (
            <>
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
              Live Trading Active
            </>
          ) : (
            'Activate Live Trading'
          )}
        </button>
        
        {isLiveTrading && (
          <div className="mt-4 p-3 bg-green-900/30 border border-green-700 rounded-md">
            <p className="text-green-400 font-semibold">✓ System is actively trading with real funds</p>
            <p className="text-sm text-green-400/80 mt-1">
              All three AI agents are now executing trades on the blockchain with real funds.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}