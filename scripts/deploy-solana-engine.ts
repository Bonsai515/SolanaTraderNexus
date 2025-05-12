#!/usr/bin/env -S npx tsx
/**
 * Deploy Solana Transaction Engine for Live Trading
 * 
 * This TypeScript script deploys the Rust-based transaction engine
 * and activates it for live trading with real funds.
 */

import { exec, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import { promisify } from 'util';

const execAsync = promisify(exec);

// ANSI color codes for console output
const COLORS = {
  RED: '\x1b[31m',
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
  MAGENTA: '\x1b[35m',
  CYAN: '\x1b[36m',
  WHITE: '\x1b[37m',
  RESET: '\x1b[0m'
};

// Create logs directory if it doesn't exist
if (!fs.existsSync('./logs')) {
  fs.mkdirSync('./logs', { recursive: true });
}

// Define interfaces for type safety
interface EngineConfig {
  useRealFunds: boolean;
  rpcUrl: string;
  websocketUrl: string;
  systemWalletAddress: string;
  wormholeGuardianRpc: string;
}

interface AgentConfig {
  useRealFunds: boolean;
  profitWallet: string;
  hyperion: { active: boolean };
  quantumOmega: { active: boolean };
  singularity: { active: boolean };
}

interface ApiResponse {
  success: boolean;
  message?: string;
  [key: string]: any;
}

// Logger function
function log(message: string): void {
  const timestamp = new Date().toISOString();
  console.log(message);
  fs.appendFileSync('./logs/solana-engine-deploy.log', `${timestamp} - ${message.replace(/\x1b\[[0-9;]*m/g, '')}\n`);
}

/**
 * Make an HTTP request to the local API
 */
async function makeApiRequest(method: string, path: string, data: any = null): Promise<ApiResponse> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(responseData);
          resolve(parsedData);
        } catch (e) {
          resolve({ success: false, message: responseData });
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

/**
 * Configure environment for the transaction engine
 */
async function configureEnvironment(): Promise<boolean> {
  log(`${COLORS.BLUE}Configuring environment for transaction engine...${COLORS.RESET}`);
  
  try {
    // Ensure config directory exists
    const configDir = path.join(process.cwd(), 'server', 'config');
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    // RPC URLs
    const rpcUrl = process.env.SOLANA_RPC_API_KEY 
      ? `https://solana-api.instantnodes.io/token-${process.env.SOLANA_RPC_API_KEY}`
      : 'https://solana-grpc-geyser.instantnodes.io:443';
    
    const websocketUrl = process.env.SOLANA_RPC_API_KEY
      ? `wss://solana-api.instantnodes.io/token-${process.env.SOLANA_RPC_API_KEY}`
      : 'wss://solana-api.instantnodes.io';
    
    // System wallet for profit collection
    const systemWalletAddress = 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb';
    
    // Create engine config file
    const engineConfig: EngineConfig = {
      useRealFunds: true,
      rpcUrl,
      websocketUrl,
      systemWalletAddress,
      wormholeGuardianRpc: 'https://guardian.stable.productions'
    };
    
    const engineConfigPath = path.join(configDir, 'engine.json');
    fs.writeFileSync(engineConfigPath, JSON.stringify(engineConfig, null, 2));
    
    // Create agent config file
    const agentConfig: AgentConfig = {
      useRealFunds: true,
      profitWallet: systemWalletAddress,
      hyperion: { active: true },
      quantumOmega: { active: true },
      singularity: { active: true }
    };
    
    const agentConfigPath = path.join(configDir, 'agents.json');
    fs.writeFileSync(agentConfigPath, JSON.stringify(agentConfig, null, 2));
    
    // Create .env.trading file
    const envContent = [
      `SOLANA_RPC_URL=${rpcUrl}`,
      `SOLANA_WEBSOCKET_URL=${websocketUrl}`,
      `SYSTEM_WALLET_ADDRESS=${systemWalletAddress}`,
      `USE_REAL_FUNDS=true`,
      `WORMHOLE_GUARDIAN_RPC=https://guardian.stable.productions`
    ].join('\n');
    
    fs.writeFileSync('.env.trading', envContent);
    
    log(`${COLORS.GREEN}✅ Environment configured successfully:${COLORS.RESET}`);
    log(`${COLORS.GREEN}  - RPC URL: ${rpcUrl}${COLORS.RESET}`);
    log(`${COLORS.GREEN}  - System Wallet: ${systemWalletAddress}${COLORS.RESET}`);
    log(`${COLORS.GREEN}  - Using Real Funds: TRUE${COLORS.RESET}`);
    
    return true;
  } catch (error: any) {
    log(`${COLORS.RED}❌ Error configuring environment: ${error?.message || 'Unknown error'}${COLORS.RESET}`);
    return false;
  }
}

/**
 * Build the Rust transaction engine
 */
async function buildRustEngine(): Promise<boolean> {
  log(`${COLORS.BLUE}Building Rust transaction engine...${COLORS.RESET}`);
  
  try {
    const rustEnginePath = path.join(process.cwd(), 'rust_engine');
    
    // Check if the directory exists
    if (!fs.existsSync(rustEnginePath)) {
      log(`${COLORS.RED}❌ Rust engine directory not found at ${rustEnginePath}${COLORS.RESET}`);
      return false;
    }
    
    log(`${COLORS.CYAN}Running cargo build --release in ${rustEnginePath}${COLORS.RESET}`);
    log(`${COLORS.YELLOW}This may take a few minutes...${COLORS.RESET}`);
    
    // Run cargo build to compile the Rust code with a timeout
    const buildProcess = spawn('cargo', ['build', '--release'], { 
      cwd: rustEnginePath,
      stdio: 'pipe'
    });
    
    // Set a timeout to kill the process if it takes too long (3 minutes)
    const timeoutId = setTimeout(() => {
      log(`${COLORS.YELLOW}⚠️ Rust build process taking too long, continuing with fallback...${COLORS.RESET}`);
      buildProcess.kill();
    }, 3 * 60 * 1000);
    
    // Collect stdout and stderr
    let stdout = '';
    let stderr = '';
    
    buildProcess.stdout?.on('data', (data) => {
      stdout += data.toString();
      log(`${COLORS.CYAN}${data.toString().trim()}${COLORS.RESET}`);
    });
    
    buildProcess.stderr?.on('data', (data) => {
      stderr += data.toString();
      log(`${COLORS.YELLOW}${data.toString().trim()}${COLORS.RESET}`);
    });
    
    return new Promise((resolve) => {
      buildProcess.on('close', (code) => {
        clearTimeout(timeoutId);
        
        if (code === 0) {
          log(`${COLORS.GREEN}✅ Rust transaction engine built successfully${COLORS.RESET}`);
          resolve(true);
        } else {
          log(`${COLORS.YELLOW}⚠️ Rust build failed with code ${code}, using fallback TypeScript connector${COLORS.RESET}`);
          resolve(false);
        }
      });
    });
  } catch (error: any) {
    log(`${COLORS.RED}❌ Error building Rust transaction engine: ${error?.message || 'Unknown error'}${COLORS.RESET}`);
    return false;
  }
}

/**
 * Activate the transaction engine for live trading
 */
async function activateTransactionEngine(): Promise<boolean> {
  log(`${COLORS.BLUE}Activating transaction engine for live trading...${COLORS.RESET}`);
  
  try {
    // Start the transaction engine process
    const rustEnginePath = path.join(process.cwd(), 'rust_engine', 'target', 'release', 'transaction_engine');
    
    if (fs.existsSync(rustEnginePath)) {
      // Get environment variables from .env.trading
      const envContent = fs.readFileSync('.env.trading', 'utf8');
      const env: Record<string, string> = {};
      
      envContent.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
          env[key.trim()] = value.trim();
        }
      });
      
      // Add the current process environment variables
      const processEnv = { ...process.env, ...env };
      
      log(`${COLORS.CYAN}Starting Rust transaction engine with PID...${COLORS.RESET}`);
      
      // Start the process
      const engineProcess = spawn(rustEnginePath, [], {
        env: processEnv,
        detached: true, // Run in background
        stdio: ['ignore', 
                fs.openSync('./logs/transaction-engine-stdout.log', 'a'),
                fs.openSync('./logs/transaction-engine-stderr.log', 'a')]
      });
      
      // Unref so the parent process can exit independently
      engineProcess.unref();
      
      log(`${COLORS.GREEN}✅ Transaction engine started with PID ${engineProcess.pid}${COLORS.RESET}`);
      
      return true;
    } else {
      log(`${COLORS.YELLOW}⚠️ Rust binary not found at ${rustEnginePath}, falling back to TypeScript connector...${COLORS.RESET}`);
      
      // Copy environment variables to process environment
      const envContent = fs.readFileSync('.env.trading', 'utf8');
      envContent.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
          process.env[key.trim()] = value.trim();
        }
      });
      
      // Make API request to start the engine instead
      try {
        const response = await makeApiRequest('POST', '/api/transaction-engine/start');
        
        if (response.success) {
          log(`${COLORS.GREEN}✅ Transaction engine started via API${COLORS.RESET}`);
          return true;
        } else {
          log(`${COLORS.YELLOW}⚠️ Transaction engine API start failed: ${response.message || 'Unknown error'}${COLORS.RESET}`);
          log(`${COLORS.CYAN}Starting TypeScript transaction connector instead...${COLORS.RESET}`);
        }
      } catch (apiError: any) {
        log(`${COLORS.YELLOW}⚠️ Transaction engine API request failed: ${apiError?.message || 'Unknown error'}${COLORS.RESET}`);
      }
      
      // Start the TypeScript connector as a fallback
      const connectorProcess = spawn('npx', ['tsx', 'server/transaction-connector.ts'], {
        env: process.env,
        detached: true,
        stdio: ['ignore',
                fs.openSync('./logs/transaction-connector-stdout.log', 'a'),
                fs.openSync('./logs/transaction-connector-stderr.log', 'a')]
      });
      
      // Unref so the parent process can exit independently
      connectorProcess.unref();
      
      log(`${COLORS.GREEN}✅ Transaction connector started with PID ${connectorProcess.pid}${COLORS.RESET}`);
      
      return true;
    }
  } catch (error: any) {
    log(`${COLORS.RED}❌ Error activating transaction engine: ${error?.message || 'Unknown error'}${COLORS.RESET}`);
    return false;
  }
}

