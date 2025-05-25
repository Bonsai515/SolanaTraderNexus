/**
 * Verify HX Private Key from Environment
 * 
 * Tests if the WALLET_PRIVATE_KEY environment variable
 * generates the HX wallet address
 */

import { 
  Connection, 
  Keypair, 
  LAMPORTS_PER_SOL
} from '@solana/web3.js';

async function verifyHXPrivateKey(): Promise<void> {
  const HX_WALLET_ADDRESS = 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb';
  const privateKeyHex = process.env.WALLET_PRIVATE_KEY;
  
  console.log('🔍 VERIFYING HX WALLET PRIVATE KEY');
  console.log(`🎯 Target Address: ${HX_WALLET_ADDRESS}`);
  console.log('='.repeat(50));
  
  if (!privateKeyHex) {
    console.log('❌ WALLET_PRIVATE_KEY environment variable not found');
    return;
  }
  
  try {
    // Create keypair from hex private key
    const privateKeyBuffer = Buffer.from(privateKeyHex, 'hex');
    const keypair = Keypair.fromSecretKey(new Uint8Array(privateKeyBuffer));
    
    const generatedAddress = keypair.publicKey.toString();
    console.log(`🔑 Generated Address: ${generatedAddress}`);
    
    if (generatedAddress === HX_WALLET_ADDRESS) {
      console.log('\n🎉 SUCCESS! Private key matches HX wallet!');
      
      // Check balance
      const connection = new Connection('https://powerful-shy-telescope.solana-mainnet.quiknode.pro/8458b7fd0c7ededea5ed518b0ce21d55f5f162f8/', 'confirmed');
      const balance = await connection.getBalance(keypair.publicKey);
      const solBalance = balance / LAMPORTS_PER_SOL;
      
      console.log(`💰 Current Balance: ${solBalance.toFixed(6)} SOL`);
      
      console.log('\n👻 PHANTOM WALLET IMPORT READY!');
      console.log('='.repeat(50));
      console.log('🎯 To import this wallet into Phantom:');
      console.log('');
      console.log('1. Open Phantom wallet extension');
      console.log('2. Click "Add/Connect Wallet" (+ button)');
      console.log('3. Select "Import Private Key"');
      console.log('4. Paste this private key:');
      console.log('');
      console.log(`🔑 ${privateKeyHex}`);
      console.log('');
      console.log('5. Your wallet will be imported with 1.534420 SOL!');
      console.log('='.repeat(50));
      
      // Save export data
      const exportData = {
        walletAddress: HX_WALLET_ADDRESS,
        privateKeyHex: privateKeyHex,
        balance: solBalance,
        source: 'WALLET_PRIVATE_KEY environment variable',
        exportedAt: new Date().toISOString(),
        verified: true,
        phantomReady: true
      };
      
      require('fs').writeFileSync('./hx-phantom-import-ready.json', JSON.stringify(exportData, null, 2));
      console.log('✅ Export data saved to hx-phantom-import-ready.json');
      
    } else {
      console.log('\n❌ Private key does not match HX wallet address');
      console.log(`Expected: ${HX_WALLET_ADDRESS}`);
      console.log(`Got: ${generatedAddress}`);
    }
    
  } catch (error) {
    console.log(`❌ Error creating keypair: ${error.message}`);
  }
}

verifyHXPrivateKey().catch(console.error);