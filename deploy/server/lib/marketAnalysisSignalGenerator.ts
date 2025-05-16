/**
 * Market Analysis Signal Generator
 * 
 * This module uses market analysis (either from Perplexity AI or local analysis)
 * to generate trading signals that can be processed by the signal hub.
 * It serves as a bridge between market analysis and the trading system.
 */

import * as logger from '../logger';
import { EventEmitter } from 'events';
import { perplexityAI } from '../perplexity-integration';
import { localMarketAnalysis } from './localMarketAnalysis';
import { signalHub } from '../signalHub';
import { 
  SignalType, 
  SignalStrength, 
  SignalDirection, 
  SignalPriority, 
  SignalSource
} from '../../shared/signalTypes';

// Tokens to monitor and analyze
const MONITORED_TOKENS = ['SOL', 'BONK', 'JUP', 'MEME', 'WIF', 'GUAC'];
const ANALYSIS_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes between analyses

/**
 * Market Analysis Signal Generator
 * Generates signals based on market analysis
 */
class MarketAnalysisSignalGenerator extends EventEmitter {
  private isRunning: boolean = false;
  private analysisIntervals: Record<string, NodeJS.Timeout> = {};
  private lastAnalysisTime: Record<string, number> = {};

  constructor() {
    super();
    this.setMaxListeners(50);
  }

  /**
   * Start the market analysis signal generator
   */
  public async start(): Promise<boolean> {
    if (this.isRunning) {
      return true;
    }

    try {
      logger.info('Starting Market Analysis Signal Generator');
      
      // Initialize Perplexity AI
      const perplexityInitialized = perplexityAI.isInitialized();
      if (perplexityInitialized) {
        logger.info('Perplexity AI is initialized and ready for market analysis');
      } else {
        logger.warn('Perplexity AI is not initialized, using local market analysis as fallback');
      }

      // Setup analysis for each monitored token
      for (const token of MONITORED_TOKENS) {
        this.setupTokenAnalysis(token);
      }

      this.isRunning = true;
      logger.info(`Market Analysis Signal Generator started for ${MONITORED_TOKENS.length} tokens`);
      return true;
    } catch (error) {
      logger.error('Failed to start Market Analysis Signal Generator:', error);
      return false;
    }
  }

  /**
   * Stop the market analysis signal generator
   */
  public stop(): void {
    if (!this.isRunning) {
      return;
    }

    // Clear all intervals
    for (const token in this.analysisIntervals) {
      clearInterval(this.analysisIntervals[token]);
      delete this.analysisIntervals[token];
    }

    this.isRunning = false;
    logger.info('Market Analysis Signal Generator stopped');
  }

  /**
   * Setup token analysis for a specific token
   * @param token The token to analyze
   */
  private setupTokenAnalysis(token: string): void {
    // Immediately run first analysis
    this.analyzeToken(token).catch(error => {
      logger.error(`Error in initial analysis for ${token}:`, error);
    });

    // Setup interval for recurring analysis
    const intervalId = setInterval(() => {
      this.analyzeToken(token).catch(error => {
        logger.error(`Error in scheduled analysis for ${token}:`, error);
      });
    }, ANALYSIS_INTERVAL_MS);

    this.analysisIntervals[token] = intervalId;
  }

