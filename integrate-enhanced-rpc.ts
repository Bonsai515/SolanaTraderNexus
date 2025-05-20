/**
 * Integrate Enhanced RPC Manager
 * 
 * This script integrates the enhanced RPC manager into the trading system
 * to significantly reduce 429 rate limit errors and improve trading performance.
 */

import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';
import { rpcManager, EnhancedRpcManager } from './enhanced-rpc-manager';
import { execSync } from 'child_process';

// Load environment variables
config();

// Constants
const MAIN_WALLET_ADDRESS = 'HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK';

// Create backup of important files
function createBackup(): boolean {
  console.log('\nCreating backup of current files...');
  
  try {
    // Create backup directory
    const backupDir = './backup-' + Date.now();
    fs.mkdirSync(backupDir, { recursive: true });
    
    // Files to backup (all JS/TS files that might use web3 connections)
    const filesToBackup = [
      './src/connection.ts',
      './src/rpc.ts',
      './config/rpc-config.json',
      './server/rpc.ts',
      './server/connection.ts',
      './src/utils/connection.ts',
      './src/utils/rpc.ts',
      './src/services/connection.ts',
      './src/services/rpc.ts'
    ];
    
    let backupCount = 0;
    
    // Copy files to backup directory if they exist
    for (const file of filesToBackup) {
      if (fs.existsSync(file)) {
        // Create directories if needed
        const targetDir = path.dirname(path.join(backupDir, file));
        fs.mkdirSync(targetDir, { recursive: true });
        
        // Copy file
        fs.copyFileSync(file, path.join(backupDir, file));
        backupCount++;
      }
    }
    
    if (backupCount > 0) {
      console.log(`✅ Backed up ${backupCount} files to ${backupDir}`);
      return true;
    } else {
      console.log('No files found to backup');
      return true;
    }
  } catch (error) {
    console.error('Error creating backup:', error);
    return false;
  }
}

// Find files that use Solana connection
function findConnectionFiles(): string[] {
  console.log('\nSearching for files using Solana connection...');
  
  try {
    // Use grep to find files that import from @solana/web3.js or use Connection
    const grepCommand = 'grep -r --include="*.ts" --include="*.js" -l "import.*@solana/web3.js\\|Connection" ./';
    const result = execSync(grepCommand).toString().trim().split('\n');
    
    // Filter out node_modules and the enhanced RPC manager itself
    const filteredFiles = result.filter(file => 
      !file.includes('node_modules') && 
      !file.includes('enhanced-rpc-manager.ts') &&
      !file.includes('/backup-')
    );
    
    console.log(`Found ${filteredFiles.length} files using Solana connection`);
    
    return filteredFiles;
  } catch (error) {
    console.error('Error finding connection files:', error);
    return [];
  }
}

// Check if a file contains direct RPC URL references
function checkForRpcUrls(filePath: string): boolean {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Check for common RPC URL patterns
    const hasRpcUrls = 
      content.includes('api.mainnet-beta.solana.com') ||
      content.includes('solana-api.projectserum.com') ||
      content.includes('instantnodes.io') ||
      content.includes('helius-rpc.com') ||
      content.includes('genesysgo.net') ||
      content.includes('triton.one') ||
      content.includes('syndica.io') ||
      content.includes('alchemy.com') ||
      content.includes('https://') && content.includes('solana');
    
    return hasRpcUrls;
  } catch (error) {
    console.error(`Error checking ${filePath} for RPC URLs:`, error);
    return false;
  }
}

