/**
 * Transfer Funds from Main Wallet to Trading Wallet
 * 
 * This script transfers funds from the wallet with 9.9 SOL to
 * Trading Wallet 2 where we have a confirmed private key.
 */

import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL, SystemProgram, Transaction } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

// Wallet addresses
const FROM_WALLET = 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb'; // Wallet with 9.9 SOL
const TO_WALLET = 'HLG44WF9VYquMGJGFoKP33D8H1iRTC2t8be6DAD5Wtqg';   // Trading Wallet 2 (confirmed key)

// Trading wallet 2 details (where we have a confirmed private key)
const TRADING_WALLET = {
  publicKey: 'HLG44WF9VYquMGJGFoKP33D8H1iRTC2t8be6DAD5Wtqg',
  privateKey: 'abbe6e9fb2734ace98c7047a3f2b5bd685f968681f7d1f637ac7bdd371fdbeb9f2aa0be1913871cf01070611b8417678e6f0aa5feb444e899f7cd85ee5cbc4bb',
  label: 'Trading Wallet 2'
};

// Paths
const DATA_DIR = './data';
const WALLETS_JSON_PATH = path.join(DATA_DIR, 'wallets.json');

// RPC configuration
const RPC_URL = 'https://solana-api.instantnodes.io/token-NoMfKoqTuBzaxqYhciqqi7IVfypYvyE9';
const BACKUP_RPC = 'https://api.mainnet-beta.solana.com';