  /**
   * Analyze a token and generate signals based on the analysis
   * @param token The token to analyze
   */
  private async analyzeToken(token: string): Promise<void> {
    try {
      const now = Date.now();
      
      // Check if enough time has passed since last analysis
      if (this.lastAnalysisTime[token] && 
          now - this.lastAnalysisTime[token] < ANALYSIS_INTERVAL_MS * 0.9) {
        logger.debug(`Skipping analysis for ${token}, too soon since last analysis`);
        return;
      }

      logger.info(`Analyzing token ${token} for signal generation`);
      this.lastAnalysisTime[token] = now;

      // Try Perplexity first, fallback to local analysis
      let analysis: string;
      let sentiment: string;
      let source: string;

      try {
        if (perplexityAI.isInitialized()) {
          analysis = await perplexityAI.analyzeToken(token);
          sentiment = await perplexityAI.getMarketSentiment(token);
          source = 'perplexity';
        } else {
          throw new Error('Perplexity AI not initialized');
        }
      } catch (error: any) {
        logger.warn(`Falling back to local analysis for ${token}: ${error.message}`);
        analysis = localMarketAnalysis.analyzeToken(token);
        sentiment = localMarketAnalysis.getMarketSentiment(token);
        source = 'local';
      }

      // Extract signal information from analysis
      const signal = this.extractSignalFromAnalysis(token, analysis, sentiment, source);
      
      if (signal) {
        // Submit signal to the signal hub
        const signalId = await signalHub.submitSignal(signal);
        logger.info(`Generated signal ${signalId} for ${token} based on market analysis`);
        
        // Emit event for any listeners
        this.emit('signal', signal);
      }
    } catch (error) {
      logger.error(`Error analyzing token ${token}:`, error);
    }
  }