// Update a file to use the enhanced RPC manager
function updateFile(filePath: string): boolean {
  console.log(`\nUpdating ${filePath}...`);
  
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let updated = false;
    
    // Check if file already imports or uses our enhanced RPC manager
    if (content.includes('enhanced-rpc-manager') || content.includes('EnhancedRpcManager')) {
      console.log(`File ${filePath} already uses enhanced RPC manager`);
      return false;
    }
    
    // Add import for enhanced RPC manager if needed
    if (!content.includes('import { rpcManager }')) {
      // Find the last import statement
      const importRegex = /^import .+$/gm;
      const imports = [...content.matchAll(importRegex)];
      
      if (imports.length > 0) {
        const lastImport = imports[imports.length - 1][0];
        const lastImportIndex = content.indexOf(lastImport) + lastImport.length;
        
        const updatedContent = 
          content.substring(0, lastImportIndex) + 
          '\nimport { rpcManager } from \'./enhanced-rpc-manager\';  // Enhanced RPC with caching and rate limiting' + 
          content.substring(lastImportIndex);
        
        content = updatedContent;
        updated = true;
      }
    }
    
    // Replace direct Connection instantiation
    const connectionRegex = /new Connection\(([^)]+)\)/g;
    if (connectionRegex.test(content)) {
      content = content.replace(connectionRegex, (match, params) => {
        // If params include "rpcManager", don't replace it
        if (params.includes('rpcManager')) {
          return match;
        }
        
        // Check for endpoint/URL and commitment
        const hasEndpointAndCommitment = params.includes(',');
        
        if (hasEndpointAndCommitment) {
          return `rpcManager /* replaced Connection(${params.trim()}) */`;
        } else {
          return `rpcManager /* replaced Connection(${params.trim()}) */`;
        }
      });
      updated = true;
    }
    
    // Replace direct RPC URL references
    const urlPatterns = [
      'api.mainnet-beta.solana.com',
      'solana-api.projectserum.com',
      'instantnodes.io',
      'helius-rpc.com',
      'genesysgo.net',
      'triton.one',
      'syndica.io',
      'https://.+\\.solana\\.'
    ];
    
    for (const pattern of urlPatterns) {
      const urlRegex = new RegExp(`(['"])https?://[^'"]*${pattern}[^'"]*(['"])`, 'g');
      if (urlRegex.test(content)) {
        content = content.replace(urlRegex, (match, q1, q2) => {
          return `${q1}enhanced-rpc-managed-url${q2} /* replaced ${match} */`;
        });
        updated = true;
      }
    }
    
    // Add comment explaining the changes
    if (updated) {
      const commentHeader = 
        '\n// ENHANCED RPC MANAGER INTEGRATION\n' +
        '// This file has been updated to use the enhanced RPC manager with caching and rate limiting\n' +
        '// The enhanced RPC manager automatically handles fallbacks and retries\n';
      
      // Find appropriate place to add the comment (after imports)
      const lastImportIndex = content.lastIndexOf('import ');
      if (lastImportIndex > -1) {
        const importEndIndex = content.indexOf('\n', lastImportIndex);
        if (importEndIndex > -1) {
          content = 
            content.substring(0, importEndIndex + 1) + 
            commentHeader + 
            content.substring(importEndIndex + 1);
        }
      }
      
      fs.writeFileSync(filePath, content);
      console.log(`✅ Updated ${filePath}`);
      return true;
    } else {
      console.log(`No changes needed for ${filePath}`);
      return false;
    }
  } catch (error) {
    console.error(`Error updating ${filePath}:`, error);
    return false;
  }
}

// Create a global RPC manager file to ensure singleton usage
function createGlobalRpcFile(): boolean {
  console.log('\nCreating global RPC manager file...');
  
  const filePath = './src/utils/global-rpc.ts';
  
  // Create directories if needed
  const dirPath = path.dirname(filePath);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  
  const fileContent = `/**
 * Global RPC Manager
 * 
 * This file provides access to the Enhanced RPC Manager singleton
 * for any part of the application that needs to access Solana.
 */

import { rpcManager } from '../../enhanced-rpc-manager';

export { rpcManager };

// The enhanced RPC manager provides these methods that mirror the regular Connection API:
// - getBalance
// - getAccountInfo
// - getRecentBlockhash / getLatestBlockhash
// - sendTransaction
// - confirmTransaction
// - getTokenAccountsByOwner
// - getSignaturesForAddress

// It also handles caching, rate limiting, and RPC endpoint fallbacks automatically

// Import this file instead of creating new Connection instances:
// import { rpcManager } from '@/utils/global-rpc';
`;
  
  try {
    fs.writeFileSync(filePath, fileContent);
    console.log(`✅ Created global RPC manager file at ${filePath}`);
    return true;
  } catch (error) {
    console.error('Error creating global RPC file:', error);
    return false;
  }
}

