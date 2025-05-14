/**
 * Test Real Market Trading on Solana
 * 
 * This script tests real market trading on Solana using the Nexus Professional Engine.
 * It directly executes real on-chain transactions with blockchain verification.
 */

const { logger } = require('./server/logger');
const { 
  initializeTransactionEngine, 
  isInitialized, 
  setUseRealFunds, 
  executeSolanaTransaction 
} = require('./server/nexus-transaction-engine');
const { resetTransactionLogs, getTransactionStats } = require('./server/lib/transactionLogs');
const { jupiterDexIntegration } = require('./server/lib/jupiterDexIntegration');
const { mevTransactionExecutor } = require('./server/lib/mevTransactionExecutor');
const { flashLoanExecutor } = require('./server/lib/flashLoanProvider');
const { memecoinSniper } = require('./server/lib/memecoinSniper');
const fs = require('fs');
const { Connection, Keypair, LAMPORTS_PER_SOL } = require('@solana/web3.js');

// Path to wallet keypair (create this file with a funded wallet)
const WALLET_PATH = './wallet.json';

// Configure constants
const REAL_FUNDS = true; // Set to true to use real funds
const TRANSACTION_AMOUNT = 0.01; // SOL amount for transactions
const USDC_AMOUNT = 0.1; // USDC amount for swaps
const TEST_RUNS = 2; // Number of test runs

/**
 * Initialize test environment
 */
async function initialize(): Promise<boolean> {
  try {
    logger.info('Initializing test environment for real market trading');
    
    // Reset transaction logs
    resetTransactionLogs();
    
    // Create wallet keypair if it doesn't exist
    if (!fs.existsSync(WALLET_PATH)) {
      logger.info('Creating new wallet keypair for testing');
      const keypair = Keypair.generate();
      fs.writeFileSync(WALLET_PATH, JSON.stringify(Array.from(keypair.secretKey)));
      
      logger.info(`Created new wallet: ${keypair.publicKey.toString()}`);
      logger.warn('IMPORTANT: Fund this wallet before testing real market trading!');
      
      return false;
    }
    
    // Initialize Nexus Transaction Engine
    await initializeTransactionEngine();
    
    if (!isInitialized()) {
      logger.error('Failed to initialize Nexus Transaction Engine');
      return false;
    }
    
    // Set real funds flag
    setUseRealFunds(REAL_FUNDS);
    
    // Initialize Jupiter DEX integration
    await jupiterDexIntegration.initialize();
    
    // Initialize MEV transaction executor
    await mevTransactionExecutor.initialize();
    
    // Initialize flash loan executor
    await flashLoanExecutor.initialize();
    
    // Initialize memecoin sniper
    await memecoinSniper.initialize();
    
    logger.info('Test environment initialized successfully');
    
    return true;
  } catch (error: any) {
    logger.error('Failed to initialize test environment:', error.message);
    return false;
  }
}

/**
 * Test SOL transfer
 */
async function testSolTransfer(): Promise<boolean> {
  try {
    logger.info('Testing SOL transfer');
    
    // Load wallet keypair
    const keypairData = JSON.parse(fs.readFileSync(WALLET_PATH, 'utf8'));
    const keypair = Keypair.fromSecretKey(new Uint8Array(keypairData));
    const walletAddress = keypair.publicKey.toString();
    
    // Create a temp wallet to receive funds
    const tempKeypair = Keypair.generate();
    const tempWalletAddress = tempKeypair.publicKey.toString();
    
    logger.info(`Transferring ${TRANSACTION_AMOUNT} SOL from ${walletAddress} to ${tempWalletAddress}`);
    
    // Execute SOL transfer
    const result = await executeSolanaTransaction({
      type: 'transfer',
      fromWalletPath: WALLET_PATH,
      toWallet: tempWalletAddress,
      amountSol: TRANSACTION_AMOUNT
    });
    
    if (result.success) {
      logger.info(`SOL transfer successful! Signature: ${result.signature}, Verified: ${result.verified}`);
      
      // Transfer back to original wallet
      const connection = new Connection(
        process.env.HELIUS_API_KEY 
          ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
          : 'https://api.mainnet-beta.solana.com',
        'confirmed'
      );
      
      // Create a temp wallet file
      const tempWalletPath = './temp_wallet.json';
      fs.writeFileSync(tempWalletPath, JSON.stringify(Array.from(tempKeypair.secretKey)));
      
      // We need to wait a bit for the transaction to be confirmed
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      logger.info(`Transferring SOL back from ${tempWalletAddress} to ${walletAddress}`);
      
      // Transfer back
      const backResult = await executeSolanaTransaction({
        type: 'transfer',
        fromWalletPath: tempWalletPath,
        toWallet: walletAddress,
        amountSol: TRANSACTION_AMOUNT * 0.9 // Account for fees
      });
      
      if (backResult.success) {
        logger.info(`SOL transfer back successful! Signature: ${backResult.signature}, Verified: ${backResult.verified}`);
        
        // Clean up temp wallet file
        fs.unlinkSync(tempWalletPath);
        
        return true;
      } else {
        logger.error(`Failed to transfer SOL back: ${backResult.error}`);
        
        // Clean up temp wallet file
        fs.unlinkSync(tempWalletPath);
        
        return false;
      }
    } else {
      logger.error(`Failed to transfer SOL: ${result.error}`);
      return false;
    }
  } catch (error: any) {
    logger.error('Failed to test SOL transfer:', error.message);
    return false;
  }
}

