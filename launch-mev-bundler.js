#!/usr/bin/env node
/**
 * Launch Jito MEV Bundler
 * 
 * This script launches the Jito MEV bundler to capture
 * MEV opportunities with minimal capital.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const BUNDLER_PATH = path.join('./data', 'jito-mev-bundler.js');

// Ensure the bundler script exists
if (!fs.existsSync(BUNDLER_PATH)) {
  console.error('Jito MEV bundler script not found!');
  process.exit(1);
}

// Launch the bundler
console.log('Launching Jito MEV bundler...');
const bundler = spawn('node', [BUNDLER_PATH], {
  detached: true,
  stdio: 'ignore'
});

bundler.unref();

console.log('✅ Jito MEV bundler is now running in the background');
console.log('✅ The system will now capture MEV opportunities with minimal capital');
