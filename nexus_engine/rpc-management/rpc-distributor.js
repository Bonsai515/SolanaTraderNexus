/**
 * RPC Distribution Manager
 * Optimizes RPC usage by function separation
 */

const { Connection } = require('@solana/web3.js');

class RPCDistributor {
  constructor() {
    // Dedicated RPC for transaction execution only
    this.transactionRPC = new Connection(
      'https://solana-api.syndica.io/access-token/UEjTFkyf1vQ99VGfY5Y74GXkUckitTvQodQV2tw9jKPmzNL1q7LCvdcv8Adnbqm9/rpc',
      {
        commitment: 'confirmed',
        confirmTransactionInitialTimeout: 30000,
        disableRetryOnRateLimit: false,
        httpHeaders: { 'User-Agent': 'NexusTradeExecutor/1.0' }
      }
    );

    // RPC for price feeds and market data
    this.priceDataRPC = new Connection(
      'https://api.mainnet-beta.solana.com',
      {
        commitment: 'processed',
        confirmTransactionInitialTimeout: 15000,
        disableRetryOnRateLimit: true
      }
    );

    // RPC for wallet monitoring and balance checks
    this.walletMonitorRPC = new Connection(
      'https://rpc.ankr.com/solana',
      {
        commitment: 'finalized',
        confirmTransactionInitialTimeout: 10000,
        disableRetryOnRateLimit: true
      }
    );

    // RPC for cross-chain and arbitrage data
    this.arbitrageRPC = new Connection(
      'https://solana-mainnet.g.alchemy.com/v2/demo',
      {
        commitment: 'processed',
        confirmTransactionInitialTimeout: 15000,
        disableRetryOnRateLimit: true
      }
    );

    this.rpcStats = {
      transactionRPC: { requests: 0, errors: 0, lastUsed: null },
      priceDataRPC: { requests: 0, errors: 0, lastUsed: null },
      walletMonitorRPC: { requests: 0, errors: 0, lastUsed: null },
      arbitrageRPC: { requests: 0, errors: 0, lastUsed: null }
    };

    console.log('[RPCDistributor] RPC distribution manager initialized');
    console.log('[RPCDistributor] Transaction RPC: Syndica (dedicated)');
    console.log('[RPCDistributor] Price Data RPC: Mainnet Beta');
    console.log('[RPCDistributor] Wallet Monitor RPC: Ankr');
    console.log('[RPCDistributor] Arbitrage RPC: Alchemy');
  }

  // Get RPC connection for transaction execution (rate limited)
  getTransactionRPC() {
    this.rpcStats.transactionRPC.requests++;
    this.rpcStats.transactionRPC.lastUsed = Date.now();
    return this.transactionRPC;
  }

  // Get RPC connection for price data (unlimited usage)
  getPriceDataRPC() {
    this.rpcStats.priceDataRPC.requests++;
    this.rpcStats.priceDataRPC.lastUsed = Date.now();
    return this.priceDataRPC;
  }

  // Get RPC connection for wallet monitoring
  getWalletMonitorRPC() {
    this.rpcStats.walletMonitorRPC.requests++;
    this.rpcStats.walletMonitorRPC.lastUsed = Date.now();
    return this.walletMonitorRPC;
  }

  // Get RPC connection for arbitrage data
  getArbitrageRPC() {
    this.rpcStats.arbitrageRPC.requests++;
    this.rpcStats.arbitrageRPC.lastUsed = Date.now();
    return this.arbitrageRPC;
  }

  // Transaction execution with rate limiting
  async executeTransaction(transaction, signers) {
    console.log('[RPCDistributor] Executing transaction on dedicated RPC...');
    
    try {
      // Rate limit: max 1 transaction per second
      await this.enforceTransactionRateLimit();
      
      const connection = this.getTransactionRPC();
      const signature = await connection.sendTransaction(transaction, signers, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        maxRetries: 3
      });
      
      console.log(`[RPCDistributor] Transaction submitted: ${signature}`);
      
      // Confirm transaction
      const confirmation = await connection.confirmTransaction(signature, 'confirmed');
      
      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }
      
      console.log(`[RPCDistributor] Transaction confirmed: ${signature}`);
      return { success: true, signature };
      
    } catch (error) {
      console.error('[RPCDistributor] Transaction execution error:', error.message);
      this.rpcStats.transactionRPC.errors++;
      return { success: false, error: error.message };
    }
  }

  // Rate limiting for transaction RPC
  async enforceTransactionRateLimit() {
    const now = Date.now();
    const lastUsed = this.rpcStats.transactionRPC.lastUsed;
    
    if (lastUsed && (now - lastUsed) < 1000) {
      const waitTime = 1000 - (now - lastUsed);
      console.log(`[RPCDistributor] Rate limiting: waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  // Get account balance using wallet monitor RPC
  async getAccountBalance(publicKey) {
    try {
      const connection = this.getWalletMonitorRPC();
      const balance = await connection.getBalance(publicKey);
      return balance / 1e9; // Convert to SOL
    } catch (error) {
      console.error('[RPCDistributor] Balance check error:', error.message);
      this.rpcStats.walletMonitorRPC.errors++;
      return 0;
    }
  }

  // Get price data using price data RPC
  async getPriceData(tokenAddress) {
    try {
      const connection = this.getPriceDataRPC();
      const accountInfo = await connection.getAccountInfo(tokenAddress);
      return accountInfo;
    } catch (error) {
      console.error('[RPCDistributor] Price data error:', error.message);
      this.rpcStats.priceDataRPC.errors++;
      return null;
    }
  }

  // Get arbitrage data using arbitrage RPC
  async getArbitrageData() {
    try {
      const connection = this.getArbitrageRPC();
      const slot = await connection.getSlot();
      return { slot, timestamp: Date.now() };
    } catch (error) {
      console.error('[RPCDistributor] Arbitrage data error:', error.message);
      this.rpcStats.arbitrageRPC.errors++;
      return null;
    }
  }

  // Health check for all RPCs
  async performHealthChecks() {
    console.log('[RPCDistributor] Performing health checks on all RPCs...');
    
    const healthChecks = await Promise.allSettled([
      this.transactionRPC.getSlot(),
      this.priceDataRPC.getSlot(),
      this.walletMonitorRPC.getSlot(),
      this.arbitrageRPC.getSlot()
    ]);
    
    const results = {
      transactionRPC: healthChecks[0].status === 'fulfilled',
      priceDataRPC: healthChecks[1].status === 'fulfilled',
      walletMonitorRPC: healthChecks[2].status === 'fulfilled',
      arbitrageRPC: healthChecks[3].status === 'fulfilled'
    };
    
    console.log('[RPCDistributor] Health check results:', results);
    return results;
  }

  // Get RPC statistics
  getRPCStats() {
    return {
      ...this.rpcStats,
      totalRequests: Object.values(this.rpcStats).reduce((sum, stat) => sum + stat.requests, 0),
      totalErrors: Object.values(this.rpcStats).reduce((sum, stat) => sum + stat.errors, 0)
    };
  }
}

module.exports = RPCDistributor;