// Create keypair from hex private key
function createKeypairFromHexPrivateKey(hexPrivateKey: string): Keypair {
  try {
    const privateKeyBuffer = Buffer.from(hexPrivateKey, 'hex');
    
    if (privateKeyBuffer.length !== 64) {
      throw new Error(`Invalid private key length: ${privateKeyBuffer.length}`);
    }
    
    return Keypair.fromSecretKey(privateKeyBuffer);
  } catch (error) {
    console.error('Failed to create keypair:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

// Check wallet balance
async function checkWalletBalance(pubkeyString: string): Promise<number> {
  try {
    console.log(`Checking balance for ${pubkeyString}...`);
    
    const pubkey = new PublicKey(pubkeyString);
    const connection = new Connection(RPC_URL, 'confirmed');
    const balance = await connection.getBalance(pubkey);
    const solBalance = balance / LAMPORTS_PER_SOL;
    
    console.log(`Wallet balance: ${solBalance} SOL`);
    return solBalance;
  } catch (error) {
    console.error('Failed to check wallet balance with primary RPC:', error instanceof Error ? error.message : String(error));
    
    // Try with backup RPC
    try {
      console.log(`Trying backup RPC for balance check...`);
      const pubkey = new PublicKey(pubkeyString);
      const connection = new Connection(BACKUP_RPC, 'confirmed');
      const balance = await connection.getBalance(pubkey);
      const solBalance = balance / LAMPORTS_PER_SOL;
      
      console.log(`Wallet balance: ${solBalance} SOL`);
      return solBalance;
    } catch (backupError) {
      console.error('Failed backup balance check:', backupError instanceof Error ? backupError.message : String(backupError));
      return 0;
    }
  }
}

// Try to find the private key for the from wallet in wallets.json
async function findFromWalletKey(): Promise<string | null> {
  try {
    if (fs.existsSync(WALLETS_JSON_PATH)) {
      const wallets = JSON.parse(fs.readFileSync(WALLETS_JSON_PATH, 'utf8'));
      
      const fromWallet = wallets.find((wallet: any) => wallet.publicKey === FROM_WALLET);
      
      if (fromWallet && fromWallet.privateKey) {
        console.log(`Found private key for ${FROM_WALLET} in wallets.json`);
        return fromWallet.privateKey;
      }
    }
    
    console.log(`Could not find private key for ${FROM_WALLET} in wallets.json`);
    return null;
  } catch (error) {
    console.error('Error looking for wallet private key:', error instanceof Error ? error.message : String(error));
    return null;
  }
}

// Find all wallet references in the codebase
async function findWalletReferences(): Promise<void> {
  console.log(`Searching for references to wallet ${FROM_WALLET}...`);
  
  try {
    const result = await new Promise<string>((resolve, reject) => {
      const { exec } = require('child_process');
      exec(`find . -type f -name "*.json" -o -name "*.ts" -o -name "*.js" | xargs grep -l "${FROM_WALLET}" 2>/dev/null`, 
        (error: Error | null, stdout: string, stderr: string) => {
          if (error && error.message.indexOf('No such file or directory') === -1) {
            reject(error);
            return;
          }
          resolve(stdout);
        });
    });
    
    if (result.trim()) {
      console.log('Found references in these files:');
      console.log(result);
    } else {
      console.log('No additional references found');
    }
  } catch (error) {
    console.error('Error searching for wallet references:', error instanceof Error ? error.message : String(error));
  }
}

// Transfer function if private key is available
async function transferWithPrivateKey(fromPrivateKey: string, amount: number): Promise<string | null> {
  try {
    // Create connection
    const connection = new Connection(RPC_URL, 'confirmed');
    
    // Create keypair from from wallet private key
    const fromKeypair = createKeypairFromHexPrivateKey(fromPrivateKey);
    
    // Check that the public key matches
    if (fromKeypair.publicKey.toString() !== FROM_WALLET) {
      console.error('ERROR: Public key mismatch!');
      console.error(`Derived: ${fromKeypair.publicKey.toString()}`);
      console.error(`Expected: ${FROM_WALLET}`);
      return null;
    }
    
    // Create to wallet public key
    const toPublicKey = new PublicKey(TO_WALLET);
    
    // Check balance before transfer
    const balance = await checkWalletBalance(FROM_WALLET);
    
    // Ensure balance is sufficient
    if (balance < amount) {
      console.error(`Insufficient balance. Have ${balance} SOL, trying to transfer ${amount} SOL`);
      return null;
    }
    
    console.log(`Transferring ${amount} SOL from ${FROM_WALLET} to ${TO_WALLET}...`);
    
    // Create transfer transaction
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: fromKeypair.publicKey,
        toPubkey: toPublicKey,
        lamports: amount * LAMPORTS_PER_SOL
      })
    );
    
    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = fromKeypair.publicKey;
    
    // Sign transaction
    transaction.sign(fromKeypair);
    
    // Send transaction
    const signature = await connection.sendRawTransaction(transaction.serialize());
    
    console.log(`Transaction sent! Signature: ${signature}`);
    console.log(`Confirming transaction...`);
    
    // Confirm transaction
    const confirmation = await connection.confirmTransaction(signature, 'confirmed');
    
    if (confirmation.value.err) {
      console.error('Transaction failed:', confirmation.value.err);
      return null;
    }
    
    console.log(`Transaction confirmed!`);
    console.log(`Successfully transferred ${amount} SOL from ${FROM_WALLET} to ${TO_WALLET}`);
    
    // Check balances after transfer
    await checkWalletBalance(FROM_WALLET);
    await checkWalletBalance(TO_WALLET);
    
    return signature;
  } catch (error) {
    console.error('Error transferring funds:', error instanceof Error ? error.message : String(error));
    return null;
  }
}

