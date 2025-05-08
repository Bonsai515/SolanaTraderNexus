import { Card, CardContent } from '@/components/ui/card';
import WalletManager from '@/components/WalletManager';
import { useSolanaWallet } from '@/hooks/useSolanaWallet';
import { useTransactionEngine } from '@/hooks/useTransactionEngine';
import TransactionTable from '@/components/TransactionTable';

const Wallet = () => {
  const { 
    walletBalance, 
    walletAddress, 
    handleDeposit, 
    handleWithdraw, 
    handleTransfer,
    allocations 
  } = useSolanaWallet();
  
  const { walletTransactions, totalWalletTransactionCount } = useTransactionEngine();

  return (
    <div>
      <h2 className="text-2xl font-semibold text-white mb-6">Wallet Management</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="bg-background-card border-gray-700 md:col-span-2">
          <CardContent className="pt-6">
            <h3 className="text-lg font-medium mb-4">Wallet Details</h3>
            <WalletManager
              walletAddress={walletAddress}
              balance={walletBalance}
              onDeposit={handleDeposit}
              onWithdraw={handleWithdraw}
              onTransfer={handleTransfer}
              allocations={allocations}
            />
          </CardContent>
        </Card>
        
        <Card className="bg-background-card border-gray-700">
          <CardContent className="pt-6">
            <h3 className="text-lg font-medium mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <button className="w-full p-3 bg-primary text-white rounded-md flex items-center justify-center">
                <span className="material-icons mr-2">account_balance_wallet</span>
                Connect New Wallet
              </button>
              <button className="w-full p-3 bg-background-elevated text-white rounded-md flex items-center justify-center">
                <span className="material-icons mr-2">refresh</span>
                Refresh Balance
              </button>
              <button className="w-full p-3 bg-background-elevated text-white rounded-md flex items-center justify-center">
                <span className="material-icons mr-2">security</span>
                Security Settings
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <Card className="bg-background-card border-gray-700 mb-8">
        <CardContent className="pt-6">
          <h3 className="text-lg font-medium mb-4">Wallet Transactions</h3>
          <TransactionTable 
            transactions={walletTransactions.slice(0, 5)} 
            totalCount={totalWalletTransactionCount}
            onViewAllClick={() => {}} 
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default Wallet;
