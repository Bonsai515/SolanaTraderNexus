import React from 'react';

interface AllocationItem {
  name: string;
  percentage: number;
  color: string;
}

interface WalletManagerProps {
  walletAddress: string;
  balance: string;
  onDeposit: () => void;
  onWithdraw: () => void;
  onTransfer: () => void;
  allocations: AllocationItem[];
}

const WalletManager: React.FC<WalletManagerProps> = ({
  walletAddress,
  balance,
  onDeposit,
  onWithdraw,
  onTransfer,
  allocations
}) => {
  // Display a shortened version of the wallet address
  const shortenedAddress = walletAddress.length > 12
    ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`
    : walletAddress;

  return (
    <div className="p-4">
      <div className="mb-4 p-3 rounded-md bg-background-elevated">
        <div className="flex justify-between items-center">
          <div>
            <div className="flex items-center">
              <span className="material-icons text-primary mr-2">account_balance_wallet</span>
              <h4 className="font-medium">Main Trading Wallet</h4>
            </div>
            <p className="text-sm text-gray-400 mt-1">{shortenedAddress}</p>
          </div>
          <div className="text-xl font-semibold text-white">
            {balance}
          </div>
        </div>
      </div>
      
      <div className="mb-4">
        <h5 className="text-sm font-medium mb-2">Wallet Actions</h5>
        <div className="grid grid-cols-3 gap-2">
          <button 
            className="flex flex-col items-center justify-center p-2 bg-background-elevated rounded-md hover:bg-gray-700"
            onClick={onDeposit}
          >
            <span className="material-icons text-primary mb-1">add_circle</span>
            <span className="text-xs">Deposit</span>
          </button>
          <button 
            className="flex flex-col items-center justify-center p-2 bg-background-elevated rounded-md hover:bg-gray-700"
            onClick={onWithdraw}
          >
            <span className="material-icons text-primary mb-1">arrow_circle_up</span>
            <span className="text-xs">Withdraw</span>
          </button>
          <button 
            className="flex flex-col items-center justify-center p-2 bg-background-elevated rounded-md hover:bg-gray-700"
            onClick={onTransfer}
          >
            <span className="material-icons text-primary mb-1">swap_horiz</span>
            <span className="text-xs">Transfer</span>
          </button>
        </div>
      </div>
      
      <div>
        <h5 className="text-sm font-medium mb-2">Trading Allocations</h5>
        <div className="space-y-2">
          {allocations.map((allocation, index) => (
            <div key={index}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs">{allocation.name}</span>
                <span className="text-xs">{allocation.percentage}%</span>
              </div>
              <div className="h-2 bg-background-elevated rounded-full">
                <div 
                  className={`h-2 bg-${allocation.color} rounded-full`} 
                  style={{ width: `${allocation.percentage}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WalletManager;
