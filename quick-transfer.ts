
/**
 * Quick Transfer Commands
 * 
 * Simple commands for common transfer operations
 */

import { TransferUtility } from './transfer-funds';

const transferUtil = new TransferUtility();

// Common wallet addresses
const WALLETS = {
  HX: 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb',
  HPN: 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK', 
  PHANTOM: '2Jf2tj34q3zh3MJQ5dgRVLeBCfV4LqiAkWTWeHQRvCaH'
};

const HPN_PRIVATE_KEY = 'b2f40c191bcafb0ad45a2574da2a16a586a59736e1d7c208b1c96965d478f94af37637bb9e234b8aad9427aba01b590669aee952bb312ac1b670c341389053da';

async function main() {
  console.log('🚀 QUICK TRANSFER UTILITY');
  console.log('========================');

  // Show current balances
  await transferUtil.showAllBalances();

  // Get command line arguments
  const command = process.argv[2];
  const amount = process.argv[3];

  switch (command) {
    case 'hpn-to-phantom':
      if (amount && amount !== 'max') {
        await transferUtil.transferSOL(HPN_PRIVATE_KEY, WALLETS.PHANTOM, parseFloat(amount));
      } else {
        await transferUtil.transferMax(HPN_PRIVATE_KEY, WALLETS.PHANTOM);
      }
      break;

    case 'check':
      // Already shown above
      break;

    case 'help':
    default:
      console.log('\nAvailable commands:');
      console.log('• npm run transfer check              - Check all balances');
      console.log('• npm run transfer hpn-to-phantom 1.0 - Transfer 1 SOL from HPN to Phantom');
      console.log('• npm run transfer hpn-to-phantom max - Transfer max from HPN to Phantom');
      break;
  }
}

main().catch(console.error);
