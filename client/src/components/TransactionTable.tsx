import React from 'react';

export interface Transaction {
  id: string;
  strategy: {
    name: string;
    icon: string;
    color: string;
  };
  type: 'BUY' | 'SELL';
  amount: string;
  status: 'Completed' | 'Processing' | 'Failed';
  profit: string | null;
  timestamp: string;
}

interface TransactionTableProps {
  transactions: Transaction[];
  isLoading?: boolean;
  onViewAllClick: () => void;
  totalCount: number;
}

const TransactionTable: React.FC<TransactionTableProps> = ({
  transactions,
  isLoading = false,
  onViewAllClick,
  totalCount
}) => {
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64 bg-background-card rounded-lg">
        <div className="text-gray-400">Loading transactions...</div>
      </div>
    );
  }

  if (!transactions.length) {
    return (
      <div className="flex justify-center items-center h-64 bg-background-card rounded-lg">
        <div className="text-gray-400">No transactions found</div>
      </div>
    );
  }

  return (
    <div className="bg-background-card rounded-lg shadow-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-700">
          <thead className="bg-background-elevated">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Strategy</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Type</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Amount</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Profit</th>
            </tr>
          </thead>
          <tbody className="bg-background-card divide-y divide-gray-700">
            {transactions.map((transaction) => (
              <tr key={transaction.id}>
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                  <div className="flex items-center">
                    <span className={`material-icons text-xs mr-1 text-${transaction.strategy.color}`}>smart_toy</span>
                    {transaction.strategy.name}
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm">
                  <span className={`px-2 py-1 text-xs rounded-md ${transaction.type === 'BUY' ? 'bg-success bg-opacity-20 text-success' : 'bg-danger bg-opacity-20 text-danger'}`}>
                    {transaction.type}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm">{transaction.amount}</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm">
                  <span className={`${
                    transaction.status === 'Completed' ? 'text-success' : 
                    transaction.status === 'Processing' ? 'text-warning' : 'text-danger'
                  }`}>
                    {transaction.status}
                  </span>
                </td>
                <td className={`px-4 py-3 whitespace-nowrap text-sm ${
                  transaction.profit === null ? 'text-gray-400' :
                  transaction.profit.startsWith('+') ? 'text-success' : 'text-danger'
                }`}>
                  {transaction.profit || '--'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="bg-background-elevated px-4 py-3 flex items-center justify-between">
        <div className="text-sm text-gray-400">
          Showing <span className="font-medium">{transactions.length}</span> of <span className="font-medium">{totalCount}</span> transactions
        </div>
        <div className="flex-1 flex justify-end">
          <button 
            className="px-4 py-2 text-sm text-primary hover:text-white hover:bg-primary hover:bg-opacity-20 rounded-md"
            onClick={onViewAllClick}
          >
            View All Transactions
          </button>
        </div>
      </div>
    </div>
  );
};

export default TransactionTable;
