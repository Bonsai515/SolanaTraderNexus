/**
 * Integrate On-Chain Programs
 * 
 * This script integrates your deployed Solana on-chain programs
 * with the trading system for maximum performance and efficiency.
 */

import { Connection, PublicKey, Keypair, Transaction } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import * as readline from 'readline';

// Load environment variables
dotenv.config({ path: '.env.trading' });

// Constants
const WALLET_ADDRESS = process.env.WALLET_ADDRESS || 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';
const SYNDICA_API_KEY = process.env.SYNDICA_API_KEY || 'q4afP5dHVA6XrMLdtc6iNQAWxq2BHEWaafffQaPhvWhioSHcQbAoRNs8ekprPyThzTfCc2aFk5wKeAzf2HBtmSw4rwaPnmKwtk';
const SYNDICA_URL = `https://solana-mainnet.api.syndica.io/api-key/${SYNDICA_API_KEY}`;
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;

// Create connection to Solana
const connection = new Connection(SYNDICA_URL, 'confirmed');

// User on-chain program IDs
type ProgramConfig = {
  programId: string;
  name: string;
  description: string;
  type: 'flash-loan' | 'arbitrage' | 'mev' | 'temporal' | 'nuclear';
  initialized: boolean;
};

// Default on-chain programs to integrate
const DEFAULT_PROGRAMS: ProgramConfig[] = [
  {
    programId: 'FsJ3A3u2vn5cTVofAjvy6y5kwABJAqYWpe4975bi2epH',
    name: 'FlashLoanArbitrageProgram',
    description: 'Flash loan arbitrage execution program',
    type: 'flash-loan',
    initialized: false
  },
  {
    programId: 'HZEhoqiR9EQpaiTLzdXZLQ2m5ksJMNLj6NHgT4PmXmX9',
    name: 'TemporalBlockArbitrageProgram',
    description: 'Temporal block arbitrage execution program',
    type: 'temporal',
    initialized: false
  },
  {
    programId: 'NucLearMoNeyG1iTchPr0GraM6DCxHW2ePSyhNG1nLd',
    name: 'NuclearMoneyGlitchProgram',
    description: 'Nuclear money glitch execution program',
    type: 'nuclear',
    initialized: false
  },
  {
    programId: 'MEVpRotecTionZqsNsQVuqXNS4mLovmjARi9ZVjzAF',
    name: 'MevProtectionProgram',
    description: 'MEV protection execution program',
    type: 'mev',
    initialized: false
  },
  {
    programId: 'ZeR0CaPita1F1ASHxtrdr7MJ9zWF1dTCJP9NuHsKYs2',
    name: 'ZeroCapitalFlashProgram',
    description: 'Zero capital flash execution program',
    type: 'flash-loan',
    initialized: false
  }
];

/**
 * Log message with timestamp
 */
