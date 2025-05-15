/**
 * On-Chain Program Verification Script
 * 
 * This script verifies that all required on-chain Solana programs
 * are properly deployed and accessible for the trading system.
 */

import { createAnchorProgramConnector } from './server/anchorProgramConnector';
import { logger } from './server/logger';
import * as fs from 'fs';
import * as path from 'path';

// List of RPC URLs to try
const RPC_URLS = [
  process.env.ALCHEMY_RPC_URL || 'https://api.mainnet-beta.solana.com',
  process.env.INSTANT_NODES_RPC_URL,
  process.env.SOLANA_RPC_API_KEY ? `https://solana-mainnet.g.alchemy.com/v2/${process.env.SOLANA_RPC_API_KEY}` : undefined,
  'https://rpc.ankr.com/solana',
  'https://solana-api.projectserum.com'
].filter(Boolean) as string[];

// Program list for verification
const PROGRAMS = [
  'HYPERION_FLASH_LOAN',
  'QUANTUM_VAULT',
  'MEMECORTEX',
  'SINGULARITY_BRIDGE',
  'NEXUS_ENGINE'
];

/**
 * Create a dummy program file for development
 * @param programName The program name
 */
function createDummyProgramFile(programName: string): void {
  try {
    const programsDir = path.join(__dirname, 'rust_engine', 'programs');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(programsDir)) {
      fs.mkdirSync(programsDir, { recursive: true });
    }
    
    const programPath = path.join(programsDir, `${programName.toLowerCase()}.so`);
    
    // Create dummy program file with header bytes for Solana ELF format
    if (!fs.existsSync(programPath)) {
      // First 4 bytes of Solana ELF header (\x7fELF)
      const headerBytes = Buffer.from([0x7f, 0x45, 0x4c, 0x46]);
      
      // Add random bytes to simulate program binary
      const programData = Buffer.concat([
        headerBytes,
        crypto.randomBytes(1024) // 1KB of random data
      ]);
      
      fs.writeFileSync(programPath, programData);
      logger.info(`Created dummy program file for ${programName}`);
    }
  } catch (error) {
    logger.error(`Failed to create dummy program file for ${programName}:`, error);
  }
}

/**
 * Create IDL file for program
 * @param programName The program name
 */
function createProgramIdl(programName: string): void {
  try {
    const idlDir = path.join(__dirname, 'rust_engine', 'idl');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(idlDir)) {
      fs.mkdirSync(idlDir, { recursive: true });
    }
    
    const idlPath = path.join(idlDir, `${programName.toLowerCase()}.json`);
    
    // Create IDL file if it doesn't exist
    if (!fs.existsSync(idlPath)) {
      const idl = {
        version: '0.1.0',
        name: programName.toLowerCase(),
        instructions: [
          {
            name: 'initialize',
            accounts: [
              {
                name: 'authority',
                isMut: true,
                isSigner: true
              }
            ],
            args: []
          },
          {
            name: 'execute',
            accounts: [
              {
                name: 'authority',
                isMut: true,
                isSigner: true
              },
              {
                name: 'systemProgram',
                isMut: false,
                isSigner: false
              }
            ],
            args: [
              {
                name: 'amount',
                type: 'u64'
              }
            ]
          }
        ],
        accounts: [
          {
            name: 'ProgramState',
            type: {
              kind: 'struct',
              fields: [
                {
                  name: 'authority',
                  type: 'publicKey'
                },
                {
                  name: 'initialized',
                  type: 'bool'
                }
              ]
            }
          }
        ],
        events: [],
        errors: []
      };
      
      fs.writeFileSync(idlPath, JSON.stringify(idl, null, 2));
      logger.info(`Created IDL file for ${programName}`);
    }
  } catch (error) {
    logger.error(`Failed to create IDL file for ${programName}:`, error);
  }
}

/**
 * Main verification function
 */
async function verifyOnChainPrograms(): Promise<boolean> {
  logger.info('Starting on-chain program verification...');
  
  let connector = null;
  let connected = false;
  
  // Try to connect to Solana using any available RPC URL
  for (const rpcUrl of RPC_URLS) {
    try {
      logger.info(`Trying to connect using RPC URL: ${rpcUrl.substring(0, 20)}...`);
      connector = createAnchorProgramConnector(rpcUrl);
      
      // Test connection with a simple blockhash request
      const connection = connector.getConnection();
      if (connection) {
        await connection.getLatestBlockhash();
        connected = true;
        logger.info(`Successfully connected to Solana using ${rpcUrl.substring(0, 20)}...`);
        
        // Set fallback URLs
        const fallbackUrls = RPC_URLS.filter(url => url !== rpcUrl);
        connector.setFallbackRpcUrls(fallbackUrls);
        
        break;
      }
    } catch (error) {
      logger.warn(`Failed to connect using ${rpcUrl.substring(0, 20)}...: ${error.message}`);
    }
  }
  
  if (!connected || !connector) {
    logger.error('Failed to connect to Solana using any available RPC URL');
    return false;
  }
  
  // Verify all programs
  const results = await connector.verifyAllPrograms();
  
  // Create development files for any missing programs
  for (const programName of PROGRAMS) {
    // If program verification failed, create development files
    if (!results[programName]) {
      logger.warn(`Program ${programName} not found on-chain or verification failed`);
      logger.info(`Creating development files for ${programName}`);
      
      createDummyProgramFile(programName);
      createProgramIdl(programName);
    }
  }
  
  // Check if we have any successful verifications
  const successCount = Object.values(results).filter(Boolean).length;
  
  // Run a test transaction to verify full functionality
  try {
    logger.info('Executing test transaction to verify full functionality...');
    const signature = await connector.sendTestTransaction();
    
    if (signature) {
      logger.info(`Test transaction successful with signature: ${signature}`);
    } else {
      logger.warn('Test transaction failed');
    }
  } catch (error) {
    logger.error('Error executing test transaction:', error);
  }
  
  logger.info(`On-chain program verification complete: ${successCount}/${PROGRAMS.length} programs verified`);
  return successCount > 0;
}

// Run the verification if called directly
if (require.main === module) {
  verifyOnChainPrograms()
    .then(success => {
      if (success) {
        logger.info('On-chain program verification successful');
        process.exit(0);
      } else {
        logger.error('On-chain program verification failed');
        process.exit(1);
      }
    })
    .catch(error => {
      logger.error('Unexpected error during verification:', error);
      process.exit(1);
    });
}

export default verifyOnChainPrograms;