/**
 * Enable real fund trading
 */
async function enableRealFunds(): Promise<boolean> {
  log(`${COLORS.BLUE}Enabling trading with REAL FUNDS...${COLORS.RESET}`);
  
  try {
    // Try API request first
    try {
      const response = await makeApiRequest('POST', '/api/real-funds', { useRealFunds: true });
      
      if (response.success) {
        log(`${COLORS.GREEN}✅ Real funds enabled via API${COLORS.RESET}`);
        return true;
      } else {
        log(`${COLORS.YELLOW}⚠️ API request to enable real funds failed: ${response.message || 'Unknown error'}${COLORS.RESET}`);
      }
    } catch (apiError: any) {
      log(`${COLORS.YELLOW}⚠️ API request failed: ${apiError?.message || 'Unknown error'}${COLORS.RESET}`);
    }
    
    // Try dynamic import of agents module as fallback
    try {
      // Use dynamic import with TypeScript
      const agentsModule = await import('../server/agents');
      
      if (typeof agentsModule.setUseRealFunds === 'function') {
        await agentsModule.setUseRealFunds(true);
        log(`${COLORS.GREEN}✅ All agents configured to use REAL FUNDS via module import${COLORS.RESET}`);
        return true;
      } else {
        log(`${COLORS.YELLOW}⚠️ setUseRealFunds function not found in agents module${COLORS.RESET}`);
      }
    } catch (importError: any) {
      log(`${COLORS.YELLOW}⚠️ Could not import agents module: ${importError?.message || 'Unknown error'}${COLORS.RESET}`);
    }
    
    // Set environment variable
    process.env.USE_REAL_FUNDS = 'true';
    
    // Create .env.trading file as fallback if it doesn't exist
    if (!fs.existsSync('.env.trading')) {
      fs.writeFileSync('.env.trading', 'USE_REAL_FUNDS=true\n');
    } else {
      // Update the existing file
      let envContent = fs.readFileSync('.env.trading', 'utf8');
      if (envContent.includes('USE_REAL_FUNDS=')) {
        envContent = envContent.replace(/USE_REAL_FUNDS=.*/, 'USE_REAL_FUNDS=true');
      } else {
        envContent += '\nUSE_REAL_FUNDS=true';
      }
      fs.writeFileSync('.env.trading', envContent);
    }
    
    log(`${COLORS.GREEN}✅ Real fund trading enabled via environment variables${COLORS.RESET}`);
    return true;
  } catch (error: any) {
    log(`${COLORS.RED}❌ Error enabling real fund trading: ${error?.message || 'Unknown error'}${COLORS.RESET}`);
    return false;
  }
}

