/**
 * Main Nexus Pro Engine Solana Integration
 * Entry point for TypeScript Solana executor
 */

import { NexusProEngineIntegration } from './NexusIntegration';

// Configuration for Nexus Pro Engine
const nexusConfig = {
  tradingWalletAddress: 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK',
  profitWalletAddress: '31kB9NF5fTVoDAf1Tu7EcMNFx8gUHHk4cuL56bcFxk2e',
  rpcEndpoint: 'https://solana-api.syndica.io/access-token/UEjTFkyf1vQ99VGfY5Y74GXkUckitTvQodQV2tw9jKPmzNL1q7LCvdcv8Adnbqm9/rpc',
  wsEndpoint: 'wss://solana-api.syndica.io/access-token/UEjTFkyf1vQ99VGfY5Y74GXkUckitTvQodQV2tw9jKPmzNL1q7LCvdcv8Adnbqm9/ws'
};

async function startNexusProEngine() {
  console.log('=== STARTING NEXUS PRO ENGINE SOLANA INTEGRATION ===');
  
  try {
    // Initialize Nexus Pro Engine integration
    const nexusEngine = new NexusProEngineIntegration(nexusConfig);
    
    // Initialize the engine
    const initialized = await nexusEngine.initializeNexusEngine();
    
    if (!initialized) {
      throw new Error('Failed to initialize Nexus Pro Engine');
    }
    
    console.log('✅ Nexus Pro Engine initialized successfully');
    
    // Execute strategy
    await nexusEngine.executeNexusStrategy();
    
    // Display stats
    const stats = nexusEngine.getNexusStats();
    console.log('📊 Nexus Pro Engine Stats:', stats);
    
    // Keep running for continuous operation
    setInterval(async () => {
      await nexusEngine.executeNexusStrategy();
    }, 30000); // Execute every 30 seconds
    
  } catch (error) {
    console.error('❌ Nexus Pro Engine startup failed:', error);
    process.exit(1);
  }
}

// Export for external use
export { NexusProEngineIntegration };

// Start if called directly
if (require.main === module) {
  startNexusProEngine();
}
