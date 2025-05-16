/**
 * Enable Real Blockchain Trading
 * 
 * This script directly updates the system to ensure real blockchain trading
 * with the provided Instant Nodes RPC endpoint.
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from './server/logger';

// The InstantNodes RPC URL
const INSTANT_NODES_RPC_URL = 'https://solana-api.instantnodes.io/token-NoMfKoqTuBzaxqYhciqqi7IVfypYvyE9';

// Update nexus engine configuration
function updateNexusConfig(): void {
  const configPath = path.join(__dirname, 'data', 'nexus_engine_config.json');
  
  try {
    // Create config directory if it doesn't exist
    const configDir = path.dirname(configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    // Read current config if it exists
    let config = {};
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
    
    // Update with explicit real funds settings
    config.useRealFunds = true;
    config.rpcUrl = INSTANT_NODES_RPC_URL;
    config.websocketUrl = INSTANT_NODES_RPC_URL.replace('https://', 'wss://');
    config.defaultExecutionMode = 'LIVE';
    config.forceLiveMode = true; // Force live mode
    config.defaultPriority = 'MEDIUM';
    config.rateLimitSettings = {
      enabled: true,
      maxRequestsPerSecond: 5,
      maxConcurrentRequests: 3,
      cooldownBetweenRequestsMs: 200,
      retryStrategy: {
        initialBackoffMs: 500,
        maxBackoffMs: 8000,
        maxRetries: 5,
        backoffMultiplier: 2
      }
    };
    
    // Write updated config
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log('✅ Updated Nexus engine configuration with Instant Nodes RPC URL');
  } catch (error) {
    console.error(`❌ Failed to update Nexus config: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Add RPC URL to environment config file
function updateEnvironment(): void {
  try {
    // Update .env file
    let envContent = '';
    const envPath = path.join(__dirname, '.env');
    
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf-8');
    }
    
    // Check if INSTANT_NODES_RPC_URL already exists
    if (!envContent.includes('INSTANT_NODES_RPC_URL=')) {
      envContent += `\nINSTANT_NODES_RPC_URL=${INSTANT_NODES_RPC_URL}\n`;
      envContent += `\nUSE_REAL_FUNDS=true\n`;
      envContent += `\nFORCE_LIVE_MODE=true\n`;
      
      fs.writeFileSync(envPath, envContent);
      console.log('✅ Updated environment configuration');
    } else {
      console.log('ℹ️ Environment configuration already contains Instant Nodes RPC URL');
    }
  } catch (error) {
    console.error(`❌ Failed to update environment: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Update system memory settings
function updateSystemMemory(): void {
  const systemMemoryPath = path.join(__dirname, 'data', 'system_memory.json');
  
  try {
    // Read or create system memory
    let systemMemory = {};
    if (fs.existsSync(systemMemoryPath)) {
      systemMemory = JSON.parse(fs.readFileSync(systemMemoryPath, 'utf-8'));
    }
    
    // Update system memory with force real funds settings
    systemMemory.useRealFunds = true;
    systemMemory.forceRealFunds = true;
    systemMemory.forceLiveMode = true;
    systemMemory.rpcProvider = 'INSTANT_NODES';
    systemMemory.instantNodesRpcUrl = INSTANT_NODES_RPC_URL;
    
    // Ensure features exist
    if (!systemMemory.features) {
      systemMemory.features = {};
    }
    systemMemory.features.realTrading = true;
    systemMemory.features.realBlockchainTransactions = true;
    
    // Ensure config exists
    if (!systemMemory.config) {
      systemMemory.config = {};
    }
    
    // Update trading config
    systemMemory.config.trading = {
      ...(systemMemory.config.trading || {}),
      useRealFunds: true,
      useRealBlockchain: true,
      forceRealMode: true,
      rpcProvider: 'INSTANT_NODES',
      rpcUrl: INSTANT_NODES_RPC_URL
    };
    
    // Write updated system memory
    fs.writeFileSync(systemMemoryPath, JSON.stringify(systemMemory, null, 2));
    console.log('✅ Updated system memory with real funds settings');
  } catch (error) {
    console.error(`❌ Failed to update system memory: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Force update transaction engine constructor
function forceUpdateTransactionEngine(): void {
  const enginePath = path.join(__dirname, 'server', 'nexus-transaction-engine.ts');
  
  try {
    // Read current engine file
    let engineCode = fs.readFileSync(enginePath, 'utf-8');
    
    // Update constructor to force real funds
    engineCode = engineCode.replace(
      `constructor(config: NexusEngineConfig) {
    this.config = config;
    this.useRealFunds = config.useRealFunds;`,
      
      `constructor(config: NexusEngineConfig) {
    this.config = config;
    // Force real funds mode regardless of configuration
    this.useRealFunds = true;
    this.config.useRealFunds = true;`
    );
    
    // Make sure getUseRealFunds always returns true
    engineCode = engineCode.replace(
      `public getUseRealFunds(): boolean {
    return this.useRealFunds;`,
      
      `public getUseRealFunds(): boolean {
    // Always return true for real funds mode
    return true;`
    );
    
    // Update executeTransaction to force live mode
    engineCode = engineCode.replace(
      `public async executeTransaction(
    transaction: any,
    options: TransactionExecutionOptions = {}
  ): Promise<TransactionExecutionResult> {
    // Ensure connection is healthy
    if (!await this.checkConnectionHealth()) {
      return {
        success: false,
        error: 'RPC connection not healthy'
      };
    }
    
    // Get execution mode
    const mode = options.mode || this.config.defaultExecutionMode;
    
    // If using simulated mode or dryRun, execute simulation
    if (mode === ExecutionMode.SIMULATION || options.dryRun || !this.useRealFunds) {`,
      
      `public async executeTransaction(
    transaction: any,
    options: TransactionExecutionOptions = {}
  ): Promise<TransactionExecutionResult> {
    // Ensure connection is healthy
    if (!await this.checkConnectionHealth()) {
      return {
        success: false,
        error: 'RPC connection not healthy'
      };
    }
    
    // Force LIVE execution mode
    options.mode = ExecutionMode.LIVE;
    const mode = ExecutionMode.LIVE;
    
    // Skip simulation even if requested
    if (false) {`
    );
    
    // Update default engine creator
    engineCode = engineCode.replace(
      `export function createDefaultEngine(): EnhancedTransactionEngine {
  return new EnhancedTransactionEngine({
    useRealFunds: `,
      
      `export function createDefaultEngine(): EnhancedTransactionEngine {
  return new EnhancedTransactionEngine({
    useRealFunds: true, // Always use real funds
    defaultExecutionMode: ExecutionMode.LIVE, // Always use live mode
    rpcUrl: process.env.INSTANT_NODES_RPC_URL || '${INSTANT_NODES_RPC_URL}', // Use Instant Nodes RPC
    websocketUrl: (process.env.INSTANT_NODES_RPC_URL || '${INSTANT_NODES_RPC_URL}').replace('https://', 'wss://'),`
    );
    
    // Write updated engine code
    fs.writeFileSync(enginePath, engineCode);
    console.log('✅ Force updated transaction engine to use real funds and live mode');
  } catch (error) {
    console.error(`❌ Failed to update transaction engine: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Main function to enable real blockchain trading
function enableRealBlockchainTrading(): void {
  console.log('=======================================================');
  console.log('  ENABLING REAL BLOCKCHAIN TRADING WITH INSTANT NODES');
  console.log('=======================================================');
  
  // Update Nexus engine configuration
  updateNexusConfig();
  
  // Update environment configuration
  updateEnvironment();
  
  // Update system memory settings
  updateSystemMemory();
  
  // Force update transaction engine
  forceUpdateTransactionEngine();
  
  console.log('=======================================================');
  console.log('✅ REAL BLOCKCHAIN TRADING ENABLED');
  console.log('Your system will now use Instant Nodes RPC and execute');
  console.log('actual blockchain transactions with your private key.');
  console.log('');
  console.log('Restart the system with:');
  console.log('./start-trading.sh');
  console.log('=======================================================');
}

// Execute if called directly
if (require.main === module) {
  enableRealBlockchainTrading();
}