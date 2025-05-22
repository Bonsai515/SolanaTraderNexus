#!/usr/bin/env node
/**
 * Launch Jupiter Cache System
 * 
 * This script launches the Jupiter cache system to ensure
 * fresh price data and routes without rate limiting.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const UPDATER_PATH = path.join('./data', 'jupiter-cache-updater.js');

// Ensure the updater exists
if (!fs.existsSync(UPDATER_PATH)) {
  console.error('Jupiter cache updater not found!');
  process.exit(1);
}

// Launch the updater
console.log('Launching Jupiter cache updater...');
const updater = spawn('node', [UPDATER_PATH], {
  detached: true,
  stdio: 'ignore'
});

updater.unref();

console.log('✅ Jupiter cache updater is now running in the background');
console.log('✅ System will automatically cache token prices and routes');
