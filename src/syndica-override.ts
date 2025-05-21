// Patch all RPC connections to use Syndica only
import { Connection } from '@solana/web3.js';
import path from 'path';
import fs from 'fs';

// Enforce Syndica-only mode
const SYNDICA_URL = 'https://solana-api.syndica.io/rpc';
const HP_WALLET = 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';

console.log('🔄 PATCHING: Forcing Syndica-only mode...');

// Force override process.env with Syndica-only values
process.env.RPC_URL = SYNDICA_URL;
process.env.SOLANA_RPC = SYNDICA_URL;
process.env.WEBSOCKET_URL = 'wss://solana-api.syndica.io/rpc';
process.env.USE_SYNDICA = 'true';
process.env.USE_ALCHEMY = 'false';
process.env.USE_HELIUS = 'false';
process.env.USE_INSTANT_NODES = 'false';
process.env.PRIMARY_PROVIDER = 'syndica';
process.env.DISABLE_INSTANT_NODES = 'true';
process.env.DISABLE_MULTI_PROVIDER = 'true';
process.env.FORCE_SYNDICA_ONLY = 'true';
process.env.SYSTEM_WALLET = HP_WALLET;
process.env.TRADING_WALLET = HP_WALLET;
process.env.MAIN_WALLET = HP_WALLET;
process.env.WALLET_ADDRESS = HP_WALLET;

// Create a singleton Syndica connection to be used everywhere
const syndicaConnection = new Connection(SYNDICA_URL, {
  commitment: 'confirmed',
  disableRetryOnRateLimit: false,
  confirmTransactionInitialTimeout: 60000,
});

// Export patched functions
export function getSyndicaConnection() {
  return syndicaConnection;
}

// Monkey-patch the global Connection constructor if loaded directly
try {
  const originalConnection = global.Connection || Connection;
  
  // Replace the Connection constructor globally
  global.Connection = function() {
    console.log('🔄 Connection constructor called - forcing Syndica connection');
    return syndicaConnection;
  };
  
  // Copy all properties from the original Connection
  Object.assign(global.Connection, originalConnection);
  
  console.log('✅ Successfully patched global Connection constructor');
} catch (error) {
  console.error('❌ Failed to patch global Connection:', error);
}

// Function to patch RPC Connection Manager if it exists
export function patchConnectionManager() {
  console.log('🔄 Attempting to patch RPC Connection Manager...');
  
  try {
    const managerPath = path.resolve('./server/lib/rpcConnectionManager.js');
    
    if (fs.existsSync(managerPath)) {
      // Create backup of the file
      fs.copyFileSync(managerPath, managerPath + '.backup');
      
      // Read the file
      let content = fs.readFileSync(managerPath, 'utf8');
      
      // Replace all connection creation with Syndica-only
      content = content.replace(
        /new Connection([^)]+)/g, 
        `new Connection('${SYNDICA_URL}', {
          commitment: 'confirmed',
          disableRetryOnRateLimit: false,
          confirmTransactionInitialTimeout: 60000,
        })`
      );
      
      // Write the modified file
      fs.writeFileSync(managerPath, content);
      console.log('✅ Successfully patched RPC Connection Manager');
    } else {
      console.log('⚠️ RPC Connection Manager not found at expected path');
    }
  } catch (error) {
    console.error('❌ Failed to patch RPC Connection Manager:', error);
  }
}

// Call patch function
patchConnectionManager();

console.log('✅ Syndica-only mode fully configured');

// Export the patched connection
export default syndicaConnection;
