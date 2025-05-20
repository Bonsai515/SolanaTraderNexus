/**
 * Direct Trading Wallet Fix
 * 
 * This script directly modifies the activate-live-trading.ts file to force
 * the use of HP wallet instead of HX wallet.
 */

import * as fs from 'fs';

console.log('=== DIRECT TRADING WALLET FIX ===');

const TRADING_WALLET = 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';
const HX_WALLET = 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb';

// Step 1: Modify activate-live-trading.ts file
const activateLiveTradingPath = './activate-live-trading.ts';

if (fs.existsSync(activateLiveTradingPath)) {
  console.log('Modifying activate-live-trading.ts to use HP wallet...');
  
  let content = fs.readFileSync(activateLiveTradingPath, 'utf8');
  
  // Replace all instances of HX wallet with HP wallet
  const updatedContent = content.replace(
    new RegExp(HX_WALLET, 'g'),
    TRADING_WALLET
  );
  
  // Write updated content
  fs.writeFileSync(activateLiveTradingPath, updatedContent);
  console.log('✅ Modified activate-live-trading.ts');
}

// Step 2: Create a quick environment configuration override
const envOverridePath = './.env.override';
const envOverrideContent = `
# Trading Wallet Override
SYSTEM_WALLET=${TRADING_WALLET}
TRADING_WALLET=${TRADING_WALLET}
MAIN_WALLET=${TRADING_WALLET}
WALLET_ADDRESS=${TRADING_WALLET}
`;

fs.writeFileSync(envOverridePath, envOverrideContent);
console.log('✅ Created .env.override with HP wallet');

// Step 3: Create startup script that uses override
const startupScript = `#!/bin/bash
# Start trading with HP wallet override

echo "========================================"
echo "    STARTING WITH HP WALLET OVERRIDE    "
echo "========================================"

# Stop running processes
pkill -f "ts-node" || true
pkill -f "npx tsx" || true
pkill -f "activate-" || true
sleep 2

# Export environment variables directly
export SYSTEM_WALLET=${TRADING_WALLET}
export TRADING_WALLET=${TRADING_WALLET}
export MAIN_WALLET=${TRADING_WALLET}
export WALLET_ADDRESS=${TRADING_WALLET}
export USE_HELIUS=true
export USE_INSTANT_NODES=false
export RATE_LIMIT_FIX=true
export MAX_REQUESTS_PER_SECOND=10
export USE_AGGRESSIVE_CACHING=true

# Run directly with HP wallet
echo "Starting trading system with HP wallet (${TRADING_WALLET})..."
npx tsx activate-live-trading.ts

echo "System started with HP wallet"
echo "========================================"
`;

fs.writeFileSync('./start-with-hp-wallet.sh', startupScript);
fs.chmodSync('./start-with-hp-wallet.sh', 0o755);
console.log('✅ Created start-with-hp-wallet.sh');

console.log('\n=== DIRECT WALLET FIX COMPLETE ===');
console.log(`Trading wallet set to: ${TRADING_WALLET}`);
console.log('To start the system with HP wallet, run:');
console.log('./start-with-hp-wallet.sh');