  /**
   * Extract signal information from market analysis text
   * @param token The token being analyzed
   * @param analysis The market analysis text
   * @param sentiment The market sentiment text
   * @param source The source of the analysis (perplexity or local)
   * @returns A signal object if a signal can be extracted, or null if no actionable signal
   */
  private extractSignalFromAnalysis(
    token: string, 
    analysis: string, 
    sentiment: string,
    source: string
  ): any | null {
    try {
      // Extract price from analysis
      const priceMatch = analysis.match(/trading at \$([\d,.]+)/i);
      const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : 0;

      // Extract price change from analysis
      const priceChangeMatch = analysis.match(/(increased|decreased) by ([\d.]+)%/i);
      const priceChangeDirection = priceChangeMatch ? priceChangeMatch[1].toLowerCase() : '';
      const priceChangePercent = priceChangeMatch ? parseFloat(priceChangeMatch[2]) : 0;

      // Extract volatility
      const volatilityMatch = analysis.match(/high volatility/i);
      const hasHighVolatility = !!volatilityMatch;

      // Extract support/resistance
      const supportMatch = analysis.match(/Support: \$([\d,.]+)/i);
      const resistanceMatch = analysis.match(/Resistance: \$([\d,.]+)/i);
      const support = supportMatch ? parseFloat(supportMatch[1].replace(/,/g, '')) : price * 0.9;
      const resistance = resistanceMatch ? parseFloat(resistanceMatch[1].replace(/,/g, '')) : price * 1.1;

      // Extract sentiment score from sentiment text
      const sentimentScoreMatch = sentiment.match(/sentiment score of ([\d.]+)/i);
      const sentimentScore = sentimentScoreMatch ? parseFloat(sentimentScoreMatch[1]) : 5;

      // Determine signal type, strength, and direction
      let signalType = SignalType.MARKET_SENTIMENT;
      let signalStrength = SignalStrength.MEDIUM;
      let signalDirection = SignalDirection.NEUTRAL;
      let signalPriority = SignalPriority.MEDIUM;
      let confidence = 65; // Default confidence level
      let isActionable = false;

      // Determine signal direction based on price change and sentiment
      if (sentimentScore > 7.5 && priceChangeDirection === 'increased' && priceChangePercent > 2) {
        signalDirection = SignalDirection.BULLISH;
        signalStrength = SignalStrength.STRONG;
        confidence = 75 + (sentimentScore - 7.5) * 5;
        signalPriority = SignalPriority.HIGH;
        isActionable = true;
      } else if (sentimentScore < 3.5 && priceChangeDirection === 'decreased' && priceChangePercent > 2) {
        signalDirection = SignalDirection.BEARISH;
        signalStrength = SignalStrength.STRONG;
        confidence = 75 + (3.5 - sentimentScore) * 5;
        signalPriority = SignalPriority.HIGH;
        isActionable = true;
      } else if (sentimentScore > 6.5 && priceChangeDirection === 'increased') {
        signalDirection = SignalDirection.BULLISH;
        signalStrength = SignalStrength.MEDIUM;
        confidence = 65 + (sentimentScore - 6.5) * 5;
        isActionable = true;
      } else if (sentimentScore < 4.5 && priceChangeDirection === 'decreased') {
        signalDirection = SignalDirection.BEARISH;
        signalStrength = SignalStrength.MEDIUM;
        confidence = 65 + (4.5 - sentimentScore) * 5;
        isActionable = true;
      } else if (sentimentScore > 5.5) {
        signalDirection = SignalDirection.SLIGHTLY_BULLISH;
        signalStrength = SignalStrength.WEAK;
        confidence = 60;
      } else if (sentimentScore < 5.5) {
        signalDirection = SignalDirection.SLIGHTLY_BEARISH;
        signalStrength = SignalStrength.WEAK;
        confidence = 60;
      }

      // If we have high volatility, adjust the signal type
      if (hasHighVolatility) {
        signalType = SignalType.VOLATILITY_ALERT;
        signalPriority = SignalPriority.HIGH;
        confidence = Math.min(confidence + 10, 95);
      }

      // Check if we should generate a signal
      if (signalDirection === SignalDirection.NEUTRAL) {
        return null; // No actionable signal to generate
      }

      // Create signal object
      const signalData = {
        id: `mkt_${token}_${Date.now()}`,
        timestamp: new Date().toISOString(),
        pair: `${token}/USDC`,
        type: signalType,
        source: source === 'perplexity' ? SignalSource.PERPLEXITY_AI : SignalSource.LOCAL_ANALYSIS,
        strength: signalStrength,
        direction: signalDirection,
        priority: signalPriority,
        confidence,
        description: `Market analysis ${signalDirection.toLowerCase()} signal for ${token}`,
        // Critical fields for signal processing - always set these
        sourceToken: 'USDC',
        targetToken: token,
        metadata: {
          analysis_source: source,
          price,
          price_change_percent: priceChangePercent,
          price_change_direction: priceChangeDirection,
          volatility: hasHighVolatility ? 'high' : 'normal',
          sentiment_score: sentimentScore,
          analysis_summary: analysis.substring(0, 200) + '...',
          sentiment_summary: sentiment.substring(0, 200) + '...'
        },
        actionable: isActionable,
        token_address: '', // Would need to be populated from a token registry
        analysis: {
          volatility: hasHighVolatility ? 80 : 50,
          liquidity: 0, // Would need real data
          momentum: priceChangeDirection === 'increased' ? 60 + priceChangePercent * 5 : 40 - priceChangePercent * 5,
          support,
          resistance
        },
        metrics: {
          price,
          price_change_24h: priceChangePercent,
          volume_24h: 0, // Would need real data
          market_cap: 0, // Would need real data
        },
        relatedSignals: []
      };

      return signalData;
    } catch (error) {
      logger.error('Error extracting signal from analysis:', error);
      return null;
    }
  }