function log(message: string, type: 'info' | 'success' | 'warn' | 'error' = 'info'): void {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}]`;
  
  switch (type) {
    case 'info':
      console.log(`${prefix} ${message}`);
      break;
    case 'success':
      console.log(`${prefix} ✅ ${message}`);
      break;
    case 'warn':
      console.warn(`${prefix} ⚠️ ${message}`);
      break;
    case 'error':
      console.error(`${prefix} ❌ ${message}`);
      break;
  }
}

/**
 * Check if a program exists on-chain
 */
async function checkProgramExists(programId: string): Promise<boolean> {
  try {
    const pubkey = new PublicKey(programId);
    const accountInfo = await connection.getAccountInfo(pubkey);
    return accountInfo !== null && accountInfo.executable;
  } catch (error) {
    log(`Error checking program ${programId}: ${error}`, 'error');
    return false;
  }
}

/**
 * Ask user for program IDs to integrate
 */
async function askForProgramIds(): Promise<ProgramConfig[]> {
  console.log('\n=== ON-CHAIN PROGRAM INTEGRATION ===');
  console.log('Please provide the program IDs of your on-chain programs to integrate.');
  console.log('Press Enter to use default values or "none" to skip.');
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const programs: ProgramConfig[] = [];
  
  // Ask for flash loan program ID
  let flashLoanId = await new Promise<string>((resolve) => {
    rl.question('\nFlash Loan Program ID (default: FsJ3A3u2vn5cTVofAjvy6y5kwABJAqYWpe4975bi2epH): ', (answer) => {
      resolve(answer.trim() || 'FsJ3A3u2vn5cTVofAjvy6y5kwABJAqYWpe4975bi2epH');
    });
  });
  
  if (flashLoanId.toLowerCase() !== 'none') {
    programs.push({
      programId: flashLoanId,
      name: 'FlashLoanArbitrageProgram',
      description: 'Flash loan arbitrage execution program',
      type: 'flash-loan',
      initialized: false
    });
  }
  
  // Ask for temporal block program ID
  let temporalId = await new Promise<string>((resolve) => {
    rl.question('\nTemporal Block Program ID (default: HZEhoqiR9EQpaiTLzdXZLQ2m5ksJMNLj6NHgT4PmXmX9): ', (answer) => {
      resolve(answer.trim() || 'HZEhoqiR9EQpaiTLzdXZLQ2m5ksJMNLj6NHgT4PmXmX9');
    });
  });
  
  if (temporalId.toLowerCase() !== 'none') {
    programs.push({
      programId: temporalId,
      name: 'TemporalBlockArbitrageProgram',
      description: 'Temporal block arbitrage execution program',
      type: 'temporal',
      initialized: false
    });
  }
  
  // Ask for nuclear program ID
  let nuclearId = await new Promise<string>((resolve) => {
    rl.question('\nNuclear Money Glitch Program ID (default: NucLearMoNeyG1iTchPr0GraM6DCxHW2ePSyhNG1nLd): ', (answer) => {
      resolve(answer.trim() || 'NucLearMoNeyG1iTchPr0GraM6DCxHW2ePSyhNG1nLd');
    });
  });
  
  if (nuclearId.toLowerCase() !== 'none') {
    programs.push({
      programId: nuclearId,
      name: 'NuclearMoneyGlitchProgram',
      description: 'Nuclear money glitch execution program',
      type: 'nuclear',
      initialized: false
    });
  }
  
  // Ask for MEV protection program ID
  let mevId = await new Promise<string>((resolve) => {
    rl.question('\nMEV Protection Program ID (default: MEVpRotecTionZqsNsQVuqXNS4mLovmjARi9ZVjzAF): ', (answer) => {
      resolve(answer.trim() || 'MEVpRotecTionZqsNsQVuqXNS4mLovmjARi9ZVjzAF');
    });
  });
  
  if (mevId.toLowerCase() !== 'none') {
    programs.push({
      programId: mevId,
      name: 'MevProtectionProgram',
      description: 'MEV protection execution program',
      type: 'mev',
      initialized: false
    });
  }
  
  // Ask for Zero Capital program ID
  let zeroCapId = await new Promise<string>((resolve) => {
    rl.question('\nZero Capital Flash Program ID (default: ZeR0CaPita1F1ASHxtrdr7MJ9zWF1dTCJP9NuHsKYs2): ', (answer) => {
      resolve(answer.trim() || 'ZeR0CaPita1F1ASHxtrdr7MJ9zWF1dTCJP9NuHsKYs2');
    });
  });
  
  if (zeroCapId.toLowerCase() !== 'none') {
    programs.push({
      programId: zeroCapId,
      name: 'ZeroCapitalFlashProgram',
      description: 'Zero capital flash execution program',
      type: 'flash-loan',
      initialized: false
    });
  }
  
  // Ask for any additional program IDs
  let additionalId = await new Promise<string>((resolve) => {
    rl.question('\nAny additional Program ID (or press Enter to skip): ', (answer) => {
      resolve(answer.trim());
    });
  });
  
  if (additionalId && additionalId.toLowerCase() !== 'none') {
    let additionalName = await new Promise<string>((resolve) => {
      rl.question('Name for this program: ', (answer) => {
        resolve(answer.trim() || 'CustomProgram');
      });
    });
    
    let additionalType = await new Promise<string>((resolve) => {
      rl.question('Type (flash-loan, arbitrage, mev, temporal, nuclear): ', (answer) => {
        resolve(answer.trim() || 'arbitrage');
      });
    });
    
    programs.push({
      programId: additionalId,
      name: additionalName,
      description: 'Custom on-chain program',
      type: additionalType as any,
      initialized: false
    });
  }
  
  rl.close();
  return programs;
}

/**
 * Verify programs on-chain
 */
async function verifyPrograms(programs: ProgramConfig[]): Promise<ProgramConfig[]> {
  log('Verifying on-chain programs...');
  
  const verifiedPrograms: ProgramConfig[] = [];
  
  for (const program of programs) {
    const exists = await checkProgramExists(program.programId);
    if (exists) {
      log(`Program ${program.name} (${program.programId}) exists on-chain`, 'success');
      verifiedPrograms.push({
        ...program,
        initialized: true
      });
    } else {
      log(`Program ${program.name} (${program.programId}) not found on-chain or is not executable`, 'warn');
    }
  }
  
  return verifiedPrograms;
}

/**
 * Update strategy configurations with on-chain programs
 */
function updateStrategyConfigs(programs: ProgramConfig[]): boolean {
  try {
    log('Updating strategy configurations with on-chain programs...');
    
    const configDir = path.join(process.cwd(), 'config');
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    // Map of strategy files to update
    const strategyFiles = {
      'flash-loan': ['nuclear-flash-loan-strategy.json', 'flash-loan-strategy.json'],
      'temporal': ['temporal-block-strategy.json'],
      'nuclear': ['ultimate-nuclear-money-strategy.json'],
      'mev': ['mev-protection-flash-strategy.json'],
      'arbitrage': ['layered-megalodon-strategy.json']
    };
    
    // Update each strategy with matching program
    for (const program of programs) {
      const files = strategyFiles[program.type];
      if (!files || !program.initialized) continue;
      
      for (const file of files) {
        const configPath = path.join(configDir, file);
        if (!fs.existsSync(configPath)) continue;
        
        // Read and update config
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        config.onChainProgram = {
          programId: program.programId,
          name: program.name,
          description: program.description,
          enabled: true,
          lastUpdated: new Date().toISOString()
        };
        
        // Add on-chain execution settings
        config.useOnChainExecution = true;
        config.onChainExecutionPriority = 10;
        config.simulateOnChainBeforeExecution = true;
        
        // Write updated config
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        log(`Updated ${file} with on-chain program ${program.name}`, 'success');
      }
    }
    
    return true;
  } catch (error) {
    log(`Error updating strategy configurations: ${error}`, 'error');
    return false;
  }
}

/**
 * Update system configuration with on-chain program integrations
 */
function updateSystemConfig(programs: ProgramConfig[]): boolean {
  try {
    log('Updating system configuration with on-chain programs...');
    
    const configDir = path.join(process.cwd(), 'config');
    const systemConfigPath = path.join(configDir, 'system-config.json');
    
    // Read existing config if it exists
    let systemConfig: any = {};
    if (fs.existsSync(systemConfigPath)) {
      systemConfig = JSON.parse(fs.readFileSync(systemConfigPath, 'utf8'));
    }
    
    // Update or add on-chain programs section
    systemConfig.onChainPrograms = programs.filter(p => p.initialized).map(p => ({
      programId: p.programId,
      name: p.name,
      description: p.description,
      type: p.type,
      enabled: true
    }));
    
    // Update features to include on-chain execution
    if (!systemConfig.features) {
      systemConfig.features = {};
    }
    
    systemConfig.features.useOnChainPrograms = true;
    systemConfig.features.preferOnChainExecution = true;
    systemConfig.features.simulateOnChainBeforeExecution = true;
    systemConfig.features.onChainExecutionPriority = 10;
    
    systemConfig.lastUpdated = new Date().toISOString();
    
    // Save updated config
    fs.writeFileSync(systemConfigPath, JSON.stringify(systemConfig, null, 2));
    
    // Update .env.trading file
    const envPath = path.join(process.cwd(), '.env.trading');
    let envContent = '';
    
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }
    
    // Required settings
    const settings: Record<string, string> = {
      'USE_ONCHAIN_PROGRAMS': 'true',
      'ONCHAIN_PROGRAMS_ENABLED': 'true',
      'PREFER_ONCHAIN_EXECUTION': 'true'
    };
    
    // Add program IDs to env file
    programs.filter(p => p.initialized).forEach((program, index) => {
      settings[`ONCHAIN_PROGRAM_${index + 1}_ID`] = program.programId;
      settings[`ONCHAIN_PROGRAM_${index + 1}_TYPE`] = program.type;
    });
    
    // Update each setting
    for (const [key, value] of Object.entries(settings)) {
      if (!envContent.includes(`${key}=`)) {
        envContent += `${key}=${value}\n`;
      } else {
        envContent = envContent.replace(
          new RegExp(`${key}=.*`, 'g'),
          `${key}=${value}`
        );
      }
    }
    
    // Save the updated env file
    fs.writeFileSync(envPath, envContent);
    
    log('System configuration updated with on-chain programs', 'success');
    return true;
  } catch (error) {
    log(`Error updating system configuration: ${error}`, 'error');
    return false;
  }
}

/**
 * Create on-chain program integration file
 */
function createOnChainIntegrationFile(programs: ProgramConfig[]): boolean {
  try {
    log('Creating on-chain program integration file...');
    
    const srcDir = path.join(process.cwd(), 'src');
    if (!fs.existsSync(srcDir)) {
      fs.mkdirSync(srcDir, { recursive: true });
    }
    
    const integrationPath = path.join(srcDir, 'onchain-program-integration.ts');
    
    const integrationContent = `/**
 * On-Chain Program Integration
 * 
 * This file integrates on-chain Solana programs with the trading system.
 * Generated automatically by integrate-onchain-programs.ts
 */

