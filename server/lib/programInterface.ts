/**
 * On-Chain Program Interface
 * 
 * This module provides interfaces to interact with on-chain Solana programs.
 */

import { Connection, PublicKey, Transaction, TransactionInstruction, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

// Load program configuration
const PROGRAMS_CONFIG_PATH = path.join('./server/config', 'programs.json');
let programsConfig: any = {};

try {
  if (fs.existsSync(PROGRAMS_CONFIG_PATH)) {
    programsConfig = JSON.parse(fs.readFileSync(PROGRAMS_CONFIG_PATH, 'utf8'));
  }
} catch (error) {
  console.error('Error loading programs config:', error);
}

/**
 * Get program public key by name
 */
export function getProgramId(programName: string): PublicKey {
  const programId = programsConfig?.programs?.[programName]?.id;
  
  if (!programId) {
    throw new Error(`Program ID for ${programName} not found`);
  }
  
  return new PublicKey(programId);
}

/**
 * Create a flash arbitrage instruction
 */
export function createFlashArbitrageInstruction(
  userPubkey: PublicKey,
  amountIn: bigint,
  minAmountOut: bigint,
  routes: Buffer
): TransactionInstruction {
  const programId = getProgramId('hyperion');
  
  // Derive program account addresses
  const [flashArbitrageAccount] = PublicKey.findProgramAddressSync(
    [Buffer.from('flash'), Buffer.from('arb')],
    programId
  );
  
  const [vaultAccount] = PublicKey.findProgramAddressSync(
    [Buffer.from('vault')],
    programId
  );
  
  // Create instruction data
  const data = Buffer.alloc(8 + 8 + 8 + 4 + routes.length);
  // Command discriminator (0 = executeFlashArbitrage)
  data.writeUInt8(0, 0);
  // amountIn (u64)
  data.writeBigUInt64LE(amountIn, 8);
  // minAmountOut (u64)
  data.writeBigUInt64LE(minAmountOut, 16);
  // routes length
  data.writeUInt32LE(routes.length, 24);
  // routes data
  routes.copy(data, 28);
  
  return new TransactionInstruction({
    keys: [
      { pubkey: flashArbitrageAccount, isSigner: false, isWritable: true },
      { pubkey: vaultAccount, isSigner: false, isWritable: true },
      { pubkey: userPubkey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    programId,
    data
  });
}

/**
 * Create a MEV extraction instruction
 */
export function createMEVExtractionInstruction(
  userPubkey: PublicKey,
  searchParams: Buffer,
  maxSlippage: bigint
): TransactionInstruction {
  const programId = getProgramId('quantumMEV');
  
  // Derive program account addresses
  const [mevExtractorAccount] = PublicKey.findProgramAddressSync(
    [Buffer.from('mev'), Buffer.from('extract')],
    programId
  );
  
  const [bundlerAccount] = PublicKey.findProgramAddressSync(
    [Buffer.from('bundle')],
    programId
  );
  
  // Create instruction data
  const data = Buffer.alloc(8 + 4 + searchParams.length + 8);
  // Command discriminator (0 = extractMEV)
  data.writeUInt8(0, 0);
  // searchParams length
  data.writeUInt32LE(searchParams.length, 8);
  // searchParams data
  searchParams.copy(data, 12);
  // maxSlippage (u64)
  data.writeBigUInt64LE(maxSlippage, 12 + searchParams.length);
  
  return new TransactionInstruction({
    keys: [
      { pubkey: mevExtractorAccount, isSigner: false, isWritable: true },
      { pubkey: bundlerAccount, isSigner: false, isWritable: true },
      { pubkey: userPubkey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId,
    data
  });
}

/**
 * Create a meme token snipe instruction
 */
export function createMemeSnipeInstruction(
  userPubkey: PublicKey,
  tokenMint: PublicKey,
  amountIn: bigint,
  minAmountOut: bigint,
  maxSlippage: number
): TransactionInstruction {
  const programId = getProgramId('memeCortex');
  
  // Derive program account addresses
  const [memeAnalyzerAccount] = PublicKey.findProgramAddressSync(
    [Buffer.from('meme'), Buffer.from('analysis')],
    programId
  );
  
  const [sniperAccount] = PublicKey.findProgramAddressSync(
    [Buffer.from('snipe')],
    programId
  );
  
  // Create instruction data
  const data = Buffer.alloc(8 + 32 + 8 + 8 + 2);
  // Command discriminator (1 = executeMemeSnipe)
  data.writeUInt8(1, 0);
  // tokenMint (publicKey)
  tokenMint.toBuffer().copy(data, 8);
  // amountIn (u64)
  data.writeBigUInt64LE(amountIn, 40);
  // minAmountOut (u64)
  data.writeBigUInt64LE(minAmountOut, 48);
  // maxSlippage (u16)
  data.writeUInt16LE(maxSlippage, 56);
  
  return new TransactionInstruction({
    keys: [
      { pubkey: sniperAccount, isSigner: false, isWritable: true },
      { pubkey: userPubkey, isSigner: true, isWritable: true },
      { pubkey: tokenMint, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId,
    data
  });
}

/**
 * Check if program exists and is executable
 */
export async function checkProgramExists(connection: Connection, programName: string): Promise<boolean> {
  try {
    const programId = getProgramId(programName);
    const accountInfo = await connection.getAccountInfo(programId);
    
    return accountInfo !== null && accountInfo.executable;
  } catch (error) {
    console.error(`Error checking program ${programName}:`, error);
    return false;
  }
}

/**
 * Call a program to execute an instruction and return the transaction signature
 */
export async function executeOnChainInstruction(
  connection: Connection,
  instruction: TransactionInstruction,
  sender: PublicKey
): Promise<string> {
  try {
    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    
    // Create transaction
    const transaction = new Transaction({
      feePayer: sender,
      blockhash,
      lastValidBlockHeight: await connection.getBlockHeight()
    }).add(instruction);
    
    // Send transaction
    const signature = await connection.sendRawTransaction(transaction.serialize());
    
    // Wait for confirmation
    const confirmation = await connection.confirmTransaction(signature);
    
    if (confirmation.value.err) {
      throw new Error(`Transaction failed: ${confirmation.value.err}`);
    }
    
    return signature;
  } catch (error) {
    throw new Error(`Failed to execute on-chain instruction: ${error.message}`);
  }
}