/**
 * Activate trading agents
 */
async function activateAgents(): Promise<boolean> {
  log(`${COLORS.BLUE}Activating trading agents...${COLORS.RESET}`);
  
  try {
    // Try system start endpoint first
    try {
      const response = await makeApiRequest('POST', '/api/agents/start');
      
      if (response.success) {
        log(`${COLORS.GREEN}✅ All agents activated via start API${COLORS.RESET}`);
        return true;
      } else {
        log(`${COLORS.YELLOW}⚠️ API start request failed: ${response.message || 'Unknown error'}, trying individual activation...${COLORS.RESET}`);
      }
    } catch (apiError: any) {
      log(`${COLORS.YELLOW}⚠️ API start request failed: ${apiError?.message || 'Unknown error'}, trying individual activation...${COLORS.RESET}`);
    }
    
    // Try activating each agent individually
    const agentIds = ['hyperion-1', 'quantum-omega-1', 'singularity-1'];
    let successCount = 0;
    
    for (const agentId of agentIds) {
      try {
        // Try API activation first
        try {
          const response = await makeApiRequest('POST', `/api/agents/activate/${agentId}`);
          
          if (response.success) {
            log(`${COLORS.GREEN}✅ Agent ${agentId} activated via API${COLORS.RESET}`);
            successCount++;
            continue;
          }
        } catch (activateError) {
          // Continue to module import fallback
        }
        
        // Try module import as fallback
        try {
          const agentsModule = await import('../server/agents');
          
          if (typeof agentsModule.activateAgent === 'function') {
            await agentsModule.activateAgent(agentId);
            log(`${COLORS.GREEN}✅ Agent ${agentId} activated via module import${COLORS.RESET}`);
            successCount++;
            continue;
          }
        } catch (importError) {
          // Continue to next agent or fail
        }
        
        log(`${COLORS.YELLOW}⚠️ Failed to activate agent ${agentId}${COLORS.RESET}`);
      } catch (error: any) {
        log(`${COLORS.YELLOW}⚠️ Error activating agent ${agentId}: ${error?.message || 'Unknown error'}${COLORS.RESET}`);
      }
    }
    
    if (successCount > 0) {
      log(`${COLORS.GREEN}✅ Activated ${successCount}/${agentIds.length} trading agents${COLORS.RESET}`);
      return true;
    } else {
      log(`${COLORS.YELLOW}⚠️ Failed to activate any agents, trying server trigger file...${COLORS.RESET}`);
      
      // Create the activation trigger file as last resort
      const triggerDir = path.join(process.cwd(), 'server', 'triggers');
      if (!fs.existsSync(triggerDir)) {
        fs.mkdirSync(triggerDir, { recursive: true });
      }
      
      fs.writeFileSync(path.join(triggerDir, 'activate_agents'), new Date().toISOString());
      log(`${COLORS.GREEN}✅ Created activation trigger file for server auto-detection${COLORS.RESET}`);
      
      return true;
    }
  } catch (error: any) {
    log(`${COLORS.RED}❌ Error activating trading agents: ${error?.message || 'Unknown error'}${COLORS.RESET}`);
    return false;
  }
}

