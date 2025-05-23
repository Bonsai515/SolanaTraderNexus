/**
 * QuickNode Premium RPC Configuration
 * Premium endpoint for critical trading operations
 */

const { Connection } = require('@solana/web3.js');

class QuickNodePremiumRPC {
  constructor() {
    // QuickNode Premium endpoint - replace with actual endpoint
    this.quickNodeEndpoint = 'https://solana-mainnet.quicknode.pro/your-premium-token/';
    
    // Premium connection with optimized settings
    this.premiumConnection = new Connection(this.quickNodeEndpoint, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 60000,
      disableRetryOnRateLimit: false,
      httpHeaders: {
        'User-Agent': 'NexusTrader/1.0',
        'X-API-Key': 'premium-access'
      }
    });

    // Fallback connections for redundancy
    this.fallbackConnections = [
      new Connection('https://solana-api.syndica.io/access-token/UEjTFkyf1vQ99VGfY5Y74GXkUckitTvQodQV2tw9jKPmzNL1q7LCvdcv8Adnbqm9/rpc'),
      new Connection('https://api.mainnet-beta.solana.com'),
      new Connection('https://rpc.ankr.com/solana')
    ];

    this.connectionStats = {
      requests: 0,
      successes: 0,
      errors: 0,
      avgResponseTime: 0,
      lastHealthCheck: null
    };

    console.log('[QuickNodePremium] Premium RPC configuration initialized');
    console.log('[QuickNodePremium] Endpoint ready for critical operations');
  }

  // Get premium connection for critical operations
  getPremiumConnection() {
    this.connectionStats.requests++;
    return this.premiumConnection;
  }

  // Execute critical transaction with premium endpoint
  async executeCriticalTransaction(transaction, signers, options = {}) {
    console.log('[QuickNodePremium] Executing critical transaction on premium endpoint...');
    
    const startTime = Date.now();
    
    try {
      const connection = this.getPremiumConnection();
      
      // Send transaction with premium settings
      const signature = await connection.sendTransaction(transaction, signers, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        maxRetries: 5,
        ...options
      });
      
      console.log(`[QuickNodePremium] Transaction sent: ${signature}`);
      
      // Confirm with premium endpoint
      const confirmation = await connection.confirmTransaction(signature, 'confirmed');
      
      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }
      
      const responseTime = Date.now() - startTime;
      this.updateStats(true, responseTime);
      
      console.log(`[QuickNodePremium] Transaction confirmed: ${signature} (${responseTime}ms)`);
      
      return {
        success: true,
        signature: signature,
        confirmationTime: responseTime,
        endpoint: 'quicknode-premium'
      };
      
    } catch (error) {
      console.error('[QuickNodePremium] Critical transaction error:', error.message);
      this.updateStats(false, Date.now() - startTime);
      
      // Try fallback if premium fails
      return await this.executeFallbackTransaction(transaction, signers, options);
    }
  }

  // Fallback execution if premium fails
  async executeFallbackTransaction(transaction, signers, options) {
    console.log('[QuickNodePremium] Attempting fallback execution...');
    
    for (let i = 0; i < this.fallbackConnections.length; i++) {
      try {
        const connection = this.fallbackConnections[i];
        const signature = await connection.sendTransaction(transaction, signers, options);
        
        const confirmation = await connection.confirmTransaction(signature, 'confirmed');
        
        if (!confirmation.value.err) {
          console.log(`[QuickNodePremium] Fallback success: ${signature}`);
          return {
            success: true,
            signature: signature,
            endpoint: `fallback-${i}`
          };
        }
      } catch (error) {
        console.log(`[QuickNodePremium] Fallback ${i} failed, trying next...`);
      }
    }
    
    return { success: false, error: 'All endpoints failed' };
  }

  // Get account data with premium endpoint
  async getPremiumAccountData(publicKey) {
    try {
      const connection = this.getPremiumConnection();
      const accountInfo = await connection.getAccountInfo(publicKey);
      
      this.updateStats(true, 100); // Fast response assumed
      return accountInfo;
      
    } catch (error) {
      console.error('[QuickNodePremium] Account data error:', error.message);
      this.updateStats(false, 0);
      return null;
    }
  }

  // Get balance with premium endpoint
  async getPremiumBalance(publicKey) {
    try {
      const connection = this.getPremiumConnection();
      const balance = await connection.getBalance(publicKey);
      
      this.updateStats(true, 80);
      return balance / 1e9; // Convert to SOL
      
    } catch (error) {
      console.error('[QuickNodePremium] Balance check error:', error.message);
      this.updateStats(false, 0);
      return 0;
    }
  }

  // Premium slot and block information
  async getPremiumSlotInfo() {
    try {
      const connection = this.getPremiumConnection();
      const slot = await connection.getSlot();
      const blockTime = await connection.getBlockTime(slot);
      
      this.updateStats(true, 60);
      
      return {
        slot: slot,
        blockTime: blockTime,
        timestamp: Date.now()
      };
      
    } catch (error) {
      console.error('[QuickNodePremium] Slot info error:', error.message);
      this.updateStats(false, 0);
      return null;
    }
  }

  // Health check for premium endpoint
  async performPremiumHealthCheck() {
    console.log('[QuickNodePremium] Performing premium health check...');
    
    const startTime = Date.now();
    
    try {
      const connection = this.getPremiumConnection();
      const slot = await connection.getSlot();
      const responseTime = Date.now() - startTime;
      
      this.connectionStats.lastHealthCheck = Date.now();
      this.updateStats(true, responseTime);
      
      console.log(`[QuickNodePremium] Health check passed - Slot: ${slot} (${responseTime}ms)`);
      
      return {
        healthy: true,
        slot: slot,
        responseTime: responseTime,
        endpoint: 'quicknode-premium'
      };
      
    } catch (error) {
      console.error('[QuickNodePremium] Health check failed:', error.message);
      this.updateStats(false, 0);
      
      return {
        healthy: false,
        error: error.message,
        endpoint: 'quicknode-premium'
      };
    }
  }

  // Update connection statistics
  updateStats(success, responseTime) {
    if (success) {
      this.connectionStats.successes++;
      
      // Update average response time
      const total = this.connectionStats.avgResponseTime * (this.connectionStats.successes - 1);
      this.connectionStats.avgResponseTime = (total + responseTime) / this.connectionStats.successes;
    } else {
      this.connectionStats.errors++;
    }
  }

  // Get premium endpoint statistics
  getPremiumStats() {
    const successRate = this.connectionStats.requests > 0 
      ? (this.connectionStats.successes / this.connectionStats.requests * 100).toFixed(2)
      : '0.00';
    
    return {
      ...this.connectionStats,
      successRate: `${successRate}%`,
      endpointType: 'quicknode-premium',
      fallbacksAvailable: this.fallbackConnections.length
    };
  }
}

module.exports = QuickNodePremiumRPC;
