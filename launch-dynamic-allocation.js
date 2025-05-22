#!/usr/bin/env node
/**
 * Launch Dynamic Allocation System
 * 
 * This script launches the dynamic allocation system to optimize
 * capital allocation between trading strategies.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const SCHEDULER_PATH = path.join('./data', 'dynamic-allocation-scheduler.js');
const SYSTEM_STATE_PATH = path.join('./data', 'system-state-memory.json');

// Ensure the scheduler exists
if (!fs.existsSync(SCHEDULER_PATH)) {
  console.error('Dynamic allocation scheduler not found!');
  process.exit(1);
}

// Update system state to enable dynamic allocation
try {
  const systemState = JSON.parse(fs.readFileSync(SYSTEM_STATE_PATH, 'utf8'));
  systemState.dynamicAllocationEnabled = true;
  systemState.capitalAllocation = systemState.capitalAllocation || {};
  systemState.capitalAllocation.dynamicMode = true;
  systemState.capitalAllocation.lastStarted = new Date().toISOString();
  fs.writeFileSync(SYSTEM_STATE_PATH, JSON.stringify(systemState, null, 2));
  console.log('✅ Enabled dynamic allocation in system state');
} catch (error) {
  console.error('Error updating system state:', error);
}

// Launch the scheduler
console.log('Launching dynamic allocation scheduler...');
const scheduler = spawn('node', [SCHEDULER_PATH], {
  detached: true,
  stdio: 'ignore'
});

scheduler.unref();

console.log('✅ Dynamic allocation scheduler is now running in the background');
console.log('✅ System will automatically optimize capital allocation based on performance');
