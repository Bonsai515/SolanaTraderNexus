/**
 * Check mSOL Position and Value
 * 
 * Directly checks your wallet for:
 * - Actual mSOL token balance
 * - Current mSOL market price
 * - Total USD value of your position
 */

import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

class MSOLPositionChecker {
  private connection: Connection;
  private walletKeypair: Keypair;
  private walletAddress: string;
  private msolMint: PublicKey;

  constructor() {
    this.connection = new Connection('https://powerful-shy-telescope.solana-mainnet.quiknode.pro/8458b7fd0c7ededea5ed518b0ce21d55f5f162f8/', 'confirmed');
    this.msolMint = new PublicKey('mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So'); // Official mSOL mint
  }

  public async checkMSOLPosition(): Promise<void> {
    console.log('🌊 CHECKING YOUR mSOL POSITION');
    console.log('='.repeat(50));

    await this.loadWallet();
    await this.checkMSOLBalance();
    await this.getMSOLMarketData();
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

  private async checkMSOLBalance(): Promise<void> {
    console.log('\n🔍 CHECKING mSOL TOKEN BALANCE...');
    
    try {
      // Get all token accounts for this wallet
      const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
        this.walletKeypair.publicKey,
        { programId: TOKEN_PROGRAM_ID }
      );

      console.log(`📊 Found ${tokenAccounts.value.length} token accounts`);

      let msolBalance = 0;
      let msolFound = false;

      for (const account of tokenAccounts.value) {
        const parsedInfo = account.account.data.parsed.info;
        const mint = parsedInfo.mint;
        const balance = parsedInfo.tokenAmount.uiAmount;

        if (mint === this.msolMint.toBase58()) {
          msolBalance = balance;
          msolFound = true;
          console.log('\n🌊 mSOL TOKEN FOUND!');
          console.log(`💎 mSOL Balance: ${msolBalance.toFixed(6)} mSOL`);
          console.log(`🔗 Token Account: ${account.pubkey.toBase58()}`);
          break;
        }
      }

      if (!msolFound) {
        console.log('\n❌ No mSOL tokens found in wallet');
        console.log('💡 This could mean:');
        console.log('   - No mSOL currently staked');
        console.log('   - mSOL is in a different wallet');
        console.log('   - Need to check staking accounts directly');
      }

      // Also check SOL balance
      const solBalance = await this.connection.getBalance(this.walletKeypair.publicKey);
      const solAmount = solBalance / LAMPORTS_PER_SOL;
      console.log(`\n💰 SOL Balance: ${solAmount.toFixed(6)} SOL`);

    } catch (error) {
      console.log(`❌ Error checking token balance: ${error.message}`);
    }
  }

  private async getMSOLMarketData(): Promise<void> {
    console.log('\n📈 GETTING mSOL MARKET DATA...');
    
    try {
      // Try Jupiter price API first
      const jupiterResponse = await fetch('https://price.jup.ag/v4/price?ids=mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So');
      
      if (jupiterResponse.ok) {
        const jupiterData = await jupiterResponse.json();
        const msolPrice = jupiterData.data?.mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So?.price;
        
        if (msolPrice) {
          console.log(`💰 mSOL Price: $${msolPrice.toFixed(2)} USD`);
          console.log(`📊 Source: Jupiter Price API`);
          return;
        }
      }

      // Fallback to Marinade API
      const marinadeResponse = await fetch('https://api.marinade.finance/msol/price');
      
      if (marinadeResponse.ok) {
        const marinadeData = await marinadeResponse.json();
        if (marinadeData.msol_price) {
          console.log(`💰 mSOL Price: $${marinadeData.msol_price.toFixed(2)} USD`);
          console.log(`📊 Source: Marinade API`);
          return;
        }
      }

      // If APIs fail, show exchange rate info
      console.log('⚠️ Unable to fetch current mSOL price from APIs');
      console.log('💡 mSOL typically trades close to SOL price');
      console.log('📊 Current mSOL to SOL exchange rate is usually ~0.98-1.02 SOL per mSOL');

    } catch (error) {
      console.log(`❌ Error fetching mSOL price: ${error.message}`);
    }
  }
}

async function main(): Promise<void> {
  const checker = new MSOLPositionChecker();
  await checker.checkMSOLPosition();
}

main().catch(console.error);