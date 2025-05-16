import { SignalHub } from './signalHub';
import { NexusEngine } from './nexus-transaction-engine';

declare global {
  var signalHub: SignalHub;
  var nexusEngine: NexusEngine;
  
  // Market analysis
  var marketAnalysisIntervals: Record<string, NodeJS.Timeout>;
  var marketAnalysisSignalGenerator: any;
  
  // Agent information
  var activeAgents: Record<string, boolean>;
  var agentStatistics: Record<string, {
    executionCount: number;
    successRate: number;
    totalProfit: number;
    lastExecutionTime?: Date;
  }>;
  
  // Trading system state
  var isUsingRealFunds: boolean;
  var systemStatus: 'INITIALIZING' | 'ACTIVE' | 'PAUSED' | 'ERROR';
  var transactionCount: number;
}