  /**
   * Generate signals from arbitrage opportunities
   */
  public async generateArbitrageSignals(): Promise<void> {
    try {
      logger.info('Analyzing arbitrage opportunities for signal generation');

      // Try Perplexity first, fallback to local analysis
      let arbitrageAnalysis: string;
      let source: string;

      try {
        if (perplexityAI.isInitialized()) {
          arbitrageAnalysis = await perplexityAI.findArbitrageOpportunities();
          source = 'perplexity';
        } else {
          throw new Error('Perplexity AI not initialized');
        }
      } catch (error) {
        logger.warn(`Falling back to local arbitrage analysis: ${error.message}`);
        arbitrageAnalysis = localMarketAnalysis.findArbitrageOpportunities();
        source = 'local';
      }

      // Check if there are no opportunities
      if (arbitrageAnalysis.includes('No significant arbitrage opportunities') ||
          arbitrageAnalysis.includes('No arbitrage opportunities detected')) {
        logger.info('No arbitrage opportunities detected for signal generation');
        return;
      }

      // Extract the arbitrage opportunities
      const arbitrageEntries = arbitrageAnalysis.split('\n\n')
        .filter(entry => entry.trim().length > 0)
        .filter(entry => entry.toLowerCase().includes('arbitrage') || entry.includes('%'));

      for (const entry of arbitrageEntries) {
        // Try to extract token, dexes, and profit %
        const tokenMatch = entry.match(/Opportunity for ([A-Z]+)/i);
        const token = tokenMatch ? tokenMatch[1] : 'UNKNOWN';
        
        const dexesMatch = entry.match(/between ([A-Za-z]+) and ([A-Za-z]+)/i);
        const buyDex = dexesMatch ? dexesMatch[1] : 'Unknown';
        const sellDex = dexesMatch ? dexesMatch[2] : 'Unknown';
        
        const profitMatch = entry.match(/([\d.]+)%/);
        const profitPercent = profitMatch ? parseFloat(profitMatch[1]) : 0;

        // Skip if profit is too low
        if (profitPercent < 0.5) {
          continue;
        }

        // Create arbitrage signal
        const signalData = {
          id: `arb_${token}_${Date.now()}`,
          timestamp: new Date().toISOString(),
          pair: `${token}/USDC`,
          type: SignalType.ARBITRAGE_OPPORTUNITY,
          source: source === 'perplexity' ? SignalSource.PERPLEXITY_AI : SignalSource.LOCAL_ANALYSIS,
          strength: profitPercent > 2.0 ? SignalStrength.STRONG : 
                   profitPercent > 1.0 ? SignalStrength.MEDIUM : SignalStrength.WEAK,
          direction: SignalDirection.NEUTRAL,
          priority: profitPercent > 2.0 ? SignalPriority.CRITICAL : 
                  profitPercent > 1.0 ? SignalPriority.HIGH : SignalPriority.MEDIUM,
          confidence: Math.min(60 + profitPercent * 10, 95),
          description: `Arbitrage opportunity for ${token} between ${buyDex} and ${sellDex} (${profitPercent.toFixed(2)}% profit)`,
          metadata: {
            analysis_source: source,
            buyDex,
            sellDex,
            profitPercent,
            analysis_summary: entry
          },
          actionable: true,
          token_address: '', // Would need to be populated from a token registry
          analysis: {
            volatility: 0, // Would need real data
            liquidity: 0, // Would need real data
            momentum: 0, // Would need real data
            support: 0, // Would need real data
            resistance: 0 // Would need real data
          },
          metrics: {
            profit_percent: profitPercent,
            estimated_profit_usd: 0, // Would need real data
          },
          relatedSignals: []
        };

        // Submit signal to the signal hub
        const signalId = await signalHub.submitSignal(signalData);
        logger.info(`Generated arbitrage signal ${signalId} for ${token} between ${buyDex} and ${sellDex}`);
        
        // Emit event for any listeners
        this.emit('signal', signalData);
      }
    } catch (error) {
      logger.error('Error generating arbitrage signals:', error);
    }
  }

