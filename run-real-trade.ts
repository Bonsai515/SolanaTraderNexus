/**
 * Run Real Trading Operations
 * 
 * This script is a wrapper that sets up a wallet and executes a real market trade.
 * It directly calls the Nexus Professional Engine to execute transactions.
 */

import * as fs from 'fs';
import { Keypair, Connection, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { initializeTransactionEngine, setUseRealFunds, executeSolanaTransaction } from './server/nexus-transaction-engine';
import { logger } from './server/logger';
import { jupiterDexIntegration } from './server/lib/jupiterDexIntegration';
import { mevTransactionExecutor } from './server/lib/mevTransactionExecutor';
import { memecoinSniper } from './server/lib/memecoinSniper';

// Path to wallet keypair
const WALLET_PATH = './wallet.json';

// Initialize environment
async function initializeEnvironment(): Promise<boolean> {
  try {
    console.log('Setting up environment for real trading...');
    
    // Create wallet if it doesn't exist
    if (!fs.existsSync(WALLET_PATH)) {
      console.log('Creating new wallet...');
      const keypair = Keypair.generate();
      fs.writeFileSync(WALLET_PATH, JSON.stringify(Array.from(keypair.secretKey)));
      console.log(`New wallet created: ${keypair.publicKey.toString()}`);
      console.log('IMPORTANT: Fund this wallet before running real trades.');
    } else {
      // Load the wallet
      const keypairData = JSON.parse(fs.readFileSync(WALLET_PATH, 'utf8'));
      const keypair = Keypair.fromSecretKey(new Uint8Array(keypairData));
      console.log(`Using existing wallet: ${keypair.publicKey.toString()}`);
    }
    
    // Initialize the Nexus Transaction Engine
    console.log('Initializing Nexus Transaction Engine...');
    await initializeTransactionEngine();
    setUseRealFunds(true);
    
    // Initialize Jupiter DEX
    console.log('Initializing Jupiter DEX...');
    await jupiterDexIntegration.initialize();
    
    // Initialize MEV Transaction Executor
    console.log('Initializing MEV Transaction Executor...');
    await mevTransactionExecutor.initialize();
    
    // Initialize Memecoin Sniper
    console.log('Initializing Memecoin Sniper...');
    await memecoinSniper.initialize();
    
    console.log('Environment successfully initialized.');
    return true;
  } catch (error: any) {
    console.error('Failed to initialize environment:', error.message);
    return false;
  }
}

// Run the trading operation
async function runTrading() {
  try {
    console.log('Starting real trading operations...');
    
    // Initialize the environment
    const initialized = await initializeEnvironment();
    if (!initialized) {
      console.error('Failed to initialize environment, aborting.');
      return;
    }
    
    // Get wallet keypair
    const keypairData = JSON.parse(fs.readFileSync(WALLET_PATH, 'utf8'));
    const keypair = Keypair.fromSecretKey(new Uint8Array(keypairData));
    const walletAddress = keypair.publicKey.toString();
    
    // Check wallet balance
    const connection = new Connection(
      process.env.HELIUS_API_KEY 
        ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
        : 'https://api.mainnet-beta.solana.com',
      'confirmed'
    );
    
    const balance = await connection.getBalance(keypair.publicKey);
    const balanceSol = balance / LAMPORTS_PER_SOL;
    
    console.log(`Wallet ${walletAddress} has ${balanceSol} SOL`);
    
    if (balanceSol < 0.01) {
      console.log('Wallet balance too low for trading. Fund the wallet and try again.');
      return;
    }
    
    // Check for arbitrage opportunities
    console.log('Searching for arbitrage opportunities...');
    const arbitrageOpportunity = await mevTransactionExecutor.findAndExecuteArbitrage(WALLET_PATH);
    
    if (arbitrageOpportunity.success) {
      console.log(`Arbitrage executed successfully! Signature: ${arbitrageOpportunity.signature}`);
      console.log(`Verified: ${arbitrageOpportunity.verified}, Profit: ${arbitrageOpportunity.profit}`);
    } else {
      console.log(`No arbitrage opportunities found: ${arbitrageOpportunity.error}`);
    }
    
    // Check for memecoin opportunities
    console.log('Searching for memecoin opportunities...');
    const memecoins = await memecoinSniper.scanForMemecoins();
    console.log(`Found ${memecoins.length} memecoin opportunities`);
    
    if (memecoins.length > 0) {
      console.log('Running memecoin sniper...');
      const snipeResult = await memecoinSniper.run(WALLET_PATH);
      
      if (snipeResult && snipeResult.success) {
        console.log(`Memecoin snipe successful! Signature: ${snipeResult.signature}`);
        console.log(`Token: ${snipeResult.token.symbol}, Verified: ${snipeResult.verified}`);
      } else if (snipeResult) {
        console.log(`Failed to snipe memecoin: ${snipeResult.error}`);
      } else {
        console.log('No memecoins to snipe at this time.');
      }
    }
    
    // Execute a test token swap if no opportunities found
    if (!arbitrageOpportunity.success && (!memecoins.length || !memecoinSniper.run)) {
      console.log('No real trading opportunities found, executing test token swap...');
      
      // Get SOL and USDC tokens
      const sol = jupiterDexIntegration.findToken('SOL');
      const usdc = jupiterDexIntegration.findToken('USDC');
      
      if (!sol || !usdc) {
        console.log('Failed to find SOL or USDC tokens.');
        return;
      }
      
      // Execute tiny SOL -> USDC swap
      const swapAmount = 0.001; // 0.001 SOL
      console.log(`Executing test swap of ${swapAmount} SOL to USDC...`);
      
      // Get swap instructions
      const swapInstructions = await jupiterDexIntegration.getRealTokenSwapInstructions(
        walletAddress,
        sol.address,
        usdc.address,
        swapAmount * LAMPORTS_PER_SOL,
        50 // 0.5% slippage
      );
      
      if (!swapInstructions.success) {
        console.log(`Failed to get swap instructions: ${swapInstructions.error}`);
        return;
      }
      
      // Execute swap transaction
      const swapResult = await executeSolanaTransaction({
        type: 'swap',
        walletPath: WALLET_PATH,
        fromToken: sol.address,
        toToken: usdc.address,
        amountIn: swapAmount * LAMPORTS_PER_SOL,
        slippageBps: 50,
        swapInstructions: [swapInstructions.swapInstructions]
      });
      
      if (swapResult.success) {
        console.log(`Test swap successful! Signature: ${swapResult.signature}`);
        console.log(`Verified: ${swapResult.verified}`);
      } else {
        console.log(`Failed to execute test swap: ${swapResult.error}`);
      }
    }
    
    console.log('Trading operations complete.');
  } catch (error: any) {
    console.error('Error during trading operations:', error.message);
  }
}

// Run the script
runTrading().catch(console.error);