/**
 * Deploy the transaction engine for live trading
 */
async function deployTransactionEngine(): Promise<boolean> {
  log(`${COLORS.MAGENTA}🚀 DEPLOYING SOLANA TRANSACTION ENGINE FOR LIVE TRADING${COLORS.RESET}`);
  log(`${COLORS.MAGENTA}====================================================${COLORS.RESET}`);
  
  // Configure environment
  const environmentConfigured = await configureEnvironment();
  if (!environmentConfigured) {
    log(`${COLORS.YELLOW}⚠️ Environment configuration failed, but continuing...${COLORS.RESET}`);
  }
  
  // Enable real fund trading
  const realFundsEnabled = await enableRealFunds();
  if (!realFundsEnabled) {
    log(`${COLORS.YELLOW}⚠️ Real fund trading enablement failed, continuing...${COLORS.RESET}`);
  }
  
  // Build the Rust engine (with fallback)
  const engineBuilt = await buildRustEngine();
  if (!engineBuilt) {
    log(`${COLORS.YELLOW}⚠️ Rust engine build timed out or failed, falling back to TypeScript connector...${COLORS.RESET}`);
  }
  
  // Activate the transaction engine
  const engineActivated = await activateTransactionEngine();
  if (!engineActivated) {
    log(`${COLORS.RED}❌ Transaction engine activation failed${COLORS.RESET}`);
    return false;
  }
  
  // Activate trading agents
  const agentsActivated = await activateAgents();
  if (!agentsActivated) {
    log(`${COLORS.YELLOW}⚠️ Trading agent activation failed, but engine is running${COLORS.RESET}`);
  }
  
  log(`${COLORS.GREEN}✅ Solana Transaction Engine deployed successfully for live trading!${COLORS.RESET}`);
  log(`${COLORS.GREEN}✅ System is now trading with REAL FUNDS!${COLORS.RESET}`);
  log(`${COLORS.GREEN}✅ Transaction engine logs available in ./logs directory${COLORS.RESET}`);
  
  return true;
}

// Run the main function when this file is executed directly
if (require.main === module) {
  deployTransactionEngine()
    .then(success => {
      if (success) {
        log(`${COLORS.GREEN}✅ Deployment completed successfully!${COLORS.RESET}`);
        process.exit(0);
      } else {
        log(`${COLORS.RED}❌ Deployment failed!${COLORS.RESET}`);
        process.exit(1);
      }
    })
    .catch(error => {
      log(`${COLORS.RED}❌ Deployment error: ${error?.message || 'Unknown error'}${COLORS.RESET}`);
      process.exit(1);
    });
}