  /**
   * Generate signals from trading strategies
   */
  public async generateStrategySignals(): Promise<void> {
    try {
      logger.info('Analyzing trading strategies for signal generation');

      // Try Perplexity first, fallback to local analysis
      let strategiesAnalysis: string;
      let source: string;

      try {
        if (perplexityAI.isInitialized()) {
          strategiesAnalysis = await perplexityAI.recommendTradingStrategies();
          source = 'perplexity';
        } else {
          throw new Error('Perplexity AI not initialized');
        }
      } catch (error) {
        logger.warn(`Falling back to local strategies analysis: ${error.message}`);
        strategiesAnalysis = localMarketAnalysis.recommendTradingStrategies();
        source = 'local';
      }

      // Extract the strategy recommendations
      const strategyEntries = strategiesAnalysis.split('\n\n')
        .filter(entry => entry.trim().length > 0)
        .filter(entry => entry.match(/[0-9]\./)); // Numbered list items

      for (const entry of strategyEntries) {
        // Try to extract strategy type, token, and risk level
        const strategyTypeMatch = entry.match(/([A-Za-z]+ [A-Za-z]+)/);
        const strategyType = strategyTypeMatch ? strategyTypeMatch[1] : 'Unknown Strategy';
        
        const tokenMatch = entry.match(/([A-Z]+) is/i);
        const token = tokenMatch ? tokenMatch[1] : 'UNKNOWN';
        
        const riskMatch = entry.match(/Risk Level: ([A-Za-z-]+)/i);
        const riskLevel = riskMatch ? riskMatch[1] : 'Unknown';

        // Extract entry and exit prices
        const entryMatch = entry.match(/Entry:.+?([\d.]+)/);
        const entryPrice = entryMatch ? parseFloat(entryMatch[1]) : 0;
        
        const exitMatch = entry.match(/Exit:.+?([\d.]+)/);
        const exitPrice = exitMatch ? parseFloat(exitMatch[1]) : 0;

        // Extract target gain
        const targetMatch = entry.match(/([\d.]+)% gain/);
        const targetPercent = targetMatch ? parseFloat(targetMatch[1]) : 0;

        // Skip if we couldn't extract token or strategy
        if (token === 'UNKNOWN' || strategyType === 'Unknown Strategy') {
          continue;
        }

        // Map risk level to signal strength
        let signalStrength = SignalStrength.MEDIUM;
        let signalPriority = SignalPriority.MEDIUM;
        
        if (riskLevel.toLowerCase().includes('low')) {
          signalStrength = SignalStrength.MEDIUM;
          signalPriority = SignalPriority.LOW;
        } else if (riskLevel.toLowerCase().includes('high')) {
          signalStrength = SignalStrength.STRONG;
          signalPriority = SignalPriority.HIGH;
        }

        // Create strategy signal
        const signalData = {
          id: `strat_${token}_${Date.now()}`,
          timestamp: new Date().toISOString(),
          pair: `${token}/USDC`,
          type: SignalType.STRATEGY_RECOMMENDATION,
          source: source === 'perplexity' ? SignalSource.PERPLEXITY_AI : SignalSource.LOCAL_ANALYSIS,
          strength: signalStrength,
          direction: SignalDirection.BULLISH, // Most strategies are for long positions
          priority: signalPriority,
          confidence: riskLevel.toLowerCase().includes('low') ? 80 : 
                     riskLevel.toLowerCase().includes('high') ? 60 : 70,
          description: `${strategyType} strategy for ${token} (${targetPercent}% target gain)`,
          metadata: {
            analysis_source: source,
            strategy_type: strategyType,
            risk_level: riskLevel,
            entry_price: entryPrice,
            exit_price: exitPrice,
            target_percent: targetPercent,
            analysis_summary: entry
          },
          actionable: true,
          token_address: '', // Would need to be populated from a token registry
          analysis: {
            volatility: 0, // Would need real data
            liquidity: 0, // Would need real data
            momentum: 0, // Would need real data
            support: 0, // Would need real data
            resistance: 0 // Would need real data
          },
          metrics: {
            target_gain_percent: targetPercent,
            entry_price: entryPrice,
            exit_price: exitPrice,
          },
          relatedSignals: []
        };

        // Submit signal to the signal hub
        const signalId = await signalHub.submitSignal(signalData);
        logger.info(`Generated strategy signal ${signalId} for ${token} (${strategyType})`);
        
        // Emit event for any listeners
        this.emit('signal', signalData);
      }
    } catch (error) {
      logger.error('Error generating strategy signals:', error);
    }
  }
}

// Create and export singleton instance
export const marketAnalysisSignalGenerator = new MarketAnalysisSignalGenerator();