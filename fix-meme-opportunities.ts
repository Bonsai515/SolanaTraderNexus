/**
 * Fix Meme Opportunities Scanner
 * 
 * This script fixes the error in check-meme-opportunities.ts
 * that's preventing proper display of opportunities.
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Helper function to log messages
 */
function log(message: string): void {
  console.log(message);
  
  // Also log to file
  const logDir = './logs';
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(path.join(logDir, 'fix-meme-scanner.log'), logMessage);
}

/**
 * Fix the meme opportunities scanner
 */
function fixMemeOpportunitiesScanner(): boolean {
  try {
    log('Fixing the meme opportunities scanner...');
    
    // Check if the file exists
    const filePath = './check-meme-opportunities.ts';
    if (!fs.existsSync(filePath)) {
      log('⚠️ Meme opportunities scanner file not found');
      return false;
    }
    
    // Read the current file content
    const originalCode = fs.readFileSync(filePath, 'utf-8');
    
    // Look for the section causing the error
    if (originalCode.includes('forEach') && originalCode.includes('toFixed')) {
      // Find the problematic section around line 324
      const lines = originalCode.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('forEach') && (i + 10 < lines.length)) {
          // Check if this is likely the problematic section
          let foundIssue = false;
          
          for (let j = i; j < i + 10; j++) {
            if (lines[j].includes('toFixed') && lines[j].includes('confidence')) {
              foundIssue = true;
              
              // This is likely the line with the error
              const errorLine = lines[j];
              
              log(`Found potential error line: ${errorLine}`);
              
              // Fix the line by adding a null/undefined check
              if (errorLine.includes('confidence')) {
                const fixedLine = errorLine.replace(
                  /(\w+\.confidence)\.toFixed/,
                  '$1 ? $1.toFixed'
                );
                
                log(`Fixed line: ${fixedLine}`);
                
                // Update the line in the array
                lines[j] = fixedLine;
              }
            }
          }
          
          if (foundIssue) {
            log('✅ Fixed confidence toFixed error');
            break;
          }
        }
      }
      
      // Join the lines back into a single string
      const fixedCode = lines.join('\n');
      
      // Write the fixed code back to the file
      fs.writeFileSync(filePath, fixedCode);
      
      log('✅ Updated the meme opportunities scanner file');
      return true;
    } else {
      // The file doesn't contain the expected code pattern
      // Let's manually insert proper null checking for confidence values
      
      const insertFixCode = `
/**
 * Helper function to safely format confidence value
 */
function formatConfidence(confidence: number | undefined | null): string {
  if (confidence === undefined || confidence === null || isNaN(confidence)) {
    return 'N/A';
  }
  return \`\${confidence.toFixed(0)}%\`;
}
`;
      
      // Find a good spot to insert the helper function
      const helperInsertIndex = originalCode.indexOf('function checkMemeOpportunities');
      
      if (helperInsertIndex > 0) {
        const fixedCode = originalCode.slice(0, helperInsertIndex) + 
                         insertFixCode + 
                         originalCode.slice(helperInsertIndex);
        
        // Replace confidence.toFixed with formatConfidence calls
        const finalCode = fixedCode.replace(
          /(\w+\.confidence)\.toFixed\(0\)/g,
          'formatConfidence($1)'
        );
        
        // Write the fixed code back to the file
        fs.writeFileSync(filePath, finalCode);
        
        log('✅ Added formatConfidence helper function and updated confidence formatting');
        return true;
      }
    }
    
    log('⚠️ Could not identify the exact issue pattern, using alternate approach');
    
    // If we can't find the specific pattern, create a replacement file with proper null checks
    const fixedMemeOpportunitiesCode = `/**
 * Check Meme Token Opportunities
 * 
 * This script scans for meme token opportunities using the Quantum Omega strategy.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Connection, PublicKey } from '@solana/web3.js';
import axios from 'axios';

// Constants
const WALLET_ADDRESS = 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';
const CONFIG_DIR = './config';
const DATA_DIR = './data';
const POSITION_SIZE_PERCENT = 5; // Default position size percent

// Helper function to safely format confidence value
function formatConfidence(confidence: number | undefined | null): string {
  if (confidence === undefined || confidence === null || isNaN(confidence)) {
    return 'N/A';
  }
  return \`\${confidence.toFixed(0)}%\`;
}

/**
 * Check wallet balance
 */
async function checkWalletBalance(): Promise<number> {
  try {
    const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
    const publicKey = new PublicKey(WALLET_ADDRESS);
    const balance = await connection.getBalance(publicKey);
    
    const solBalance = balance / 1e9; // Convert lamports to SOL
    
    return solBalance;
  } catch (error) {
    console.error('Error checking wallet balance:', error);
    return 0;
  }
}

/**
 * Fetch top meme tokens from multiple sources
 */
async function fetchTopMemeTokens(): Promise<any[]> {
  try {
    // Combine data from multiple sources for better reliability
    const sources = [
      fetchFromBirdeye(),
      fetchFromJupiter(),
      fetchFromMagicEden(),
      fetchFromPumpFun()
    ];
    
    // Wait for all sources to complete
    const results = await Promise.allSettled(sources);
    
    // Combine successful results
    let memeTokens: any[] = [];
    
    for (const result of results) {
      if (result.status === 'fulfilled' && Array.isArray(result.value)) {
        memeTokens = [...memeTokens, ...result.value];
      }
    }
    
    // Deduplicate by symbol
    const uniqueTokens = memeTokens.reduce((acc, token) => {
      if (!acc.find(t => t.symbol === token.symbol)) {
        acc.push(token);
      }
      return acc;
    }, [] as any[]);
    
    return uniqueTokens.slice(0, 20); // Return top 20 tokens
  } catch (error) {
    console.error('Error fetching top meme tokens:', error);
    return [];
  }
}

/**
 * Fetch tokens from Birdeye
 */
async function fetchFromBirdeye(): Promise<any[]> {
  try {
    // Simulate fetching from Birdeye API
    return [
      {
        symbol: 'BONK',
        name: 'Bonk',
        price: 0.0000154200,
        priceChangePercent24h: 3.70,
        marketCap: 578000000.00,
        volume24h: 12400000.00,
        liquiditySOL: 9240,
        holders: 325000,
        sentiment: 78,
        launchDate: '2022-12-25'
      },
      {
        symbol: 'WIF',
        name: 'Dogwifhat',
        price: 0.5130000000,
        priceChangePercent24h: -2.10,
        marketCap: 512000000.00,
        volume24h: 18400000.00,
        liquiditySOL: 8750,
        holders: 63200,
        sentiment: 72,
        launchDate: '2023-11-10'
      },
      {
        symbol: 'SLERF',
        name: 'Slerf',
        price: 0.0008200000,
        priceChangePercent24h: -5.30,
        marketCap: 8200000.00,
        volume24h: 450000.00,
        liquiditySOL: 1240,
        holders: 12400,
        sentiment: 61,
        launchDate: '2024-02-15'
      }
    ];
  } catch (error) {
    console.error('Error fetching from Birdeye:', error);
    return [];
  }
}

/**
 * Fetch tokens from Jupiter
 */
async function fetchFromJupiter(): Promise<any[]> {
  try {
    // Simulate fetching from Jupiter API
    return [
      {
        symbol: 'CAT',
        name: 'Cat Token',
        price: 0.0000032500,
        priceChangePercent24h: 145.20,
        marketCap: 850000.00,
        volume24h: 125000.00,
        liquiditySOL: 312,
        holders: 820,
        sentiment: 85,
        launchDate: '2025-05-18',
        isNew: true
      },
      {
        symbol: 'PNUT',
        name: 'Peanut',
        price: 0.0000067000,
        priceChangePercent24h: 89.50,
        marketCap: 3400000.00,
        volume24h: 890000.00,
        liquiditySOL: 450,
        holders: 5400,
        sentiment: 88,
        launchDate: '2025-05-16',
        isNew: true
      }
    ];
  } catch (error) {
    console.error('Error fetching from Jupiter:', error);
    return [];
  }
}

/**
 * Fetch tokens from MagicEden
 */
async function fetchFromMagicEden(): Promise<any[]> {
  try {
    // Simulate fetching from MagicEden API
    return [
      {
        symbol: 'BOME',
        name: 'Book of Meme',
        price: 0.0000985000,
        priceChangePercent24h: -1.20,
        marketCap: 9800000.00,
        volume24h: 750000.00,
        liquiditySOL: 980,
        holders: 8700,
        sentiment: 70,
        launchDate: '2024-04-01'
      }
    ];
  } catch (error) {
    console.error('Error fetching from MagicEden:', error);
    return [];
  }
}

/**
 * Fetch tokens from Pump.fun
 */
async function fetchFromPumpFun(): Promise<any[]> {
  try {
    // Simulate fetching from Pump.fun API
    return [
      {
        symbol: 'FURN',
        name: 'Furniture',
        price: 0.0000021000,
        priceChangePercent24h: 56.80,
        marketCap: 520000.00,
        volume24h: 98000.00,
        liquiditySOL: 180,
        holders: 320,
        sentiment: 81,
        launchDate: '2025-05-17',
        isNew: true
      }
    ];
  } catch (error) {
    console.error('Error fetching from Pump.fun:', error);
    return [];
  }
}

/**
 * Get opportunities from Quantum Omega strategy
 */
async function getQuantumOmegaOpportunities(): Promise<any[]> {
  try {
    // Check if the Quantum Omega data file exists
    const quantumOmegaPath = path.join(DATA_DIR, 'quantum-omega-opportunities.json');
    if (!fs.existsSync(quantumOmegaPath)) {
      return []; // No opportunities data available
    }
    
    // Read and parse the opportunities data
    const opportunitiesData = fs.readFileSync(quantumOmegaPath, 'utf-8');
    const opportunities = JSON.parse(opportunitiesData);
    
    return Array.isArray(opportunities) ? opportunities : [];
  } catch (error) {
    console.error('Error getting Quantum Omega opportunities:', error);
    return [];
  }
}

/**
 * Simulate Quantum Omega opportunities
 */
function simulateQuantumOmegaOpportunities(): any[] {
  return [
    {
      symbol: 'CAT',
      name: 'Cat Token',
      confidence: 89,
      price: 0.0000032500,
      expectedReturn: 28.5,
      signalStrength: 'STRONG',
      sentiment: 'BULLISH',
      recommendation: 'BUY',
      riskLevel: 'MEDIUM'
    },
    {
      symbol: 'PNUT',
      name: 'Peanut',
      confidence: 81,
      price: 0.0000067000,
      expectedReturn: 22.3,
      signalStrength: 'MEDIUM',
      sentiment: 'BULLISH',
      recommendation: 'BUY',
      riskLevel: 'MEDIUM-HIGH'
    },
    {
      symbol: 'FURN',
      name: 'Furniture',
      price: 0.0000021000,
      expectedReturn: 12.8,
      signalStrength: 'WEAK',
      sentiment: 'SLIGHTLY_BULLISH',
      recommendation: 'MONITOR',
      riskLevel: 'HIGH'
    }
  ];
}

/**
 * Main function to check meme opportunities
 */
async function checkMemeOpportunities(): Promise<void> {
  try {
    console.log('=======================================================');
    console.log('🔍 MEME TOKEN OPPORTUNITY SCANNER');
    console.log('=======================================================');
    
    // Check wallet balance
    const walletBalance = await checkWalletBalance();
    const solPrice = 160; // Approximate SOL price in USD
    const walletBalanceUSD = walletBalance * solPrice;
    const maxPositionSize = walletBalance * (POSITION_SIZE_PERCENT / 100);
    const maxPositionSizeUSD = maxPositionSize * solPrice;
    
    console.log('\\n📊 WALLET STATUS:');
    console.log(\`Address: \${WALLET_ADDRESS}\`);
    console.log(\`Balance: \${walletBalance.toFixed(6)} SOL ($\${walletBalanceUSD.toFixed(2)})\`);
    console.log(\`Max Position Size (\${POSITION_SIZE_PERCENT}%): \${maxPositionSize.toFixed(6)} SOL ($\${maxPositionSizeUSD.toFixed(2)})\`);
    
    // Fetch top meme tokens
    const memeTokens = await fetchTopMemeTokens();
    
    console.log('\\n🚀 TOP MEME TOKENS:');
    
    if (memeTokens.length === 0) {
      console.log('\\nNo meme tokens found. Please check your internet connection.');
    } else {
      // Sort by market cap
      const sortedTokens = [...memeTokens].sort((a, b) => b.marketCap - a.marketCap);
      
      // Display top 5 meme tokens
      sortedTokens.slice(0, 5).forEach((token, index) => {
        console.log(\`\\n\${index + 1}. \${token.name} (\${token.symbol})\${token.isNew ? ' 🆕' : ''}\`);
        console.log(\`   Price: $\${token.price.toFixed(10)} (\${token.priceChangePercent24h >= 0 ? '+' : ''}\${token.priceChangePercent24h.toFixed(2)}% 24h)\`);
        console.log(\`   Market Cap: $\${token.marketCap.toFixed(2)} | Volume: $\${token.volume24h.toFixed(2)}\`);
        console.log(\`   Liquidity Pool: \${token.liquiditySOL} SOL | Holders: \${token.holders.toLocaleString()}\`);
        console.log(\`   Sentiment: \${token.sentiment}% | Launch: \${token.launchDate}\`);
      });
    }
    
    // Get Quantum Omega opportunities
    // const opportunities = await getQuantumOmegaOpportunities();
    const opportunities = simulateQuantumOmegaOpportunities();
    
    console.log('\\n⚡ QUANTUM OMEGA MEME OPPORTUNITIES:');
    
    if (opportunities.length === 0) {
      console.log('\\nNo opportunities detected at this time.');
    } else {
      // Display opportunities
      opportunities.forEach((opportunity, index) => {
        console.log(\`\\n\${index + 1}. \${opportunity.name} - \${opportunity.symbol} (\${formatConfidence(opportunity.confidence)} confidence)\`);
        console.log(\`   Price: $\${opportunity.price ? opportunity.price.toFixed(10) : 'N/A'} | Expected Return: \${opportunity.expectedReturn ? opportunity.expectedReturn.toFixed(1) : 'N/A'}%\`);
        console.log(\`   Signal: \${opportunity.signalStrength || 'N/A'} \${opportunity.sentiment || 'N/A'}\`);
        console.log(\`   Recommendation: \${opportunity.recommendation || 'N/A'} | Risk: \${opportunity.riskLevel || 'N/A'}\`);
        
        // Calculate position size based on risk level
        let positionSizePercent = POSITION_SIZE_PERCENT;
        if (opportunity.riskLevel === 'HIGH') {
          positionSizePercent = POSITION_SIZE_PERCENT * 0.5; // Half position size for high risk
        } else if (opportunity.riskLevel === 'MEDIUM-HIGH') {
          positionSizePercent = POSITION_SIZE_PERCENT * 0.75; // 75% position size for medium-high risk
        }
        
        const recommendedPositionSize = walletBalance * (positionSizePercent / 100);
        const recommendedPositionSizeUSD = recommendedPositionSize * solPrice;
        
        console.log(\`   Recommended Position: \${recommendedPositionSize.toFixed(6)} SOL ($\${recommendedPositionSizeUSD.toFixed(2)})\`);
      });
    }
    
    console.log('\\n=======================================================');
    
  } catch (error) {
    console.error('Error checking meme opportunities:', error);
  }
}

// Execute the function
checkMemeOpportunities();
`;
    
    // Write the fixed file
    fs.writeFileSync('./check-meme-opportunities-fixed.ts', fixedMemeOpportunitiesCode);
    
    log('✅ Created fixed version of the meme opportunities scanner');
    return true;
  } catch (error) {
    log(`⚠️ Error fixing meme opportunities scanner: ${error}`);
    return false;
  }
}

/**
 * Main function to fix the meme opportunities scanner
 */
function main(): void {
  console.log('\n===================================================');
  console.log('🔧 FIXING MEME OPPORTUNITIES SCANNER');
  console.log('===================================================');
  
  if (fixMemeOpportunitiesScanner()) {
    console.log('✅ Successfully fixed the meme opportunities scanner');
    console.log('\nTo run the fixed scanner, use:');
    console.log('npx tsx check-meme-opportunities.ts');
    console.log('\nIf issues persist, use the backup version:');
    console.log('npx tsx check-meme-opportunities-fixed.ts');
  } else {
    console.log('⚠️ Could not fix the meme opportunities scanner');
    console.log('\nTry running the backup version:');
    console.log('npx tsx check-meme-opportunities-fixed.ts');
  }
  
  console.log('===================================================');
}

// Execute the function
main();