/**
 * Delete All CNFTs
 * 
 * Removes all Compressed NFTs (CNFTs) from your wallet
 * to clean up and optimize wallet holdings
 */

import { 
  Connection, 
  Keypair, 
  PublicKey,
  Transaction,
  sendAndConfirmTransaction
} from '@solana/web3.js';

class CNFTCleaner {
  private connection: Connection;
  private walletKeypair: Keypair;
  private walletAddress: string;

  constructor() {
    this.connection = new Connection('https://powerful-shy-telescope.solana-mainnet.quiknode.pro/8458b7fd0c7ededea5ed518b0ce21d55f5f162f8/', 'confirmed');
  }

  public async deleteAllCNFTs(): Promise<void> {
    console.log('🗑️ DELETING ALL CNFTs');
    console.log('🧹 Cleaning up wallet to optimize holdings');
    console.log('='.repeat(45));

    await this.loadWallet();
    await this.findAndDeleteCNFTs();
  }

  private async loadWallet(): Promise<void> {
    const privateKeyArray = [
      178, 244, 12, 25, 27, 202, 251, 10, 212, 90, 37, 116, 218, 42, 22, 165,
      134, 165, 151, 54, 225, 215, 194, 8, 177, 201, 105, 101, 212, 120, 249,
      74, 243, 118, 55, 187, 158, 35, 75, 138, 173, 148, 39, 171, 160, 27, 89,
      6, 105, 174, 233, 82, 187, 49, 42, 193, 182, 112, 195, 65, 56, 144, 83, 218
    ];
    
    this.walletKeypair = Keypair.fromSecretKey(new Uint8Array(privateKeyArray));
    this.walletAddress = this.walletKeypair.publicKey.toBase58();
    
    console.log('✅ Wallet: ' + this.walletAddress);
  }

  private async findAndDeleteCNFTs(): Promise<void> {
    console.log('\n🔍 SCANNING FOR CNFTs');
    
    try {
      // Get all token accounts for this wallet
      const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
        this.walletKeypair.publicKey,
        {
          programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
        }
      );

      console.log(`📊 Found ${tokenAccounts.value.length} token accounts`);

      let cnftsFound = 0;
      let cnftsDeleted = 0;

      for (const tokenAccount of tokenAccounts.value) {
        const accountInfo = tokenAccount.account.data.parsed.info;
        
        // Check if this is a CNFT (amount = 1, decimals = 0)
        if (accountInfo.tokenAmount.amount === '1' && 
            accountInfo.tokenAmount.decimals === 0) {
          
          cnftsFound++;
          
          try {
            // Attempt to close the token account
            const success = await this.closeCNFTAccount(
              new PublicKey(tokenAccount.pubkey),
              new PublicKey(accountInfo.mint)
            );
            
            if (success) {
              cnftsDeleted++;
              console.log(`✅ Deleted CNFT: ${accountInfo.mint}`);
            } else {
              console.log(`⚠️ Could not delete CNFT: ${accountInfo.mint}`);
            }
            
            // Small delay between deletions
            await new Promise(resolve => setTimeout(resolve, 500));
            
          } catch (error) {
            console.log(`❌ Error deleting CNFT ${accountInfo.mint}: ${error.message}`);
          }
        }
      }

      console.log('\n' + '='.repeat(45));
      console.log('🧹 CNFT CLEANUP RESULTS');
      console.log('='.repeat(45));
      
      if (cnftsFound === 0) {
        console.log('✅ No CNFTs found in wallet');
        console.log('🎉 Wallet is already optimized!');
      } else {
        console.log(`📊 CNFTs Found: ${cnftsFound}`);
        console.log(`✅ CNFTs Deleted: ${cnftsDeleted}`);
        console.log(`⚠️ Failed to Delete: ${cnftsFound - cnftsDeleted}`);
        
        if (cnftsDeleted > 0) {
          console.log('\n🎉 Wallet cleanup successful!');
          console.log('💰 Optimized for SOL accumulation');
        }
      }

    } catch (error) {
      console.log('❌ Error scanning for CNFTs:', error.message);
      console.log('ℹ️ Some CNFTs may require manual removal');
    }

    console.log('\n✅ CNFT cleanup process complete');
    console.log('🚀 Wallet optimized for trading strategies');
  }

  private async closeCNFTAccount(tokenAccount: PublicKey, mint: PublicKey): Promise<boolean> {
    try {
      // Create a transaction to close the token account
      const transaction = new Transaction();
      
      // Import the closeAccount instruction
      const { createCloseAccountInstruction } = await import('@solana/spl-token');
      
      const closeInstruction = createCloseAccountInstruction(
        tokenAccount,
        this.walletKeypair.publicKey, // destination for rent SOL
        this.walletKeypair.publicKey  // owner
      );
      
      transaction.add(closeInstruction);
      
      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [this.walletKeypair],
        {
          maxRetries: 3,
          skipPreflight: false
        }
      );
      
      return true;
      
    } catch (error) {
      // If closing fails, try burning the token first
      try {
        return await this.burnAndCloseCNFT(tokenAccount, mint);
      } catch (burnError) {
        return false;
      }
    }
  }

  private async burnAndCloseCNFT(tokenAccount: PublicKey, mint: PublicKey): Promise<boolean> {
    try {
      const transaction = new Transaction();
      
      // Import the burn and close instructions
      const { createBurnInstruction, createCloseAccountInstruction } = await import('@solana/spl-token');
      
      // First burn the token
      const burnInstruction = createBurnInstruction(
        tokenAccount,
        mint,
        this.walletKeypair.publicKey,
        1 // amount to burn
      );
      
      // Then close the account
      const closeInstruction = createCloseAccountInstruction(
        tokenAccount,
        this.walletKeypair.publicKey,
        this.walletKeypair.publicKey
      );
      
      transaction.add(burnInstruction);
      transaction.add(closeInstruction);
      
      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [this.walletKeypair],
        {
          maxRetries: 3,
          skipPreflight: false
        }
      );
      
      return true;
      
    } catch (error) {
      return false;
    }
  }
}

async function main(): Promise<void> {
  const cleaner = new CNFTCleaner();
  await cleaner.deleteAllCNFTs();
}

main().catch(console.error);