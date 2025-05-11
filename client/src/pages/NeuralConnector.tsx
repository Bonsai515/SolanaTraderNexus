import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { neuralConnectorClient, type NeuralPath, type NeuralStatus, type TestResult } from '../lib/neuralConnector';

export default function NeuralConnector() {
  const [activeTab, setActiveTab] = useState('status');
  const [testSource, setTestSource] = useState('microqhc');
  const [testTarget, setTestTarget] = useState('hyperion');
  const [testIterations, setTestIterations] = useState(10);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunningTest, setIsRunningTest] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch neural connector status
  const { 
    data: status,
    isLoading: isStatusLoading,
    error: statusError,
    refetch: refetchStatus
  } = useQuery({
    queryKey: ['/api/neural/status'],
    queryFn: () => neuralConnectorClient.getStatus(),
    refetchInterval: 5000, // Refresh every 5 seconds
    retry: 3,
    retryDelay: 1000,
    onError: (error) => {
      console.error('Error fetching neural connector status:', error);
    }
  });

  // Run latency test
  const runLatencyTest = async () => {
    try {
      setIsRunningTest(true);
      setErrorMessage(null);
      const results = await neuralConnectorClient.testLatency(testSource, testTarget, testIterations);
      setTestResults(results);
    } catch (error) {
      console.error('Error running latency test:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to run latency test');
    } finally {
      setIsRunningTest(false);
    }
  };

  // Format latency for display
  const formatLatency = (latencyMs: number): string => {
    if (latencyMs < 1) {
      return `${(latencyMs * 1000).toFixed(2)} μs`;
    } else {
      return `${latencyMs.toFixed(2)} ms`;
    }
  };

  // Get status badge color
  const getStatusColor = (status: string): string => {
    switch(status) {
      case 'active': return 'bg-green-500';
      case 'inactive': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  // Get priority badge color
  const getPriorityColor = (priority: string): string => {
    switch(priority) {
      case 'high': return 'bg-red-500';
      case 'normal': return 'bg-blue-500';
      case 'low': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6 bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
        Neural Connector Dashboard
      </h1>
      
      <div className="mb-4">
        <p className="text-gray-300 mb-4">
          The Neural Connector provides ultra-low latency communication between transformers and AI agents,
          allowing for faster signal processing and decision making. Monitor and test neural pathways here.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full grid grid-cols-3 mb-6">
          <TabsTrigger value="status">Status & Metrics</TabsTrigger>
          <TabsTrigger value="paths">Neural Paths</TabsTrigger>
          <TabsTrigger value="testing">Latency Testing</TabsTrigger>
        </TabsList>
        
        {/* Status & Metrics Tab */}
        <TabsContent value="status" className="space-y-4">
          {isStatusLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
            </div>
          ) : statusError ? (
            <div className="bg-red-900/30 border border-red-700 rounded-md p-4 text-red-400">
              Error loading neural connector status: {statusError instanceof Error ? statusError.message : 'Unknown error'}
            </div>
          ) : status ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <h2 className="text-xl font-bold mb-4">System Status</h2>
                <div className="flex items-center mb-4">
                  <div className={`w-3 h-3 rounded-full mr-2 ${status.active ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span>{status.active ? 'Active' : 'Inactive'}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-gray-700/50 p-3 rounded">
                    <p className="text-sm text-gray-400">Uptime</p>
                    <p className="text-xl font-mono">{Math.floor(status.uptime / 60)} min {Math.floor(status.uptime % 60)} sec</p>
                  </div>
                  <div className="bg-gray-700/50 p-3 rounded">
                    <p className="text-sm text-gray-400">Active Paths</p>
                    <p className="text-xl font-mono">{status.paths.filter(p => p.status === 'active').length}</p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <h2 className="text-xl font-bold mb-4">Performance Metrics</h2>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-gray-700/50 p-3 rounded">
                    <p className="text-sm text-gray-400">Avg Latency</p>
                    <p className="text-xl font-mono">{formatLatency(status.metricsMs.avgLatency)}</p>
                  </div>
                  <div className="bg-gray-700/50 p-3 rounded">
                    <p className="text-sm text-gray-400">Min Latency</p>
                    <p className="text-xl font-mono">{formatLatency(status.metricsMs.minLatency)}</p>
                  </div>
                  <div className="bg-gray-700/50 p-3 rounded">
                    <p className="text-sm text-gray-400">Max Latency</p>
                    <p className="text-xl font-mono">{formatLatency(status.metricsMs.maxLatency)}</p>
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-sm text-gray-400">Last Activity</p>
                  <p className="font-mono">{new Date(status.lastActivityTimestamp).toLocaleString()}</p>
                </div>
              </div>
            </div>
          ) : null}
          
          <div className="mt-4 flex justify-end">
            <button 
              onClick={() => refetchStatus()} 
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md flex items-center"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </TabsContent>
        
        {/* Neural Paths Tab */}
        <TabsContent value="paths" className="space-y-4">
          {isStatusLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
            </div>
          ) : statusError ? (
            <div className="bg-red-900/30 border border-red-700 rounded-md p-4 text-red-400">
              Error loading neural paths: {statusError instanceof Error ? statusError.message : 'Unknown error'}
            </div>
          ) : status ? (
            <div className="overflow-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-800">
                    <th className="p-3 text-left border-b border-gray-700">Source</th>
                    <th className="p-3 text-left border-b border-gray-700">Target</th>
                    <th className="p-3 text-left border-b border-gray-700">Latency</th>
                    <th className="p-3 text-left border-b border-gray-700">Status</th>
                    <th className="p-3 text-left border-b border-gray-700">Priority</th>
                  </tr>
                </thead>
                <tbody>
                  {status.paths.map((path, index) => (
                    <tr key={index} className="hover:bg-gray-800">
                      <td className="p-3 border-b border-gray-700">{path.source}</td>
                      <td className="p-3 border-b border-gray-700">{path.target}</td>
                      <td className="p-3 border-b border-gray-700">{formatLatency(path.latencyMs)}</td>
                      <td className="p-3 border-b border-gray-700">
                        <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(path.status)}`}>
                          {path.status}
                        </span>
                      </td>
                      <td className="p-3 border-b border-gray-700">
                        <span className={`px-2 py-1 rounded-full text-xs ${getPriorityColor(path.priority)}`}>
                          {path.priority}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </TabsContent>
        
        {/* Latency Testing Tab */}
        <TabsContent value="testing" className="space-y-4">
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h2 className="text-xl font-bold mb-4">Neural Path Latency Test</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <Label htmlFor="source">Source (Transformer)</Label>
                <Input 
                  id="source"
                  value={testSource}
                  onChange={(e) => setTestSource(e.target.value)}
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="target">Target (Agent)</Label>
                <Input 
                  id="target"
                  value={testTarget}
                  onChange={(e) => setTestTarget(e.target.value)}
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="iterations">Iterations</Label>
                <Input 
                  id="iterations"
                  type="number"
                  min={1}
                  max={100}
                  value={testIterations}
                  onChange={(e) => setTestIterations(parseInt(e.target.value) || 10)}
                  className="mt-1"
                />
              </div>
            </div>
            
            <button 
              onClick={runLatencyTest} 
              disabled={isRunningTest}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRunningTest ? (
                <>
                  <div className="animate-spin h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full"></div>
                  Running Test...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Run Latency Test
                </>
              )}
            </button>
            
            {errorMessage && (
              <div className="mt-4 bg-red-900/30 border border-red-700 rounded-md p-4 text-red-400">
                {errorMessage}
              </div>
            )}
          </div>
          
          {testResults.length > 0 && (
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h2 className="text-xl font-bold mb-4">Test Results</h2>
              
              <div className="mb-4">
                <div className="flex justify-between mb-2">
                  <span>Path:</span>
                  <span className="font-mono">{testResults[0].path.source} → {testResults[0].path.target}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span>Average Latency:</span>
                  <span className="font-mono">
                    {formatLatency(testResults.reduce((sum, result) => sum + result.latencyMs, 0) / testResults.length)}
                  </span>
                </div>
                <div className="flex justify-between mb-2">
                  <span>Min Latency:</span>
                  <span className="font-mono">{formatLatency(Math.min(...testResults.map(r => r.latencyMs)))}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span>Max Latency:</span>
                  <span className="font-mono">{formatLatency(Math.max(...testResults.map(r => r.latencyMs)))}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span>Success Rate:</span>
                  <span className="font-mono">
                    {(testResults.filter(r => r.success).length / testResults.length * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
              
              <div className="overflow-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-700">
                      <th className="p-2 text-left border-b border-gray-600">#</th>
                      <th className="p-2 text-left border-b border-gray-600">Latency</th>
                      <th className="p-2 text-left border-b border-gray-600">Status</th>
                      <th className="p-2 text-left border-b border-gray-600">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {testResults.map((result, index) => (
                      <tr key={index} className="hover:bg-gray-700">
                        <td className="p-2 border-b border-gray-600">{index + 1}</td>
                        <td className="p-2 border-b border-gray-600">{formatLatency(result.latencyMs)}</td>
                        <td className="p-2 border-b border-gray-600">
                          <span className={`px-2 py-1 rounded-full text-xs ${result.success ? 'bg-green-500' : 'bg-red-500'}`}>
                            {result.success ? 'Success' : 'Failed'}
                          </span>
                        </td>
                        <td className="p-2 border-b border-gray-600 font-mono text-sm">{new Date(result.timestamp).toLocaleTimeString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}