/**
 * Test token swap
 */
async function testTokenSwap(): Promise<boolean> {
  try {
    logger.info('Testing token swap');
    
    // Load wallet keypair
    const keypairData = JSON.parse(fs.readFileSync(WALLET_PATH, 'utf8'));
    const keypair = Keypair.fromSecretKey(new Uint8Array(keypairData));
    const walletAddress = keypair.publicKey.toString();
    
    // Find tokens
    const usdc = jupiterDexIntegration.findToken('USDC');
    const sol = jupiterDexIntegration.findToken('SOL');
    
    if (!usdc || !sol) {
      logger.error('Failed to find tokens for swap');
      return false;
    }
    
    logger.info(`Swapping SOL to USDC and back using wallet ${walletAddress}`);
    
    // Get swap instructions for SOL to USDC
    const solToUsdcInstructions = await jupiterDexIntegration.getRealTokenSwapInstructions(
      walletAddress,
      sol.address,
      usdc.address,
      TRANSACTION_AMOUNT * 1e9, // Convert SOL to lamports
      50 // 0.5% slippage
    );
    
    if (!solToUsdcInstructions.success) {
      logger.error(`Failed to get swap instructions: ${solToUsdcInstructions.error}`);
      return false;
    }
    
    // Execute SOL to USDC swap
    const solToUsdcResult = await executeSolanaTransaction({
      type: 'swap',
      walletPath: WALLET_PATH,
      fromToken: sol.address,
      toToken: usdc.address,
      amountIn: TRANSACTION_AMOUNT * 1e9, // Convert SOL to lamports
      slippageBps: 50,
      swapInstructions: [solToUsdcInstructions.swapInstructions]
    });
    
    if (solToUsdcResult.success) {
      logger.info(`SOL to USDC swap successful! Signature: ${solToUsdcResult.signature}, Verified: ${solToUsdcResult.verified}`);
      
      // We need to wait a bit for the transaction to be confirmed
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Calculate USDC amount we received
      const usdcAmount = parseFloat(solToUsdcInstructions.outAmount);
      logger.info(`Received ${usdcAmount} USDC`);
      
      // Get swap instructions for USDC to SOL
      const usdcToSolInstructions = await jupiterDexIntegration.getRealTokenSwapInstructions(
        walletAddress,
        usdc.address,
        sol.address,
        usdcAmount, // Use the USDC we received
        50 // 0.5% slippage
      );
      
      if (!usdcToSolInstructions.success) {
        logger.error(`Failed to get swap instructions: ${usdcToSolInstructions.error}`);
        return false;
      }
      
      // Execute USDC to SOL swap
      const usdcToSolResult = await executeSolanaTransaction({
        type: 'swap',
        walletPath: WALLET_PATH,
        fromToken: usdc.address,
        toToken: sol.address,
        amountIn: usdcAmount,
        slippageBps: 50,
        swapInstructions: [usdcToSolInstructions.swapInstructions]
      });
      
      if (usdcToSolResult.success) {
        logger.info(`USDC to SOL swap successful! Signature: ${usdcToSolResult.signature}, Verified: ${usdcToSolResult.verified}`);
        return true;
      } else {
        logger.error(`Failed to swap USDC to SOL: ${usdcToSolResult.error}`);
        return false;
      }
    } else {
      logger.error(`Failed to swap SOL to USDC: ${solToUsdcResult.error}`);
      return false;
    }
  } catch (error: any) {
    logger.error('Failed to test token swap:', error.message);
    return false;
  }
}

/**
 * Test arbitrage
 */
