import React, { useState, useEffect } from 'react';
import { neuralConnector } from '@/lib/neuralConnector';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Neural connection visualization
const NeuralConnectorPage: React.FC = () => {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [pair, setPair] = useState("BONK/USDC");
  const [profitEstimate, setProfitEstimate] = useState(0.0025);
  const [resultMessage, setResultMessage] = useState("");
  const [signalId, setSignalId] = useState("");
  const [signals, setSignals] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const data = await neuralConnector.getStatus();
      setStatus(data);
    } catch (error) {
      console.error("Error fetching neural status:", error);
    } finally {
      setLoading(false);
    }
  };

  const sendHyperionSignal = async () => {
    setSending(true);
    setResultMessage("");
    setSignalId("");
    
    try {
      const result = await neuralConnector.sendHyperionFlashSignal(
        pair,
        profitEstimate,
        {
          detectionTime: new Date().toISOString(),
          opportunity: "Flash arbitrage opportunity between pools",
          confidenceScore: 92.5 + (Math.random() * 7),
          urgency: "ultra-high",
          execution: {
            steps: [
              { step: "borrow", token: "USDC", amount: "1000" },
              { step: "swap", source: "Jupiter", from: "USDC", to: pair.split('/')[0], amount: "1000" },
              { step: "swap", source: "Raydium", from: pair.split('/')[0], to: "USDC", amount: "all" },
              { step: "repay", token: "USDC", amount: "1000" }
            ]
          }
        }
      );
      
      if (result.success) {
        setResultMessage("Neural signal sent successfully");
        setSignalId(result.signalId || "");
        addSignal({
          id: result.signalId,
          timestamp: new Date().toISOString(),
          type: "FLASH_ARBITRAGE",
          source: "micro_qhc",
          target: "hyperion-1",
          pair,
          profitEstimate,
          status: "sent"
        });
        
        toast({
          title: "Signal Sent",
          description: "Neural signal dispatched to Hyperion agent",
        });
      } else {
        setResultMessage(`Error: ${result.message}`);
        toast({
          title: "Signal Failed",
          description: result.message,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error sending Hyperion signal:", error);
      setResultMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
      toast({
        title: "Signal Error",
        description: "Failed to send neural signal",
        variant: "destructive"
      });
    } finally {
      setSending(false);
    }
  };

  const sendQuantumOmegaSignal = async () => {
    setSending(true);
    setResultMessage("");
    setSignalId("");
    
    try {
      const result = await neuralConnector.sendQuantumOmegaMemecoinSignal(
        pair,
        {
          detectionTime: new Date().toISOString(),
          opportunity: "Memecoin momentum surge detected",
          confidenceScore: 89.2 + (Math.random() * 10),
          urgency: "high",
          socialMetrics: {
            twitterMentions: 1230 + Math.floor(Math.random() * 500),
            redditSentiment: 0.78 + (Math.random() * 0.2),
            telegramActivity: "rising",
            whaleWallets: 3 + Math.floor(Math.random() * 3)
          },
          tokenMetrics: {
            volumeSpike: 340 + Math.floor(Math.random() * 200),
            liquidityGrowth: 25 + Math.floor(Math.random() * 15),
            marketCap: 15000000 + Math.floor(Math.random() * 5000000)
          }
        }
      );
      
      if (result.success) {
        setResultMessage("Neural signal sent successfully");
        setSignalId(result.signalId || "");
        addSignal({
          id: result.signalId,
          timestamp: new Date().toISOString(),
          type: "MEMECOIN_OPPORTUNITY",
          source: "meme_cortex",
          target: "quantum-omega-1",
          pair,
          status: "sent"
        });
        
        toast({
          title: "Signal Sent",
          description: "Neural signal dispatched to Quantum Omega agent",
        });
      } else {
        setResultMessage(`Error: ${result.message}`);
        toast({
          title: "Signal Failed",
          description: result.message,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error sending Quantum Omega signal:", error);
      setResultMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
      toast({
        title: "Signal Error",
        description: "Failed to send neural signal",
        variant: "destructive"
      });
    } finally {
      setSending(false);
    }
  };

  const addSignal = (signal: any) => {
    setSignals(prev => [signal, ...prev].slice(0, 10));
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-8 text-center bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
        Neural Connection System
      </h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Neural Status</CardTitle>
            <CardDescription>Real-time status of neural connections</CardDescription>
          </CardHeader>
          <CardContent>
            {status ? (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Connection Status:</span>
                  <Badge 
                    variant={status.status === 'connected' ? 'default' : 'destructive'}
                    className="capitalize"
                  >
                    {status.status}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Neural Paths:</span>
                  <span className="font-mono">{status.paths}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Connected Clients:</span>
                  <span className="font-mono">{status.clients}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Last Updated:</span>
                  <span className="text-xs">{new Date(status.timestamp).toLocaleTimeString()}</span>
                </div>
              </div>
            ) : (
              <div className="flex justify-center p-4">
                <div className="animate-spin h-6 w-6 border-2 border-blue-500 rounded-full border-t-transparent"></div>
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button 
              onClick={fetchStatus} 
              disabled={loading}
              size="sm"
              variant="outline"
              className="w-full"
            >
              {loading ? 'Refreshing...' : 'Refresh Status'}
            </Button>
          </CardFooter>
        </Card>
        
        <Card className="col-span-1 lg:col-span-2">
          <CardHeader>
            <CardTitle>Send Neural Signal</CardTitle>
            <CardDescription>Dispatch ultra-fast neural signals to agents</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="hyperion">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="hyperion">Hyperion (Flash Arb)</TabsTrigger>
                <TabsTrigger value="quantum">Quantum Omega (Meme)</TabsTrigger>
              </TabsList>
              
              <TabsContent value="hyperion" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="pair-input">Trading Pair</Label>
                  <Input
                    id="pair-input"
                    value={pair}
                    onChange={(e) => setPair(e.target.value)}
                    className="font-mono"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="profit-input">Profit Estimate (SOL)</Label>
                  <Input
                    id="profit-input"
                    type="number"
                    step="0.0001"
                    value={profitEstimate}
                    onChange={(e) => setProfitEstimate(parseFloat(e.target.value))}
                    className="font-mono"
                  />
                </div>
                
                <Button
                  onClick={sendHyperionSignal}
                  disabled={sending}
                  className="w-full bg-gradient-to-r from-blue-500 to-indigo-600"
                >
                  {sending ? 'Sending...' : 'Send to Hyperion Agent'}
                </Button>
              </TabsContent>
              
              <TabsContent value="quantum" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="pair-input-quantum">Memecoin Pair</Label>
                  <Input
                    id="pair-input-quantum"
                    value={pair}
                    onChange={(e) => setPair(e.target.value)}
                    className="font-mono"
                  />
                </div>
                
                <Button
                  onClick={sendQuantumOmegaSignal}
                  disabled={sending}
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-600"
                >
                  {sending ? 'Sending...' : 'Send to Quantum Omega Agent'}
                </Button>
              </TabsContent>
            </Tabs>
            
            {resultMessage && (
              <div className={`mt-4 p-3 rounded text-sm ${resultMessage.includes('Error') ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-600'}`}>
                {resultMessage}
                {signalId && (
                  <div className="text-xs text-gray-500 mt-1">Signal ID: {signalId}</div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Signal History */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Neural Signal History</CardTitle>
          <CardDescription>Ultra-fast signal transmissions between transformers and agents</CardDescription>
        </CardHeader>
        <CardContent>
          {signals.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              No signals sent yet. Use the controls above to send neural signals.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left border-b">
                    <th className="pb-2">Time</th>
                    <th className="pb-2">Type</th>
                    <th className="pb-2">Source → Target</th>
                    <th className="pb-2">Pair</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {signals.map((signal) => (
                    <tr key={signal.id} className="border-b">
                      <td className="py-2 text-xs">{new Date(signal.timestamp).toLocaleTimeString()}</td>
                      <td className="py-2">
                        <Badge 
                          variant={signal.type === 'FLASH_ARBITRAGE' ? 'default' : 'outline'}
                          className="text-xs"
                        >
                          {signal.type}
                        </Badge>
                      </td>
                      <td className="py-2 text-xs font-mono">{signal.source} → {signal.target}</td>
                      <td className="py-2 text-xs">{signal.pair}</td>
                      <td className="py-2">
                        <Badge 
                          variant={signal.status === 'sent' ? 'outline' : 'default'}
                          className="text-xs"
                        >
                          {signal.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default NeuralConnectorPage;