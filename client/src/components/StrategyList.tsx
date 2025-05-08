import React from 'react';

export interface Strategy {
  id: string;
  name: string;
  description: string;
  icon: string;
  iconColor: string;
  performance: {
    value: string;
    isPositive: boolean;
  };
  isActive: boolean;
}

interface StrategyListProps {
  strategies: Strategy[];
  isLoading?: boolean;
  onToggleStrategy: (id: string) => void;
  onDeployNew: () => void;
}

const StrategyList: React.FC<StrategyListProps> = ({
  strategies,
  isLoading = false,
  onToggleStrategy,
  onDeployNew
}) => {
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64 bg-background-card rounded-lg">
        <div className="text-gray-400">Loading strategies...</div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {strategies.map((strategy) => (
        <div key={strategy.id} className="p-3 rounded-md bg-background-elevated">
          <div className="flex justify-between items-start">
            <div className="flex items-start">
              <div className="mt-1">
                <span className={`material-icons text-${strategy.iconColor}`}>{strategy.icon}</span>
              </div>
              <div className="ml-3">
                <h4 className="font-medium">{strategy.name}</h4>
                <p className="text-xs text-gray-400 mt-1">{strategy.description}</p>
                <div className="flex items-center mt-2">
                  <span className={`text-xs ${
                    strategy.performance.isPositive 
                      ? 'bg-success bg-opacity-20 text-success' 
                      : 'bg-danger bg-opacity-20 text-danger'
                  } px-2 py-0.5 rounded-full`}>
                    {strategy.performance.value}
                  </span>
                </div>
              </div>
            </div>
            <div>
              <button
                className="bg-background-card p-1 rounded-md"
                onClick={() => onToggleStrategy(strategy.id)}
              >
                <span className={`material-icons ${strategy.isActive ? 'text-success' : 'text-danger'}`}>
                  {strategy.isActive ? 'play_arrow' : 'stop'}
                </span>
              </button>
            </div>
          </div>
        </div>
      ))}
      
      <button 
        className="w-full py-2 mt-2 text-sm text-primary border border-primary border-dashed rounded-md hover:bg-primary hover:bg-opacity-10"
        onClick={onDeployNew}
      >
        <div className="flex items-center justify-center">
          <span className="material-icons mr-1">add</span>
          <span>Deploy New Strategy</span>
        </div>
      </button>
    </div>
  );
};

export default StrategyList;
