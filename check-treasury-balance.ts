
/**
 * Check Treasury Balance
 * 
 * Simple script to check the current balance of the treasury account
 */

import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

// Treasury address from your codebase
const TREASURY_ADDRESS = '2Jf2tj34q3zh3MJQ5dgRVLeBCfV4LqiAkWTWeHQRvCaH';

async function checkTreasuryBalance() {
  console.log('🏦 CHECKING TREASURY BALANCE...');
  console.log('='.repeat(50));
  
  try {
    // Create connection to Solana
    const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
    
    // Get treasury account balance
    const treasuryPubkey = new PublicKey(TREASURY_ADDRESS);
    const balance = await connection.getBalance(treasuryPubkey);
    const balanceSOL = balance / LAMPORTS_PER_SOL;
    
    console.log(`📍 Treasury Address: ${TREASURY_ADDRESS}`);
    console.log(`💰 Current Balance: ${balanceSOL.toLocaleString()} SOL`);
    console.log(`💵 USD Value (approx): $${(balanceSOL * 200).toLocaleString()}`);
    console.log(`🔢 Raw Lamports: ${balance.toLocaleString()}`);
    
    // Get account info for additional details
    const accountInfo = await connection.getAccountInfo(treasuryPubkey);
    if (accountInfo) {
      console.log(`👤 Account Owner: ${accountInfo.owner.toString()}`);
      console.log(`📊 Account Executable: ${accountInfo.executable}`);
    }
    
    console.log('='.repeat(50));
    
    if (balanceSOL > 0) {
      console.log('✅ Treasury has funds available');
    } else {
      console.log('❌ Treasury appears to be empty');
    }
    
  } catch (error) {
    console.error('❌ Error checking treasury balance:', error);
  }
}

// Run the check
checkTreasuryBalance().catch(console.error);
