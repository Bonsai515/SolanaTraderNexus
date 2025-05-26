
/**
 * Run mSOL to SOL Conversion Script
 * 
 * Simple execution script for converting $20 mSOL to SOL and transferring to Phantom
 */

import { MSOLToSOLConverter } from './convert-usdc-to-sol-and-transfer';

async function runConversion(): Promise<void> {
  console.log('🚀 Starting mSOL to SOL conversion process...');
  console.log('Target: Convert $20 worth of mSOL to SOL');
  console.log('Destination: 2Jf2tj34q3zh3MJQ5dgRVLeBCfV4LqiAkWTWeHQRvCaH');
  console.log('');

  try {
    const converter = new MSOLToSOLConverter();
    await converter.convertAndTransfer();
    
    console.log('\n✅ Conversion process completed!');
  } catch (error: any) {
    console.error('❌ Conversion failed:', error.message);
  }
}

// Run the conversion
runConversion().catch(console.error);
