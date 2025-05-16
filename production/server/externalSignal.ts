/**
 * External Signal Service
 * 
 * This module handles the communication with external trading platforms
 * by providing webhook mechanisms to forward signals from our system.
 * 
 * Supported platforms:
 * - Generic Webhook APIs
 * - Griffain.com Trading Platform
 * - Pump.fun Integration
 * - Dexscreener Bots
 * - Birdeye Alerts
 * - Goose Trading Bots
 */

import axios from 'axios';
import { Signal, SignalType, SignalStrength, SignalDirection, SignalSource } from './signalHub';
import { logger } from './logger';

// Platform types
export enum PlatformType {
  GENERIC = 'generic',
  GRIFFAIN = 'griffain',
  PUMP_FUN = 'pump_fun',
  DEXSCREENER = 'dexscreener',
  BIRDEYE = 'birdeye',
  GOOSE = 'goose',
}

// Storage for registered external platforms
interface ExternalPlatform {
  id: string;
  name: string;
  url: string;
  apiKey?: string;
  active: boolean;
  platformType: PlatformType;
  signalTypes?: string[];
  signalSources?: string[];
  pairs?: string[];
  lastSent?: Date;
  errorCount: number;
  config?: Record<string, any>; // Platform-specific configuration
}

// Note: Signal interface now includes token_address and analysis fields directly

class ExternalSignalService {
  private static instance: ExternalSignalService;
  private platforms: Map<string, ExternalPlatform> = new Map();
  
  // Make PlatformType available as a public property on the service
  public PlatformType = PlatformType;
  
  private constructor() {
    // Private constructor for singleton
  }
  
  /**
   * Get the singleton instance
   */
  public static getInstance(): ExternalSignalService {
    if (!ExternalSignalService.instance) {
      ExternalSignalService.instance = new ExternalSignalService();
    }
    return ExternalSignalService.instance;
  }
  