async function testArbitrage(): Promise<boolean> {
  try {
    logger.info('Testing arbitrage');
    
    // Find arbitrage opportunities
    const result = await mevTransactionExecutor.findAndExecuteArbitrage(WALLET_PATH);
    
    if (result.success) {
      logger.info(`Arbitrage successful! Signature: ${result.signature}, Verified: ${result.verified}, Profit: ${result.profit}`);
      return true;
    } else {
      logger.warn(`No arbitrage opportunities found: ${result.error}`);
      return false;
    }
  } catch (error: any) {
    logger.error('Failed to test arbitrage:', error.message);
    return false;
  }
}

/**
 * Test flash loan
 */
async function testFlashLoan(): Promise<boolean> {
  try {
    logger.info('Testing flash loan');
    
    // Find USDC token
    const usdc = jupiterDexIntegration.findToken('USDC');
    if (!usdc) {
      logger.error('Failed to find USDC token');
      return false;
    }
    
    // Get arbitrage instructions for callback
    const opportunities = await mevTransactionExecutor.findAndExecuteArbitrage(WALLET_PATH);
    if (!opportunities.success) {
      logger.warn(`No arbitrage opportunities found for flash loan: ${opportunities.error}`);
      return false;
    }
    
    // Execute flash loan
    const result = await flashLoanExecutor.executeFlashLoan({
      provider: 'Solend',
      token: usdc.address,
      amount: 100, // 100 USDC
      callbackInstructions: [], // In a real scenario, we would use arbitrage instructions
      walletPath: WALLET_PATH
    });
    
    if (result.success) {
      logger.info(`Flash loan successful! Signature: ${result.signature}, Verified: ${result.verified}`);
      return true;
    } else {
      logger.error(`Failed to execute flash loan: ${result.error}`);
      return false;
    }
  } catch (error: any) {
    logger.error('Failed to test flash loan:', error.message);
    return false;
  }
}

/**
 * Test memecoin sniping
 */
async function testMemecoinSniping(): Promise<boolean> {
  try {
    logger.info('Testing memecoin sniping');
    
    // Run memecoin sniper
    const result = await memecoinSniper.run(WALLET_PATH);
    
    if (result && result.success) {
      logger.info(`Memecoin snipe successful! Token: ${result.token.symbol}, Signature: ${result.signature}, Verified: ${result.verified}`);
      return true;
    } else if (result) {
      logger.warn(`Failed to snipe memecoin: ${result.error}`);
      return false;
    } else {
      logger.warn('No memecoins to snipe');
      return false;
    }
  } catch (error: any) {
    logger.error('Failed to test memecoin sniping:', error.message);
    return false;
  }
}

/**
 * Run all tests
 */
async function runTests(): Promise<void> {
  const results = {
    solTransfer: false,
    tokenSwap: false,
    arbitrage: false,
    flashLoan: false,
    memecoinSniping: false
  };
  
  // Run each test multiple times
  for (let i = 0; i < TEST_RUNS; i++) {
    logger.info(`\n=== Test Run ${i + 1}/${TEST_RUNS} ===\n`);
    
    // Test SOL transfer
    results.solTransfer = await testSolTransfer();
    
    // Test token swap
    results.tokenSwap = await testTokenSwap();
    
    // Test arbitrage
    results.arbitrage = await testArbitrage();
    
    // Test flash loan
    results.flashLoan = await testFlashLoan();
    
    // Test memecoin sniping
    results.memecoinSniping = await testMemecoinSniping();
  }
  
  // Print test results
  logger.info('\n=== Test Results ===\n');
  logger.info(`SOL Transfer: ${results.solTransfer ? 'PASSED' : 'FAILED'}`);
  logger.info(`Token Swap: ${results.tokenSwap ? 'PASSED' : 'FAILED'}`);
  logger.info(`Arbitrage: ${results.arbitrage ? 'PASSED' : 'FAILED'}`);
  logger.info(`Flash Loan: ${results.flashLoan ? 'PASSED' : 'FAILED'}`);
  logger.info(`Memecoin Sniping: ${results.memecoinSniping ? 'PASSED' : 'FAILED'}`);
  
  // Print transaction statistics
  const stats = getTransactionStats();
  logger.info('\n=== Transaction Statistics ===\n');
  logger.info(`Total Transactions: ${stats.total}`);
  logger.info(`Verified Transactions: ${stats.verified}`);
  logger.info(`Total Profit: ${stats.profit} USDC`);
  logger.info('Transaction Types:');
  for (const [type, count] of Object.entries(stats.byType)) {
    logger.info(`  ${type}: ${count}`);
  }
}

/**
 * Main function
 */
async function main(): Promise<void> {
  const initialized = await initialize();
  
  if (!initialized) {
    logger.error('Failed to initialize test environment');
    return;
  }
  
  await runTests();
}

// Run main function
main().catch(error => {
  logger.error('Fatal error:', error);
});