import { Connection, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';

// On-chain program configurations
export const ONCHAIN_PROGRAMS = [
${programs.filter(p => p.initialized).map(p => `  {
    programId: new PublicKey('${p.programId}'),
    name: '${p.name}',
    description: '${p.description}',
    type: '${p.type}',
    enabled: true
  }`).join(',\n')}
];

/**
 * Create a transaction instruction for the specified on-chain program
 */
export async function createProgramInstruction(
  connection: Connection,
  programId: string,
  data: Buffer,
  accounts: PublicKey[],
  feePayer: PublicKey
): Promise<TransactionInstruction> {
  // Find the program
  const program = ONCHAIN_PROGRAMS.find(p => p.programId.toBase58() === programId);
  if (!program) {
    throw new Error(\`Program \${programId} not found in on-chain programs\`);
  }
  
  // Create instruction keys
  const keys = accounts.map((pubkey, index) => ({
    pubkey,
    isSigner: index === 0, // First account is usually the signer
    isWritable: index !== accounts.length - 1 // All accounts except last are usually writable
  }));
  
  // Create and return instruction
  return new TransactionInstruction({
    programId: program.programId,
    keys,
    data
  });
}

/**
 * Execute a transaction using an on-chain program
 */
export async function executeOnChainTransaction(
  connection: Connection,
  instruction: TransactionInstruction,
  signers: any[],
  options: any = {}
): Promise<string> {
  // Create transaction
  const transaction = new Transaction();
  transaction.add(instruction);
  
  // Get recent blockhash
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = signers[0].publicKey;
  
  // Sign transaction
  transaction.sign(...signers);
  
  // Send and confirm transaction
  return await connection.sendRawTransaction(transaction.serialize(), options);
}
`;
    
    fs.writeFileSync(integrationPath, integrationContent);
    log('Created on-chain program integration file', 'success');
    return true;
  } catch (error) {
    log(`Error creating on-chain program integration file: ${error}`, 'error');
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  console.log('=== ON-CHAIN PROGRAM INTEGRATION ===');
  console.log(`Current Time: ${new Date().toISOString()}`);
  console.log(`Wallet Address: ${WALLET_ADDRESS}`);
  
  try {
    // Ask for program IDs
    const programs = await askForProgramIds();
    
    // Verify programs
    const verifiedPrograms = await verifyPrograms(programs);
    
    if (verifiedPrograms.length === 0) {
      log('No valid on-chain programs found. Please check your program IDs.', 'error');
      return;
    }
    
    // Update strategy configurations
    updateStrategyConfigs(verifiedPrograms);
    
    // Update system configuration
    updateSystemConfig(verifiedPrograms);
    
    // Create on-chain program integration file
    createOnChainIntegrationFile(verifiedPrograms);
    
    console.log('\n=== ON-CHAIN PROGRAM INTEGRATION COMPLETE ===');
    console.log(`Integrated ${verifiedPrograms.filter(p => p.initialized).length} on-chain programs:`);
    
    verifiedPrograms.filter(p => p.initialized).forEach(program => {
      console.log(`- ${program.name} (${program.programId}) - ${program.type}`);
    });
    
    console.log('\nYour trading system will now use these on-chain programs for execution.');
    console.log('To start trading with on-chain program integration:');
    console.log('1. For standard trading: bash launch-trading.sh');
    console.log('2. For nuclear trading: bash launch-nuclear-trading.sh');
  } catch (error) {
    console.error('Error integrating on-chain programs:', error);
  }
}

// Run the main function
main();