  /**
   * Register an external platform to receive signals
   * @param platform Platform details
   * @returns The registered platform ID
   */
  public registerPlatform(platform: Omit<ExternalPlatform, 'id' | 'errorCount'>): string {
    const id = `platform_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    
    this.platforms.set(id, {
      ...platform,
      id,
      errorCount: 0,
      active: true
    });
    
    logger.info(`Registered external platform: ${platform.name} (${id})`);
    
    return id;
  }
  
  /**
   * Update an existing platform
   * @param id Platform ID
   * @param updates Updates to apply
   * @returns Success status
   */
  public updatePlatform(id: string, updates: Partial<ExternalPlatform>): boolean {
    const platform = this.platforms.get(id);
    
    if (!platform) {
      return false;
    }
    
    this.platforms.set(id, { ...platform, ...updates });
    logger.info(`Updated external platform: ${platform.name} (${id})`);
    
    return true;
  }
  
  /**
   * Remove a platform
   * @param id Platform ID
   * @returns Success status
   */
  public removePlatform(id: string): boolean {
    const removed = this.platforms.delete(id);
    
    if (removed) {
      logger.info(`Removed external platform: ${id}`);
    }
    
    return removed;
  }
  
  /**
   * Get all registered platforms
   * @returns List of platforms
   */
  public getAllPlatforms(): ExternalPlatform[] {
    return Array.from(this.platforms.values());
  }
  
  /**
   * Get a specific platform by ID
   * @param id Platform ID
   * @returns Platform details or undefined
   */
  public getPlatform(id: string): ExternalPlatform | undefined {
    return this.platforms.get(id);
  }
  
  /**
   * Forward a signal to all registered platforms
   * @param signal The signal to forward
   * @returns Array of platform IDs that received the signal
   */
  public async forwardSignal(signal: Signal): Promise<string[]> {
    const sentTo: string[] = [];
    
    // Create a simplified signal format for external platforms with minimal details
    const externalSignal = {
      id: signal.id,
      timestamp: signal.timestamp,
      pair: signal.pair,
      type: signal.type,
      strength: signal.strength,
      direction: signal.direction,
      confidence: signal.confidence,
      actionable: signal.actionable
    };
    
    for (const platform of this.platforms.values()) {
      // Skip inactive platforms
      if (!platform.active) {
        continue;
      }
      
      // Skip if platform doesn't want this type of signal
      if (platform.signalTypes && 
          platform.signalTypes.length > 0 && 
          !platform.signalTypes.includes(signal.type)) {
        continue;
      }
      
      // Skip if platform doesn't want signals from this source
      if (platform.signalSources && 
          platform.signalSources.length > 0 && 
          !platform.signalSources.includes(signal.source)) {
        continue;
      }
      
      // Skip if platform doesn't want signals for this pair
      if (platform.pairs && 
          platform.pairs.length > 0 && 
          !platform.pairs.includes(signal.pair)) {
        continue;
      }
      
      try {
        let success = false;
        
        // Handle different platform types with specialized formatting
        switch(platform.platformType) {
          case PlatformType.GRIFFAIN:
            success = await this.sendToGriffain(platform, signal);
            break;
            
          case PlatformType.PUMP_FUN:
            success = await this.sendToPumpFun(platform, signal);
            break;
            
          case PlatformType.DEXSCREENER:
            success = await this.sendToDexscreener(platform, signal);
            break;
            
          case PlatformType.BIRDEYE:
            success = await this.sendToBirdeye(platform, signal);
            break;
            
          case PlatformType.GOOSE:
            success = await this.sendToGoose(platform, signal);
            break;
            
          case PlatformType.GENERIC:
          default:
            // Generic platform handling (default behavior)
            success = await this.sendToGenericPlatform(platform, externalSignal);
            break;
        }
        
        if (success) {
          // Success
          logger.info(`Signal ${signal.id} forwarded to platform ${platform.name} (${platform.id})`);
          sentTo.push(platform.id);
          
          // Update platform status
          this.platforms.set(platform.id, {
            ...platform,
            lastSent: new Date(),
            errorCount: 0
          });
        } else {
          // Non-success
          logger.warn(`Failed to forward signal to platform ${platform.name} (${platform.id})`);
          
          // Increment error count
          this.platforms.set(platform.id, {
            ...platform,
            errorCount: platform.errorCount + 1
          });
        }
      } catch (error) {
        logger.error(`Error forwarding signal to platform ${platform.name} (${platform.id}):`, error);
        
        // Increment error count
        this.platforms.set(platform.id, {
          ...platform,
          errorCount: platform.errorCount + 1
        });
        
        // Deactivate platform if too many errors
        if (platform.errorCount >= 5) {
          logger.warn(`Deactivating platform ${platform.name} (${platform.id}) due to too many errors`);
          this.platforms.set(platform.id, {
            ...platform,
            active: false
          });
        }
      }
    }
    
    return sentTo;
  }
  
  /**
   * Send signal to Griffain.com trading platform
   * @param platform Platform configuration
   * @param signal Signal to send
   * @returns Success status
   */
  private async sendToGriffain(platform: ExternalPlatform, signal: Signal): Promise<boolean> {
    // Griffain.com uses a specific format with additional fields
    const griffainSignal = {
      signal_id: signal.id,
      timestamp: signal.timestamp,
      market: signal.pair,
      signal_type: signal.type,
      strength: signal.strength,
      direction: signal.direction === SignalDirection.BULLISH ? 'buy' : 'sell',
      confidence_score: signal.confidence,
      action_required: signal.actionable,
      source: 'quantum_hyperion',
      expiration: new Date(Date.now() + 3600000).toISOString(), // 1 hour expiration
      blockchain: 'solana',
      metadata: {
        generator: 'MicroQHC',
        analysis: signal.analysis || {}
      }
    };
    
    // Griffain-specific headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Griffain-Version': '2.0'
    };
    
    if (platform.apiKey) {
      headers['X-Griffain-API-Key'] = platform.apiKey;
    }
    
    try {
      const response = await axios.post(platform.url, griffainSignal, { headers });
      return response.status >= 200 && response.status < 300;
    } catch (error) {
      logger.error(`Griffain.com API error:`, error);
      return false;
    }
  }
  
  /**
   * Send signal to Pump.fun integration
   * @param platform Platform configuration
   * @param signal Signal to send
   * @returns Success status
   */
  private async sendToPumpFun(platform: ExternalPlatform, signal: Signal): Promise<boolean> {
    // Pump.fun uses its own format
    const pumpSignal = {
      token: signal.pair.split('/')[0],
      side: signal.direction === SignalDirection.BULLISH ? 'long' : 'short',
      confidence: signal.confidence * 100, // Convert to percentage
      type: signal.type,
      source: signal.source,
      timestamp: signal.timestamp,
    };
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (platform.apiKey) {
      headers['Authorization'] = `Bearer ${platform.apiKey}`;
    }
    
    try {
      const response = await axios.post(platform.url, pumpSignal, { headers });
      return response.status >= 200 && response.status < 300;
    } catch (error) {
      logger.error(`Pump.fun API error:`, error);
      return false;
    }
  }
  
  /**
   * Send signal to Dexscreener bots
   * @param platform Platform configuration
   * @param signal Signal to send
   * @returns Success status
   */
  private async sendToDexscreener(platform: ExternalPlatform, signal: Signal): Promise<boolean> {
    // Format for Dexscreener webhook
    const dexscreenerSignal = {
      content: `🚨 **New ${signal.type.toUpperCase()} Signal**`,
      embeds: [{
        title: `${signal.direction === SignalDirection.BULLISH ? '📈 BUY' : '📉 SELL'} ${signal.pair}`,
        description: `**Confidence:** ${(signal.confidence * 100).toFixed(2)}%\n**Strength:** ${signal.strength}\n**Source:** ${signal.source}`,
        color: signal.direction === SignalDirection.BULLISH ? 3066993 : 15158332,
        footer: {
          text: 'Generated by Quantum Hyperion'
        },
        timestamp: signal.timestamp
      }]
    };
    
    try {
      const response = await axios.post(platform.url, dexscreenerSignal);
      return response.status >= 200 && response.status < 300;
    } catch (error) {
      logger.error(`Dexscreener webhook error:`, error);
      return false;
    }
  }
  
  /**
   * Send signal to Birdeye alerts
   * @param platform Platform configuration
   * @param signal Signal to send
   * @returns Success status
   */
  private async sendToBirdeye(platform: ExternalPlatform, signal: Signal): Promise<boolean> {
    // Birdeye alert format
    const birdeyeSignal = {
      token_address: signal.token_address || '',
      pair: signal.pair,
      alert_type: signal.type,
      direction: signal.direction,
      confidence: signal.confidence,
      timestamp: signal.timestamp,
      source: signal.source,
      message: `${signal.type.toUpperCase()} signal for ${signal.pair} with ${(signal.confidence * 100).toFixed(2)}% confidence`
    };
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (platform.apiKey) {
      headers['X-API-Key'] = platform.apiKey;
    }
    
    try {
      const response = await axios.post(platform.url, birdeyeSignal, { headers });
      return response.status >= 200 && response.status < 300;
    } catch (error) {
      logger.error(`Birdeye API error:`, error);
      return false;
    }
  }
  
  /**
   * Send signal to Goose trading bots
   * @param platform Platform configuration
   * @param signal Signal to send
   * @returns Success status
   */
  private async sendToGoose(platform: ExternalPlatform, signal: Signal): Promise<boolean> {
    // Goose trading format
    const gooseSignal = {
      id: signal.id,
      time: signal.timestamp,
      market: signal.pair,
      signal_type: signal.type,
      intensity: signal.strength,
      trend_direction: signal.direction,
      reliability: signal.confidence,
      is_executable: signal.actionable,
      advanced_params: {
        source_model: signal.source,
        detection_method: 'quantum_hyperion'
      }
    };
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'QuantumHyperion/1.0'
    };
    
    if (platform.apiKey) {
      headers['Authorization'] = `Api-Key ${platform.apiKey}`;
    }
    
    try {
      const response = await axios.post(platform.url, gooseSignal, { headers });
      return response.status >= 200 && response.status < 300;
    } catch (error) {
      logger.error(`Goose API error:`, error);
      return false;
    }
  }
  
  /**
   * Send signal to a generic platform
   * @param platform Platform configuration
   * @param externalSignal Formatted signal data
   * @returns Success status
   */
  private async sendToGenericPlatform(platform: ExternalPlatform, externalSignal: any): Promise<boolean> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    
    // Add API key if provided
    if (platform.apiKey) {
      headers['X-API-Key'] = platform.apiKey;
    }
    
    try {
      const response = await axios.post(platform.url, externalSignal, { headers });
      return response.status >= 200 && response.status < 300;
    } catch (error) {
      logger.error(`Generic platform API error:`, error);
      return false;
    }
  }
  
  /**
   * Forward a signal to specific platforms
   * @param signal The signal to forward
   * @param platformIds Array of platform IDs to receive the signal
   * @returns Array of platform IDs that successfully received the signal
   */
  public async forwardSignalToPlatforms(signal: Signal, platformIds: string[]): Promise<string[]> {
    const sentTo: string[] = [];
    
    // Create a simplified signal format for external platforms with minimal details
    const externalSignal = {
      id: signal.id,
      timestamp: signal.timestamp,
      pair: signal.pair,
      type: signal.type,
      strength: signal.strength,
      direction: signal.direction,
      confidence: signal.confidence,
      actionable: signal.actionable
    };
    
    for (const platformId of platformIds) {
      const platform = this.platforms.get(platformId);
      
      // Skip if platform doesn't exist
      if (!platform) {
        logger.warn(`Platform ${platformId} not found, skipping signal forwarding`);
        continue;
      }
      
      // Skip inactive platforms
      if (!platform.active) {
        continue;
      }
      
      try {
        // Send the signal to the platform with proper authentication
        const headers: Record<string, string> = {
          'Content-Type': 'application/json'
        };
        
        // Add API key if provided
        if (platform.apiKey) {
          headers['X-API-Key'] = platform.apiKey;
        }
        
        const response = await axios.post(platform.url, externalSignal, { headers });
        
        if (response.status >= 200 && response.status < 300) {
          // Success
          logger.info(`Signal ${signal.id} forwarded to platform ${platform.name} (${platform.id})`);
          sentTo.push(platform.id);
          
          // Update platform status
          this.platforms.set(platform.id, {
            ...platform,
            lastSent: new Date(),
            errorCount: 0
          });
        } else {
          // Non-success status code
          logger.warn(`Failed to forward signal to platform ${platform.name} (${platform.id}): Status ${response.status}`);
          
          // Increment error count
          this.platforms.set(platform.id, {
            ...platform,
            errorCount: platform.errorCount + 1
          });
        }
      } catch (error) {
        logger.error(`Error forwarding signal to platform ${platform.name} (${platform.id}):`, error);
        
        // Increment error count
        this.platforms.set(platform.id, {
          ...platform,
          errorCount: platform.errorCount + 1
        });
        
        // Deactivate platform if too many errors
        if (platform.errorCount >= 5) {
          logger.warn(`Deactivating platform ${platform.name} (${platform.id}) due to too many errors`);
          this.platforms.set(platform.id, {
            ...platform,
            active: false
          });
        }
      }
    }
    
    return sentTo;
  }
  
  /**
   * Test connectivity to a platform
   * @param url Platform URL
   * @param apiKey Optional API key
   * @returns Test result
   */
  public async testPlatformConnectivity(url: string, apiKey?: string): Promise<{
    success: boolean;
    message: string;
    responseTime?: number;
  }> {
    try {
      const startTime = Date.now();
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      
      if (apiKey) {
        headers['X-API-Key'] = apiKey;
      }
      
      // Send a test ping
      const response = await axios.post(url, {
        test: true,
        timestamp: new Date().toISOString(),
        message: 'Test signal from Solana Quantum Trading Platform'
      }, { 
        headers,
        timeout: 5000 // 5 second timeout
      });
      
      const responseTime = Date.now() - startTime;
      
      if (response.status >= 200 && response.status < 300) {
        return {
          success: true,
          message: `Connection successful (${responseTime}ms)`,
          responseTime
        };
      } else {
        return {
          success: false,
          message: `Received status code ${response.status}`,
          responseTime
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Connection failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}

// Export the singleton instance
export const externalSignalService = ExternalSignalService.getInstance();