// Main function
async function main() {
  console.log('=============================================');
  console.log('🚀 TRANSFERRING FUNDS BETWEEN WALLETS');
  console.log('=============================================\n');
  
  try {
    // Check initial balances
    console.log('Checking initial wallet balances...');
    const fromBalance = await checkWalletBalance(FROM_WALLET);
    const toBalance = await checkWalletBalance(TO_WALLET);
    
    if (fromBalance <= 0) {
      console.error(`Source wallet ${FROM_WALLET} has no funds (${fromBalance} SOL)`);
      return false;
    }
    
    // Look for the private key of the from wallet
    const fromPrivateKey = await findFromWalletKey();
    
    if (fromPrivateKey) {
      // We found the private key, attempt the transfer
      // Transfer slightly less than the full balance to account for fees
      const transferAmount = fromBalance > 0.01 ? fromBalance - 0.01 : 0;
      
      if (transferAmount <= 0) {
        console.error('Not enough balance to transfer after accounting for fees');
        return false;
      }
      
      const signature = await transferWithPrivateKey(fromPrivateKey, transferAmount);
      
      if (signature) {
        console.log(`\n✅ FUNDS TRANSFER COMPLETE`);
        console.log(`Transferred ${transferAmount} SOL from ${FROM_WALLET} to ${TO_WALLET}`);
        console.log(`Transaction signature: ${signature}`);
        return true;
      } else {
        console.error('❌ FUNDS TRANSFER FAILED');
        return false;
      }
    } else {
      // We couldn't find the private key, look for references
      console.log(`\nCould not find private key for wallet ${FROM_WALLET}`);
      console.log('Searching for wallet references in the codebase...');
      
      await findWalletReferences();
      
      console.log('\n❓ TRANSFER NOT POSSIBLE WITHOUT PRIVATE KEY');
      console.log(`Unable to transfer ${fromBalance} SOL from ${FROM_WALLET} to ${TO_WALLET}`);
      console.log(`To transfer funds, you need the private key for ${FROM_WALLET}`);
      
      return false;
    }
  } catch (error) {
    console.error('Error in main function:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

// Run the script
main();
/**
 * Comprehensive Transfer Utility
 * 
 * Handles transfers between your wallets with proper validation and confirmation
 */

import { 
  Connection, 
  Keypair, 
  PublicKey, 
  Transaction, 
  SystemProgram, 
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction
} from '@solana/web3.js';

// Wallet configurations
const WALLETS = {
  HX: 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb',
  HPN: 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK',
  PHANTOM: '2Jf2tj34q3zh3MJQ5dgRVLeBCfV4LqiAkWTWeHQRvCaH'
};

// Private keys (from your existing files)
const PRIVATE_KEYS = {
  HPN: 'b2f40c191bcafb0ad45a2574da2a16a586a59736e1d7c208b1c96965d478f94af37637bb9e234b8aad9427aba01b590669aee952bb312ac1b670c341389053da',
  // Add other private keys as needed
};

class TransferUtility {
  private connection: Connection;

  constructor() {
    this.connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
  }

  /**
   * Check wallet balance
   */
  async checkBalance(walletAddress: string): Promise<number> {
    try {
      const publicKey = new PublicKey(walletAddress);
      const balance = await this.connection.getBalance(publicKey);
      return balance / LAMPORTS_PER_SOL;
    } catch (error) {
      console.error(`Error checking balance for ${walletAddress}:`, error);
      return 0;
    }
  }

  /**
   * Transfer SOL between wallets
   */
  async transferSOL(
    fromWalletKey: string,
    toWalletAddress: string,
    amount: number,
    memo?: string
  ): Promise<string | null> {
    try {
      console.log(`\n🔄 TRANSFERRING ${amount} SOL`);
      console.log(`From: ${fromWalletKey.length > 10 ? fromWalletKey.substring(0, 6) + '...' : 'Private Key'}`);
      console.log(`To: ${toWalletAddress}`);
      if (memo) console.log(`Memo: ${memo}`);

      // Create keypair from private key
      const fromKeypair = Keypair.fromSecretKey(Buffer.from(fromWalletKey, 'hex'));
      const toPublicKey = new PublicKey(toWalletAddress);

      // Check sender balance
      const senderBalance = await this.checkBalance(fromKeypair.publicKey.toString());
      console.log(`Sender balance: ${senderBalance.toFixed(6)} SOL`);

      if (senderBalance < amount + 0.001) { // Reserve for fees
        console.log(`❌ Insufficient balance. Need ${amount + 0.001} SOL, have ${senderBalance} SOL`);
        return null;
      }

      // Create transaction
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: fromKeypair.publicKey,
          toPubkey: toPublicKey,
          lamports: Math.floor(amount * LAMPORTS_PER_SOL)
        })
      );

      // Get recent blockhash
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = fromKeypair.publicKey;

      // Send and confirm transaction
      console.log('📤 Sending transaction...');
      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [fromKeypair],
        { commitment: 'confirmed' }
      );

      console.log(`✅ Transfer successful!`);
      console.log(`Transaction: ${signature}`);
      console.log(`View on Solscan: https://solscan.io/tx/${signature}`);

      return signature;
    } catch (error) {
      console.error('❌ Transfer failed:', error);
      return null;
    }
  }

  /**
   * Transfer maximum amount (leaving small amount for fees)
   */
  async transferMax(
    fromWalletKey: string,
    toWalletAddress: string,
    reserveForFees: number = 0.001
  ): Promise<string | null> {
    try {
      const fromKeypair = Keypair.fromSecretKey(Buffer.from(fromWalletKey, 'hex'));
      const balance = await this.checkBalance(fromKeypair.publicKey.toString());
      
      if (balance <= reserveForFees) {
        console.log(`❌ Balance too low for transfer. Balance: ${balance} SOL`);
        return null;
      }

      const transferAmount = balance - reserveForFees;
      return await this.transferSOL(fromWalletKey, toWalletAddress, transferAmount, 'Max transfer');
    } catch (error) {
      console.error('❌ Max transfer failed:', error);
      return null;
    }
  }

  /**
   * Show all wallet balances
   */
  async showAllBalances(): Promise<void> {
    console.log('\n💰 WALLET BALANCES');
    console.log('='.repeat(50));

    for (const [name, address] of Object.entries(WALLETS)) {
      const balance = await this.checkBalance(address);
      const usdValue = balance * 200; // Approximate SOL price
      console.log(`${name.padEnd(8)}: ${balance.toFixed(6)} SOL ($${usdValue.toFixed(2)})`);
    }
    console.log('='.repeat(50));
  }

  /**
   * Interactive transfer menu
   */
  async interactiveTransfer(): Promise<void> {
    console.log('\n🔄 INTERACTIVE TRANSFER UTILITY');
    console.log('Available operations:');
    console.log('1. Check all balances');
    console.log('2. Transfer specific amount');
    console.log('3. Transfer maximum amount');
    console.log('4. Quick transfers (presets)');

    // For demo, let's show balances and suggest common transfers
    await this.showAllBalances();

    console.log('\n📋 COMMON TRANSFER OPTIONS:');
    console.log('• HPN → Phantom: Consolidate trading funds');
    console.log('• HX → Phantom: Access treasury funds');
    console.log('• Max transfers to consolidate all funds');
  }

  /**
   * Quick preset transfers
   */
  async quickTransfers(): Promise<void> {
    console.log('\n⚡ QUICK TRANSFER PRESETS');
    
    // Example: Transfer from HPN to Phantom
    if (PRIVATE_KEYS.HPN) {
      console.log('\n1. HPN → Phantom (Max Transfer)');
      const signature = await this.transferMax(PRIVATE_KEYS.HPN, WALLETS.PHANTOM);
      if (signature) {
        console.log('✅ HPN to Phantom transfer completed');
      }
    }

    // Show updated balances
    await this.showAllBalances();
  }
}

// CLI Usage
async function main(): Promise<void> {
  const transferUtil = new TransferUtility();
  
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'balance':
    case 'balances':
      await transferUtil.showAllBalances();
      break;
      
    case 'transfer':
      if (args.length >= 3) {
        const amount = parseFloat(args[1]);
        const toAddress = args[2];
        const fromKey = PRIVATE_KEYS.HPN; // Default to HPN
        
        if (fromKey && amount > 0) {
          await transferUtil.transferSOL(fromKey, toAddress, amount);
        } else {
          console.log('❌ Invalid transfer parameters');
        }
      } else {
        console.log('Usage: npm run transfer <amount> <to_address>');
      }
      break;
      
    case 'max':
      if (args[1]) {
        const toAddress = args[1];
        const fromKey = PRIVATE_KEYS.HPN; // Default to HPN
        
        if (fromKey) {
          await transferUtil.transferMax(fromKey, toAddress);
        }
      } else {
        console.log('Usage: npm run transfer max <to_address>');
      }
      break;
      
    case 'quick':
      await transferUtil.quickTransfers();
      break;
      
    case 'interactive':
    default:
      await transferUtil.interactiveTransfer();
      break;
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { TransferUtility };
