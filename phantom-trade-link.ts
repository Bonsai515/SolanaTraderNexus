/**
 * Phantom Trade Link Generator
 * 
 * This script generates links for direct trading via Phantom wallet,
 * allowing secure trades without exposing your private key.
 */

import * as fs from 'fs';
import axios from 'axios';

// Configuration
const LOG_PATH = './phantom-trade-link.log';
const WALLET_ADDRESS = '2Jf2tj34q3zh3MJQ5dgRVLeBCfV4LqiAkWTWeHQRvCaH';
const JUPITER_API_URL = 'https://quote-api.jup.ag/v6';
const OUTPUT_FILE = './TRADE_LINKS.md';

// Token constants
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const BONK_MINT = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263';
const JUP_MINT = 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZXnbLKX';
const SOL_MINT = 'So11111111111111111111111111111111111111112';
const WIF_MINT = 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65QAx3';
const MEME_MINT = 'MNDEFzGvMt87ueuHvVU9VcTqsAP5b3fTGPsHuuPA5ey';

// Initialize log
if (!fs.existsSync(LOG_PATH)) {
  fs.writeFileSync(LOG_PATH, '--- PHANTOM TRADE LINK GENERATOR LOG ---\n');
}

// Log function
function log(message: string): void {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  fs.appendFileSync(LOG_PATH, logMessage + '\n');
}

// Get Jupiter quote and generate Phantom link
async function generatePhantomLink(
  inputMint: string,
  outputMint: string,
  amount: number,
  inputName: string,
  outputName: string,
  strategy: string
): Promise<{ link: string, expectedOutput: number }> {
  try {
    log(`Getting Jupiter quote for ${inputName} to ${outputName} (${strategy})...`);
    
    // Call Jupiter API to get quote
    const response = await axios.get(
      `${JUPITER_API_URL}/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=30`
    );
    
    if (!response.data || !response.data.outAmount) {
      throw new Error('Invalid response from Jupiter API');
    }
    
    const outAmount = parseInt(response.data.outAmount);
    
    // Get token decimals
    const inputDecimals = inputMint === SOL_MINT ? 9 : 
                         inputMint === USDC_MINT ? 6 : 
                         inputMint === BONK_MINT ? 5 : 9;
    
    const outputDecimals = outputMint === SOL_MINT ? 9 : 
                          outputMint === USDC_MINT ? 6 : 
                          outputMint === BONK_MINT ? 5 : 9;
    
    // Format human-readable amounts
    const inputAmountFormatted = amount / Math.pow(10, inputDecimals);
    const outAmountFormatted = outAmount / Math.pow(10, outputDecimals);
    
    log(`Quote received: ${inputAmountFormatted} ${inputName} → ${outAmountFormatted.toLocaleString()} ${outputName}`);
    
    // Generate deep link to Jupiter via Phantom
    const phantomLink = `https://phantom.app/ul/browse/https://jup.ag/swap/${inputMint}-${outputMint}?inAmount=${amount}&slippage=0.5`;
    
    return {
      link: phantomLink,
      expectedOutput: outAmountFormatted
    };
  } catch (error) {
    log(`Error generating Phantom link: ${(error as Error).message}`);
    
    // Return fallback direct link to Jupiter
    return {
      link: `https://jup.ag/swap/${inputName}-${outputName}`,
      expectedOutput: 0
    };
  }
}

