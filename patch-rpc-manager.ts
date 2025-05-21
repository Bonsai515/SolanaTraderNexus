/**
 * Patch RPC Connection Manager to remove Instant Nodes
 */

import fs from 'fs';
import path from 'path';

// Possible locations of the RPC manager
const possiblePaths = [
  './server/lib/rpcConnectionManager.ts',
  './server/lib/rpcConnectionManager.js',
  './src/lib/rpcConnectionManager.ts',
  './src/lib/rpcConnectionManager.js',
  './src/rpcConnectionManager.ts',
  './src/rpcConnectionManager.js',
  './lib/rpcConnectionManager.ts',
  './lib/rpcConnectionManager.js',
  './rpcConnectionManager.ts',
  './rpcConnectionManager.js',
];

console.log('[RPC Patcher] Searching for RPC connection manager...');

// Find the RPC manager file
let rpcManagerPath = null;
for (const p of possiblePaths) {
  if (fs.existsSync(p)) {
    rpcManagerPath = p;
    break;
  }
}

if (!rpcManagerPath) {
  console.log('[RPC Patcher] Could not find RPC connection manager file');
  process.exit(1);
}

console.log(`[RPC Patcher] Found RPC connection manager at ${rpcManagerPath}`);

// Backup the original file
const backupPath = `${rpcManagerPath}.backup-${Date.now()}`;
fs.copyFileSync(rpcManagerPath, backupPath);
console.log(`[RPC Patcher] Created backup at ${backupPath}`);

// Read the file
let content = fs.readFileSync(rpcManagerPath, 'utf8');

// Replace any reference to Instant Nodes
const instantNodesPattern = /instantnodes\.io[\/\w-]*\/?/g;
content = content.replace(instantNodesPattern, 'BLOCKED_INSTANT_NODES/');

// Disable any Instant Nodes initializers
const instantNodesInitPattern = /(initialize|setupConnection|addConnection|connectToEndpoint)(.*?['"](.*?instantnodes.*?)['"])/g;
content = content.replace(instantNodesInitPattern, '$1$2'BLOCKED_INSTANT_NODES'');

// Write the patched file
fs.writeFileSync(rpcManagerPath, content);
console.log('[RPC Patcher] Successfully patched RPC connection manager');