// Update RPC configuration for any config file in the project
function updateRpcConfig(): boolean {
  console.log('\nUpdating RPC configurations...');
  
  const configFilePaths = [
    './config/rpc-config.json',
    './src/config/rpc.json',
    './config/connection.json',
    './src/config/connection.json'
  ];
  
  let updatedCount = 0;
  
  for (const configPath of configFilePaths) {
    if (fs.existsSync(configPath)) {
      try {
        console.log(`Updating ${configPath}...`);
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        
        // Add enhanced configuration
        config.useEnhancedRpc = true;
        config.enhanced = {
          caching: true,
          rateLimiting: true,
          autoFallback: true,
          batchRequests: true
        };
        
        // Add our endpoints with appropriate prioritization
        config.endpoints = [
          { url: 'https://api.mainnet-beta.solana.com', priority: 3 },
          { url: 'https://solana-api.projectserum.com', priority: 3 }
        ];
        
        if (process.env.HELIUS_API_KEY) {
          config.endpoints.push({ 
            url: `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`,
            priority: 1
          });
        }
        
        if (process.env.ALCHEMY_API_KEY) {
          config.endpoints.push({ 
            url: `https://solana-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
            priority: 1
          });
        }
        
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        console.log(`✅ Updated ${configPath}`);
        updatedCount++;
      } catch (error) {
        console.error(`Error updating ${configPath}:`, error);
      }
    }
  }
  
  return updatedCount > 0;
}

// Create script to monitor RPC performance
function createRpcMonitor(): boolean {
  console.log('\nCreating RPC monitor script...');
  
  const filePath = './monitor-rpc.ts';
  
  const fileContent = `/**
 * RPC Monitor
 * 
 * This script monitors the performance of the Enhanced RPC Manager
 * and reports statistics on caching, rate limiting, and fallbacks.
 */

import { rpcManager } from './enhanced-rpc-manager';
import * as fs from 'fs';

async function main() {
  console.log('=== RPC MONITOR ===');
  
  // Get connection health
  const health = await rpcManager.getConnectionsHealth();
  
  console.log('\\nRPC Connection Health:');
  console.table(health.map(conn => ({
    url: conn.url,
    requests: conn.requestCount,
    errors: conn.errorCount,
    consErrors: conn.consecutiveErrors,
    reqPerMin: conn.requestsLastMinute,
    score: conn.score,
    cooldown: conn.cooldownUntil
  })));
  
  // Write report to file
  const report = {
    timestamp: new Date().toISOString(),
    connections: health,
    summary: {
      totalConnections: health.length,
      totalRequests: health.reduce((sum, conn) => sum + conn.requestCount, 0),
      totalErrors: health.reduce((sum, conn) => sum + conn.errorCount, 0),
      errorRate: health.reduce((sum, conn) => sum + conn.errorCount, 0) / 
                health.reduce((sum, conn) => sum + conn.requestCount, 1)
    }
  };
  
  // Create directory if it doesn't exist
  if (!fs.existsSync('./logs')) {
    fs.mkdirSync('./logs', { recursive: true });
  }
  
  fs.writeFileSync(
    \`./logs/rpc-report-\${Date.now()}.json\`, 
    JSON.stringify(report, null, 2)
  );
  
  console.log('\\nRPC Monitor report generated and saved to logs directory.');
  console.log('\\nPress Ctrl+C to exit.');
}

// Run the main function
main().catch(console.error);

// Keep the script running to monitor in real-time
setInterval(async () => {
  try {
    const health = await rpcManager.getConnectionsHealth();
    console.clear();
    console.log(\`=== RPC MONITOR (Updated: \${new Date().toLocaleTimeString()}) ===\`);
    
    console.log('\\nRPC Connection Health:');
    console.table(health.map(conn => ({
      url: conn.url,
      requests: conn.requestCount,
      errors: conn.errorCount,
      consErrors: conn.consecutiveErrors,
      reqPerMin: conn.requestsLastMinute,
      score: conn.score,
      cooldown: conn.cooldownUntil ? 'Yes' : 'No'
    })));
  } catch (error) {
    console.error('Error updating monitor:', error);
  }
}, 10000); // Update every 10 seconds
`;
  
  try {
    fs.writeFileSync(filePath, fileContent);
    console.log(`✅ Created RPC monitor script at ${filePath}`);
    return true;
  } catch (error) {
    console.error('Error creating RPC monitor script:', error);
    return false;
  }
}

// Create restart script to apply RPC improvements
function createRestartScript(): boolean {
  console.log('\nCreating restart script...');
  
  const filePath = './restart-with-enhanced-rpc.sh';
  
  const fileContent = `#!/bin/bash
# Restart trading system with enhanced RPC

echo "========================================"
echo "    RESTARTING TRADING SYSTEM          "
echo "    WITH ENHANCED RPC MANAGER          "
echo "========================================"
echo

# Stop running processes
echo "Stopping current trading system..."
pkill -f "ts-node" || true
pkill -f "npx tsx" || true
pkill -f "strategy.ts" || true
sleep 2

# Ensure enhanced RPC is ready
echo "Preparing enhanced RPC manager..."
npx tsx enhanced-rpc-manager.ts &
sleep 3

# Start with enhanced RPC configuration
echo "Starting trading system with enhanced RPC..."
./launch-enhanced-system.sh &

echo "Starting RPC monitor in background..."
npx tsx monitor-rpc.ts > ./logs/rpc-monitor.log 2>&1 &

echo "System restarted with enhanced RPC manager"
echo "========================================"
`;
  
  try {
    fs.writeFileSync(filePath, fileContent);
    fs.chmodSync(filePath, 0o755); // Make executable
    console.log(`✅ Created restart script at ${filePath}`);
    return true;
  } catch (error) {
    console.error('Error creating restart script:', error);
    return false;
  }
}

// Main function
async function main() {
  console.log('=== INTEGRATE ENHANCED RPC MANAGER ===');
  
  // Create backup
  const backupCreated = createBackup();
  if (!backupCreated) {
    console.error('Failed to create backup. Aborting.');
    return;
  }
  
  // Find connection files
  const connectionFiles = findConnectionFiles();
  
  // Update each file
  let updatedCount = 0;
  for (const file of connectionFiles) {
    // Check if file contains direct RPC URLs
    const hasRpcUrls = checkForRpcUrls(file);
    
    if (hasRpcUrls) {
      const updated = updateFile(file);
      if (updated) {
        updatedCount++;
      }
    }
  }
  
  console.log(`\nUpdated ${updatedCount} files to use enhanced RPC manager`);
  
  // Create global RPC file
  createGlobalRpcFile();
  
  // Update RPC configs
  updateRpcConfig();
  
  // Create RPC monitor
  createRpcMonitor();
  
  // Create restart script
  createRestartScript();
  
  console.log('\n=== ENHANCED RPC INTEGRATION COMPLETE ===');
  console.log('The trading system now uses an enhanced RPC manager that:');
  console.log('1. Intelligently caches blockchain data to reduce RPC calls');
  console.log('2. Implements aggressive rate limiting to prevent 429 errors');
  console.log('3. Automatically falls back to alternate RPC providers');
  console.log('4. Prioritizes requests based on importance and endpoint availability');
  
  console.log('\nTo restart the system with enhanced RPC, run:');
  console.log('./restart-with-enhanced-rpc.sh');
  
  // Auto-restart the system
  console.log('\nAutomatic restart in 5 seconds...');
  setTimeout(() => {
    try {
      const { exec } = require('child_process');
      exec('./restart-with-enhanced-rpc.sh', (error: any, stdout: string, stderr: string) => {
        if (error) {
          console.error(`Error restarting system: ${error}`);
          return;
        }
        console.log(stdout);
      });
    } catch (error) {
      console.error('Error executing restart script:', error);
    }
  }, 5000);
}

// Run the main function
main().catch(console.error);