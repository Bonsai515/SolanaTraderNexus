import { Card, CardContent } from '@/components/ui/card';
import StrategyList from '@/components/StrategyList';
import { useAIAgents } from '@/hooks/useAIAgents';

const Strategies = () => {
  const { strategies, toggleStrategy, deployNewStrategy } = useAIAgents();

  return (
    <div>
      <h2 className="text-2xl font-semibold text-white mb-6">Trading Strategies</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="bg-background-card border-gray-700 md:col-span-2">
          <CardContent className="pt-6">
            <h3 className="text-lg font-medium mb-4">Active Strategies</h3>
            <StrategyList
              strategies={strategies.filter(s => s.isActive)}
              onToggleStrategy={toggleStrategy}
              onDeployNew={deployNewStrategy}
            />
          </CardContent>
        </Card>
        
        <Card className="bg-background-card border-gray-700">
          <CardContent className="pt-6">
            <h3 className="text-lg font-medium mb-4">Strategy Analytics</h3>
            <div className="space-y-4">
              <div className="p-3 bg-background-elevated rounded-md">
                <h4 className="font-medium text-sm">Best Performing</h4>
                <div className="flex items-center mt-2">
                  <span className="material-icons text-success mr-2">trending_up</span>
                  <div>
                    <p className="font-medium">Alpha-7 Arbitrage</p>
                    <p className="text-xs text-success">+3.2% 24h return</p>
                  </div>
                </div>
              </div>
              
              <div className="p-3 bg-background-elevated rounded-md">
                <h4 className="font-medium text-sm">Worst Performing</h4>
                <div className="flex items-center mt-2">
                  <span className="material-icons text-danger mr-2">trending_down</span>
                  <div>
                    <p className="font-medium">Gamma-1 Momentum</p>
                    <p className="text-xs text-danger">-0.8% 24h return</p>
                  </div>
                </div>
              </div>
              
              <div className="p-3 bg-background-elevated rounded-md">
                <h4 className="font-medium text-sm">Strategy Success Rate</h4>
                <div className="mt-2">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs">Overall</span>
                    <span className="text-xs text-success">76%</span>
                  </div>
                  <div className="h-2 bg-background-card rounded-full">
                    <div className="h-2 bg-success rounded-full" style={{ width: '76%' }}></div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <Card className="bg-background-card border-gray-700 mb-8">
        <CardContent className="pt-6">
          <h3 className="text-lg font-medium mb-4">Inactive Strategies</h3>
          <StrategyList
            strategies={strategies.filter(s => !s.isActive)}
            onToggleStrategy={toggleStrategy}
            onDeployNew={deployNewStrategy}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default Strategies;
