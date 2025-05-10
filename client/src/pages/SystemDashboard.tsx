import { useEffect, useState } from 'react';
import { ComponentHealth, SystemHealthMetrics, getDashboardData, getComponentHealth, getSystemHealth, getSignalVolume } from '../lib/signalMonitoringClient';
import { signalMonitoringWS } from '../lib/signalMonitoringWebSocket';

// SystemDashboard component for monitoring system performance
export default function SystemDashboard() {
  const [systemHealth, setSystemHealth] = useState<SystemHealthMetrics | null>(null);
  const [components, setComponents] = useState<ComponentHealth[]>([]);
  const [signalVolume, setSignalVolume] = useState<{ timestamp: string; count: number }[]>([]);
  const [timeframe, setTimeframe] = useState<'1h' | '24h' | '7d'>('1h');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Initial data load
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [healthData, componentData, volumeData] = await Promise.all([
          getSystemHealth(),
          getComponentHealth(),
          getSignalVolume(timeframe)
        ]);
        
        setSystemHealth(healthData);
        setComponents(componentData);
        setSignalVolume(volumeData);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();

    // Subscribe to real-time updates
    const systemHealthSub = signalMonitoringWS.subscribeToSystemHealth(
      (health) => setSystemHealth(health)
    );
    
    const componentHealthSub = signalMonitoringWS.subscribeToComponentHealth(
      (componentData) => setComponents(componentData)
    );

    // Refresh signal volume data when timeframe changes
    const volumeInterval = setInterval(() => {
      getSignalVolume(timeframe).then(data => setSignalVolume(data));
    }, 30000); // Refresh every 30 seconds

    // Cleanup subscriptions on unmount
    return () => {
      systemHealthSub.unsubscribe();
      componentHealthSub.unsubscribe();
      clearInterval(volumeInterval);
    };
  }, [timeframe]);

  // Helper to format timestamps
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  // Helper to determine status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'optimal':
      case 'healthy':
        return 'bg-green-500';
      case 'warning':
      case 'degraded':
        return 'bg-yellow-500';
      case 'critical':
      case 'error':
        return 'bg-red-500';
      case 'inactive':
        return 'bg-gray-500';
      default:
        return 'bg-blue-500';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h2 className="text-3xl font-bold">System Performance Dashboard</h2>
      <p className="text-lg text-gray-300">
        Real-time monitoring of system components, health metrics, and signal flow.
      </p>

      {/* System Status Overview */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="p-6 rounded-lg bg-gray-800 border border-gray-700">
          <h3 className="text-xl font-semibold mb-2">System Status</h3>
          {systemHealth && (
            <div className="flex items-center space-x-2">
              <span className={`w-3 h-3 rounded-full ${getStatusColor(systemHealth.status)}`}></span>
              <span className="capitalize">{systemHealth.status}</span>
            </div>
          )}
          <p className="mt-2 text-gray-400">Last updated: {systemHealth?.lastUpdated ? formatTime(systemHealth.lastUpdated) : 'N/A'}</p>
        </div>

        <div className="p-6 rounded-lg bg-gray-800 border border-gray-700">
          <h3 className="text-xl font-semibold mb-2">Signal Flow</h3>
          {systemHealth && (
            <div className="flex items-center space-x-2">
              <span className={`w-3 h-3 rounded-full ${systemHealth.signalFlow === 'active' ? 'bg-green-500' : 'bg-red-500'}`}></span>
              <span className="capitalize">{systemHealth.signalFlow}</span>
            </div>
          )}
          <p className="mt-2 text-gray-400">Validation rate: {systemHealth?.validationRate ? `${(systemHealth.validationRate * 100).toFixed(1)}%` : 'N/A'}</p>
        </div>

        <div className="p-6 rounded-lg bg-gray-800 border border-gray-700">
          <h3 className="text-xl font-semibold mb-2">Component Health</h3>
          {systemHealth && (
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                <span>Healthy: {systemHealth.componentHealth.healthy}</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                <span>Degraded: {systemHealth.componentHealth.degraded}</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                <span>Error: {systemHealth.componentHealth.error}</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-gray-500"></span>
                <span>Inactive: {systemHealth.componentHealth.inactive}</span>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 rounded-lg bg-gray-800 border border-gray-700">
          <h3 className="text-xl font-semibold mb-2">System Performance</h3>
          {systemHealth && systemHealth.performance && (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span>CPU Usage:</span>
                <div className="w-24 bg-gray-700 rounded-full h-2.5">
                  <div 
                    className="bg-blue-600 h-2.5 rounded-full" 
                    style={{ width: `${systemHealth.performance.cpuUsage}%` }}>
                  </div>
                </div>
                <span className="text-sm">{systemHealth.performance.cpuUsage}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Memory:</span>
                <div className="w-24 bg-gray-700 rounded-full h-2.5">
                  <div 
                    className="bg-purple-600 h-2.5 rounded-full" 
                    style={{ width: `${systemHealth.performance.memoryUsage}%` }}>
                  </div>
                </div>
                <span className="text-sm">{systemHealth.performance.memoryUsage}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Disk:</span>
                <div className="w-24 bg-gray-700 rounded-full h-2.5">
                  <div 
                    className="bg-green-600 h-2.5 rounded-full" 
                    style={{ width: `${systemHealth.performance.diskUsage}%` }}>
                  </div>
                </div>
                <span className="text-sm">{systemHealth.performance.diskUsage}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Network:</span>
                <span className="text-sm">{systemHealth.performance.networkLatency}ms</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Signal Volume Chart */}
      <div className="p-6 rounded-lg bg-gray-800 border border-gray-700">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold">Signal Volume</h3>
          <div className="flex space-x-2">
            <button 
              className={`px-3 py-1 rounded ${timeframe === '1h' ? 'bg-blue-600' : 'bg-gray-700'}`}
              onClick={() => setTimeframe('1h')}
            >
              1h
            </button>
            <button 
              className={`px-3 py-1 rounded ${timeframe === '24h' ? 'bg-blue-600' : 'bg-gray-700'}`}
              onClick={() => setTimeframe('24h')}
            >
              24h
            </button>
            <button 
              className={`px-3 py-1 rounded ${timeframe === '7d' ? 'bg-blue-600' : 'bg-gray-700'}`}
              onClick={() => setTimeframe('7d')}
            >
              7d
            </button>
          </div>
        </div>
        
        <div className="h-64 relative">
          {signalVolume.length > 0 ? (
            <div className="relative h-full">
              <div className="absolute inset-0 flex items-end">
                {signalVolume.map((dataPoint, i) => {
                  const maxCount = Math.max(...signalVolume.map(d => d.count));
                  const height = maxCount > 0 ? (dataPoint.count / maxCount) * 100 : 0;
                  
                  return (
                    <div 
                      key={i}
                      className="flex-1 flex flex-col items-center justify-end group"
                    >
                      <div 
                        className="w-3/4 bg-blue-500 rounded-t"
                        style={{ height: `${height}%` }}
                      ></div>
                      <div className="mt-2 text-xs opacity-50 group-hover:opacity-100">
                        {new Date(dataPoint.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <p className="text-gray-500">No signal volume data available</p>
            </div>
          )}
        </div>
      </div>

      {/* Component Status Table */}
      <div className="p-6 rounded-lg bg-gray-800 border border-gray-700">
        <h3 className="text-xl font-semibold mb-4">Component Status</h3>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-3 px-4">Component</th>
                <th className="text-left py-3 px-4">Status</th>
                <th className="text-left py-3 px-4">Last Active</th>
                <th className="text-left py-3 px-4">Avg. Time (ms)</th>
                <th className="text-left py-3 px-4">Error Rate</th>
                <th className="text-left py-3 px-4">Processed</th>
              </tr>
            </thead>
            <tbody>
              {components.length > 0 ? (
                components.map((component, index) => (
                  <tr key={index} className="border-b border-gray-700">
                    <td className="py-3 px-4">{component.name}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center">
                        <span className={`w-2 h-2 rounded-full mr-2 ${getStatusColor(component.status)}`}></span>
                        <span className="capitalize">{component.status}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">{formatTime(component.lastActive)}</td>
                    <td className="py-3 px-4">{component.averageProcessingTimeMs.toFixed(2)}</td>
                    <td className="py-3 px-4">{(component.errorRate * 100).toFixed(1)}%</td>
                    <td className="py-3 px-4">{component.processedCount}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-gray-500">
                    No component data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Alerts Section */}
      {systemHealth && systemHealth.alertDetails && systemHealth.alertDetails.length > 0 && (
        <div className="p-6 rounded-lg bg-gray-800 border border-gray-700">
          <h3 className="text-xl font-semibold mb-4">System Alerts</h3>
          
          <div className="space-y-3">
            {systemHealth.alertDetails.map((alert, index) => (
              <div 
                key={index} 
                className={`p-4 rounded-lg border ${
                  alert.severity === 'high' ? 'border-red-700 bg-red-900/30' : 
                  alert.severity === 'medium' ? 'border-yellow-700 bg-yellow-900/30' : 
                  'border-blue-700 bg-blue-900/30'
                }`}
              >
                <div className="flex justify-between">
                  <div className="font-medium">
                    <span className={`
                      inline-block w-2 h-2 rounded-full mr-2 
                      ${alert.severity === 'high' ? 'bg-red-500' : 
                        alert.severity === 'medium' ? 'bg-yellow-500' : 
                        'bg-blue-500'
                      }
                    `}></span>
                    {alert.component}
                  </div>
                  <span className="text-sm opacity-70">{formatTime(alert.timestamp)}</span>
                </div>
                <p className="mt-1 ml-4">{alert.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}