import { Router } from 'express';
import { storage } from '../storage';
import { MarketDataTransformer } from '../transformers/marketDataTransformer';
import { TradingSignalTransformer } from '../transformers/tradingSignalTransformer';

/**
 * Trading Agent class that uses transformers to identify trading opportunities
 */
class TradingAgent {
  private marketDataTransformer: MarketDataTransformer;
  private tradingSignalTransformer: TradingSignalTransformer;
  private isRunning: boolean = false;
  private scanInterval: NodeJS.Timeout | null = null;
  private scanIntervalTime: number = 60000; // 1 minute default
  private riskLevel: 'low' | 'medium' | 'high' = 'medium';

  constructor() {
    this.marketDataTransformer = new MarketDataTransformer();
    this.tradingSignalTransformer = new TradingSignalTransformer();
  }

  /**
   * Start the trading agent scanning process
   */
  public start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.scanInterval = setInterval(() => this.scanForOpportunities(), this.scanIntervalTime);
    console.log(`Trading Agent started with ${this.scanIntervalTime}ms scan interval and ${this.riskLevel} risk level`);
  }

  /**
   * Stop the trading agent
   */
  public stop(): void {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    console.log('Trading Agent stopped');
  }

  /**
   * Change the scan interval time
   */
  public setScanInterval(milliseconds: number): void {
    this.scanIntervalTime = milliseconds;
    
    // Restart the interval if running
    if (this.isRunning) {
      if (this.scanInterval) {
        clearInterval(this.scanInterval);
      }
      this.scanInterval = setInterval(() => this.scanForOpportunities(), this.scanIntervalTime);
    }
    
    console.log(`Scan interval updated to ${milliseconds}ms`);
  }

  /**
   * Set the risk level for trading decisions
   */
  public setRiskLevel(level: 'low' | 'medium' | 'high'): void {
    this.riskLevel = level;
    console.log(`Risk level set to ${level}`);
  }

  /**
   * Get current agent status
   */
  public getStatus(): { running: boolean; scanInterval: number; riskLevel: string } {
    return {
      running: this.isRunning,
      scanInterval: this.scanIntervalTime,
      riskLevel: this.riskLevel
    };
  }

  /**
   * Core function to scan for trading opportunities
   * This uses the transformers to process market data and generate signals
   */
  private async scanForOpportunities(): Promise<void> {
    try {
      // 1. Get market data through the market data transformer
      const marketData = await this.marketDataTransformer.fetchAndTransform();
      
      // 2. Process market data through the signal transformer with current risk level
      const signals = this.tradingSignalTransformer.generateSignals(marketData, this.riskLevel);
      
      // 3. For each valid signal, create a potential trade
      for (const signal of signals) {
        if (signal.confidence >= this.getConfidenceThreshold()) {
          console.log(`Trading opportunity found: ${signal.type} ${signal.asset} with confidence ${signal.confidence}`);
          
          // Get active strategies that match this signal type
          const activeStrategies = await storage.getActiveStrategies();
          const matchingStrategies = activeStrategies.filter(strategy => {
            return (
              (signal.type === 'BUY' && strategy.type === 'ARBITRAGE') ||
              (signal.type === 'SELL' && strategy.type === 'MOMENTUM') ||
              (strategy.type === 'LIQUIDITY')
            );
          });
          
          // If we have matching strategies, execute the trade through the first one
          if (matchingStrategies.length > 0) {
            // In a real app, this would call the transaction engine to execute the trade
            console.log(`Signal matched with strategy ${matchingStrategies[0].name}`);
          }
        }
      }
    } catch (error) {
      console.error('Error scanning for opportunities:', error);
    }
  }

  /**
   * Get confidence threshold based on risk level
   */
  private getConfidenceThreshold(): number {
    switch (this.riskLevel) {
      case 'low': return 0.8;
      case 'medium': return 0.6;
      case 'high': return 0.4;
      default: return 0.6;
    }
  }
}

// Create a singleton instance of the trading agent
const tradingAgent = new TradingAgent();
tradingAgent.start(); // Auto-start the agent

/**
 * Sets up routes for controlling the trading agent
 */
export function setupTradingAgentRoutes() {
  const router = Router();

  // Get AI components status
  router.get('/components', (req, res) => {
    const agentStatus = tradingAgent.getStatus();
    
    res.json({
      components: [
        {
          name: "Transformer Engine",
          description: "Quantum-inspired processing",
          icon: "memory",
          iconColor: "primary",
          status: "Active"
        },
        {
          name: "Trading Agent",
          description: "Opportunity detection",
          icon: "smart_toy",
          iconColor: "info",
          status: agentStatus.running ? "Scanning" : "Stopped"
        },
        {
          name: "Transaction Engine",
          description: "Trade execution",
          icon: "sync",
          iconColor: "warning",
          status: "Ready"
        },
        {
          name: "Security Layer",
          description: "Quantum-inspired encryption",
          icon: "security",
          iconColor: "danger",
          status: "Secured"
        }
      ]
    });
  });

  // Set scan interval
  router.post('/settings/scan-interval', (req, res) => {
    try {
      const { interval } = req.body;
      
      if (!interval || !['30s', '1m', '5m'].includes(interval)) {
        return res.status(400).json({ message: 'Invalid scan interval' });
      }
      
      // Convert interval to milliseconds
      let milliseconds: number;
      switch (interval) {
        case '30s': milliseconds = 30000; break;
        case '1m': milliseconds = 60000; break;
        case '5m': milliseconds = 300000; break;
        default: milliseconds = 60000;
      }
      
      tradingAgent.setScanInterval(milliseconds);
      
      res.json({
        message: 'Scan interval updated successfully',
        interval: interval
      });
    } catch (error) {
      console.error('Error updating scan interval:', error);
      res.status(500).json({ message: 'Failed to update scan interval' });
    }
  });

  // Set risk level
  router.post('/settings/risk-level', (req, res) => {
    try {
      const { level } = req.body;
      
      if (!level || !['low', 'medium', 'high'].includes(level)) {
        return res.status(400).json({ message: 'Invalid risk level' });
      }
      
      tradingAgent.setRiskLevel(level as 'low' | 'medium' | 'high');
      
      res.json({
        message: 'Risk level updated successfully',
        level: level
      });
    } catch (error) {
      console.error('Error updating risk level:', error);
      res.status(500).json({ message: 'Failed to update risk level' });
    }
  });

  // Start agent
  router.post('/start', (req, res) => {
    try {
      tradingAgent.start();
      
      res.json({
        message: 'Trading agent started successfully',
        status: 'running'
      });
    } catch (error) {
      console.error('Error starting trading agent:', error);
      res.status(500).json({ message: 'Failed to start trading agent' });
    }
  });

  // Stop agent
  router.post('/stop', (req, res) => {
    try {
      tradingAgent.stop();
      
      res.json({
        message: 'Trading agent stopped successfully',
        status: 'stopped'
      });
    } catch (error) {
      console.error('Error stopping trading agent:', error);
      res.status(500).json({ message: 'Failed to stop trading agent' });
    }
  });

  return router;
}
