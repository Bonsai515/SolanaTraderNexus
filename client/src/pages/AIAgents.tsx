import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AISystemPanel from '@/components/AISystemPanel';
import { useAIAgents } from '@/hooks/useAIAgents';

const AIAgents = () => {
  const { aiComponents, transformers } = useAIAgents();
  const [activeTab, setActiveTab] = useState('agents');

  return (
    <div>
      <h2 className="text-2xl font-semibold text-white mb-6">AI & Transformer System</h2>
      
      <Tabs defaultValue="agents" className="mb-8" onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-2 mb-6">
          <TabsTrigger value="agents">AI Agents</TabsTrigger>
          <TabsTrigger value="transformers">Transformers</TabsTrigger>
        </TabsList>
        
        <TabsContent value="agents" className="space-y-4">
          <Card className="bg-background-card border-gray-700">
            <CardContent className="pt-6">
              <h3 className="text-lg font-medium mb-4">AI Agent System Status</h3>
              <AISystemPanel components={aiComponents} />
            </CardContent>
          </Card>
          
          <Card className="bg-background-card border-gray-700">
            <CardContent className="pt-6">
              <h3 className="text-lg font-medium mb-4">Agent Configuration</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-background-elevated rounded-md">
                  <div className="flex items-center">
                    <span className="material-icons text-primary mr-2">settings</span>
                    <div>
                      <h4 className="font-medium">Scan Interval</h4>
                      <p className="text-xs text-gray-400">How often agents scan for opportunities</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button className="px-3 py-1 text-sm bg-background-card rounded-md">30s</button>
                    <button className="px-3 py-1 text-sm bg-primary text-white rounded-md">1m</button>
                    <button className="px-3 py-1 text-sm bg-background-card rounded-md">5m</button>
                  </div>
                </div>
                
                <div className="flex justify-between items-center p-3 bg-background-elevated rounded-md">
                  <div className="flex items-center">
                    <span className="material-icons text-warning mr-2">priority_high</span>
                    <div>
                      <h4 className="font-medium">Risk Level</h4>
                      <p className="text-xs text-gray-400">Trading aggressiveness of agents</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button className="px-3 py-1 text-sm bg-background-card rounded-md">Low</button>
                    <button className="px-3 py-1 text-sm bg-primary text-white rounded-md">Medium</button>
                    <button className="px-3 py-1 text-sm bg-background-card rounded-md">High</button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="transformers" className="space-y-4">
          <Card className="bg-background-card border-gray-700">
            <CardContent className="pt-6">
              <h3 className="text-lg font-medium mb-4">Transformer Components</h3>
              <AISystemPanel components={transformers} />
            </CardContent>
          </Card>
          
          <Card className="bg-background-card border-gray-700">
            <CardContent className="pt-6">
              <h3 className="text-lg font-medium mb-4">Transformer Settings</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-background-elevated rounded-md">
                  <div className="flex items-center">
                    <span className="material-icons text-info mr-2">sync</span>
                    <div>
                      <h4 className="font-medium">Data Refresh Rate</h4>
                      <p className="text-xs text-gray-400">How often market data is refreshed</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button className="px-3 py-1 text-sm bg-background-card rounded-md">5s</button>
                    <button className="px-3 py-1 text-sm bg-primary text-white rounded-md">10s</button>
                    <button className="px-3 py-1 text-sm bg-background-card rounded-md">30s</button>
                  </div>
                </div>
                
                <div className="flex justify-between items-center p-3 bg-background-elevated rounded-md">
                  <div className="flex items-center">
                    <span className="material-icons text-success mr-2">memory</span>
                    <div>
                      <h4 className="font-medium">Processing Mode</h4>
                      <p className="text-xs text-gray-400">Transformer data processing approach</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button className="px-3 py-1 text-sm bg-background-card rounded-md">Standard</button>
                    <button className="px-3 py-1 text-sm bg-primary text-white rounded-md">Quantum-inspired</button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AIAgents;
