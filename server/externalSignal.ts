/**
 * External Signal Service
 * 
 * This module handles the communication with external trading platforms
 * by providing webhook mechanisms to forward signals from our system.
 */

import axios from 'axios';
import { Signal } from './signalHub';
import { logger } from './logger';

// Storage for registered external platforms
interface ExternalPlatform {
  id: string;
  name: string;
  url: string;
  apiKey?: string;
  active: boolean;
  signalTypes?: string[];
  signalSources?: string[];
  pairs?: string[];
  lastSent?: Date;
  errorCount: number;
}

class ExternalSignalService {
  private static instance: ExternalSignalService;
  private platforms: Map<string, ExternalPlatform> = new Map();
  
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
    
    // Create a simplified signal format for external platforms
    const externalSignal = {
      id: signal.id,
      timestamp: signal.timestamp,
      pair: signal.pair,
      type: signal.type,
      source: signal.source,
      strength: signal.strength,
      direction: signal.direction,
      confidence: signal.confidence,
      description: signal.description,
      actionable: signal.actionable,
      metadata: signal.metadata
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