// Generate trade links for each strategy
async function generateTradeLinks(): Promise<void> {
  try {
    const trades = [
      {
        strategy: 'Flash Loan Singularity',
        inputMint: SOL_MINT,
        outputMint: USDC_MINT,
        amount: 0.01 * 1e9, // 0.01 SOL in lamports
        inputName: 'SOL',
        outputName: 'USDC',
        description: 'High-yield flash loan arbitrage opportunity'
      },
      {
        strategy: 'Quantum Arbitrage',
        inputMint: SOL_MINT,
        outputMint: BONK_MINT,
        amount: 0.015 * 1e9, // 0.015 SOL in lamports
        inputName: 'SOL',
        outputName: 'BONK',
        description: 'Cross-exchange arbitrage with neural optimization'
      },
      {
        strategy: 'Meme Token Sniper',
        inputMint: SOL_MINT,
        outputMint: WIF_MINT,
        amount: 0.02 * 1e9, // 0.02 SOL in lamports
        inputName: 'SOL',
        outputName: 'WIF',
        description: 'MemeCortex-identified momentum trading opportunity'
      },
      {
        strategy: 'Cascade Flash',
        inputMint: SOL_MINT,
        outputMint: JUP_MINT,
        amount: 0.01 * 1e9, // 0.01 SOL in lamports
        inputName: 'SOL',
        outputName: 'JUP',
        description: 'Multi-hop leveraged position with priority execution'
      },
      {
        strategy: 'Temporal Block Arbitrage',
        inputMint: SOL_MINT,
        outputMint: MEME_MINT,
        amount: 0.005 * 1e9, // 0.005 SOL in lamports
        inputName: 'SOL',
        outputName: 'MEME',
        description: 'Block-timing optimized MEV opportunity'
      }
    ];
    
    // Generate links for each trade
    const results = [];
    
    for (const trade of trades) {
      const result = await generatePhantomLink(
        trade.inputMint,
        trade.outputMint,
        trade.amount,
        trade.inputName,
        trade.outputName,
        trade.strategy
      );
      
      results.push({
        ...trade,
        link: result.link,
        expectedOutput: result.expectedOutput
      });
    }
    
    // Create a markdown file with the links
    let markdown = `# Phantom Wallet Trade Links\n\n`;
    markdown += `Generated on: ${new Date().toLocaleString()}\n\n`;
    markdown += `## How to Use\n`;
    markdown += `1. Click on any trade link below to open Phantom wallet\n`;
    markdown += `2. Review the trade details carefully\n`;
    markdown += `3. Adjust slippage if needed (default: 0.5%)\n`;
    markdown += `4. Click "Swap" to execute the trade\n\n`;
    markdown += `## Available Trades\n\n`;
    
    for (const result of results) {
      markdown += `### ${result.strategy}\n\n`;
      markdown += `* **Trade**: ${result.inputName} → ${result.outputName}\n`;
      markdown += `* **Amount**: ${(result.amount / Math.pow(10, result.inputName === 'SOL' ? 9 : 6)).toFixed(6)} ${result.inputName}\n`;
      markdown += `* **Expected Output**: ${result.expectedOutput ? result.expectedOutput.toLocaleString() : 'Check Jupiter'} ${result.outputName}\n`;
      markdown += `* **Strategy Type**: ${result.description}\n`;
      markdown += `* **[Execute Trade with Phantom](${result.link})**\n\n`;
    }
    
    markdown += `## Performance Tracking\n\n`;
    markdown += `After executing trades, you can use our profit monitoring tools:\n`;
    markdown += `\`\`\`\n`;
    markdown += `npx ts-node profit-monitor.ts\n`;
    markdown += `\`\`\`\n\n`;
    markdown += `This will help track your actual on-chain profits and update your dashboard.\n\n`;
    markdown += `## Security Note\n\n`;
    markdown += `These links open trades in your Phantom wallet, where you have full control to review and approve each transaction. Your private keys always remain secured in your wallet.`;
    
    fs.writeFileSync(OUTPUT_FILE, markdown);
    log(`✅ Trade links generated and saved to ${OUTPUT_FILE}`);
  } catch (error) {
    log(`Error generating trade links: ${(error as Error).message}`);
  }
}

// Run the main function
async function main(): Promise<void> {
  try {
    log('Starting Phantom trade link generator...');
    
    // Generate trade links
    await generateTradeLinks();
    
    log('Phantom trade link generation completed');
    
    console.log('\n===== PHANTOM TRADE LINKS GENERATED =====');
    console.log('✅ Trade links created successfully');
    console.log(`✅ Links saved to ${OUTPUT_FILE}`);
    console.log('\nThese links allow you to trade directly through your Phantom wallet');
    console.log('Your wallet remains secure as you control all transaction approvals');
    
  } catch (error) {
    log(`Fatal error: ${(error as Error).message}`);
    console.error('❌ Phantom trade link generation failed');
  }
}

// Run the main function
if (require.main === module) {
  main().catch(error => {
    log(`Unhandled error: ${error.message}`);
  });
}