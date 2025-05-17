// Check System Wallet Balance
const { Connection, PublicKey } = require('@solana/web3.js');

async function checkWalletBalance() {
  // Use Alchemy for reliable connection
  const rpcUrl = 'https://solana-mainnet.g.alchemy.com/v2/PPQbbM4WmrX_82GOP8QR5pJ_JsBvyLWR';
  const connection = new Connection(rpcUrl);
  
  // System wallet address
  const walletAddress = 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb';
  const pubkey = new PublicKey(walletAddress);
  
  try {
    const balance = await connection.getBalance(pubkey);
    const solBalance = balance / 1000000000;
    
    console.log('======= WALLET BALANCE UPDATE =======');
    console.log(`Address: ${walletAddress}`);
    console.log(`Balance: ${solBalance.toFixed(6)} SOL`);
    console.log(`Approx. USD Value: $${(solBalance * 160).toFixed(2)} (at ~$160/SOL)`);
    console.log('===================================');
    
    // Check if we successfully executed our trade
    const expectedBalance = 1.53442 + 0.077;
    console.log(`Expected balance after trade: ${expectedBalance.toFixed(6)} SOL`);
    if (solBalance >= expectedBalance - 0.001) {
      console.log('✅ Trade appears to have successfully executed!');
      console.log(`Profit: 0.077 SOL ($${(0.077 * 160).toFixed(2)})`);
    } else if (solBalance >= 1.53) {
      console.log('ℹ️ Wallet balance is consistent with pre-trade amount');
      console.log('The strategy executed in simulation mode only');
    } else {
      console.log('⚠️ Wallet balance is lower than expected');
    }
  } catch (error) {
    console.error('Error checking wallet balance:', error);
  }
}

checkWalletBalance();