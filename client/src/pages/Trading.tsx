import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TransactionTable from '@/components/TransactionTable';
import { useTransactionEngine } from '@/hooks/useTransactionEngine';

const Trading = () => {
  const { transactions, totalTransactionCount } = useTransactionEngine();
  const [activeTab, setActiveTab] = useState('transactions');

  return (
    <div>
      <h2 className="text-2xl font-semibold text-white mb-6">Trading Platform</h2>
      
      <Tabs defaultValue="transactions" className="mb-8" onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3 mb-6">
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="markets">Markets</TabsTrigger>
          <TabsTrigger value="orderbook">Order Book</TabsTrigger>
        </TabsList>
        
        <TabsContent value="transactions" className="space-y-4">
          <Card className="bg-background-card border-gray-700">
            <CardContent className="pt-6">
              <h3 className="text-lg font-medium mb-4">Transaction History</h3>
              <TransactionTable 
                transactions={transactions} 
                totalCount={totalTransactionCount}
                onViewAllClick={() => {}} 
              />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="markets" className="space-y-4">
          <Card className="bg-background-card border-gray-700">
            <CardContent className="pt-6">
              <h3 className="text-lg font-medium mb-4">Market Overview</h3>
              <p className="text-gray-400">Market data will be displayed here.</p>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="orderbook" className="space-y-4">
          <Card className="bg-background-card border-gray-700">
            <CardContent className="pt-6">
              <h3 className="text-lg font-medium mb-4">Order Book</h3>
              <p className="text-gray-400">Order book will be displayed here.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Trading;
