
<change_summary>Create simple runner script for USDC conversion and transfer</change_summary>
#!/usr/bin/env npx tsx

/**
 * Simple runner for USDC to SOL conversion and transfer
 */

import { HPNUSDCToSOLConverter } from './convert-usdc-to-sol-and-transfer';

console.log('🚀 Starting USDC to SOL conversion and transfer process...');
console.log('');

const converter = new HPNUSDCToSOLConverter();
converter.convertAndTransfer()
  .then(() => {
    console.log('✅ Process completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Process failed:', error.message);
    process.exit(1);
  });
