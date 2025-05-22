#!/usr/bin/env node
/**
 * Dynamic Allocation Scheduler
 * 
 * This script periodically runs the dynamic allocation monitor
 * to adjust capital allocation based on strategy performance.
 */

const { spawn } = require('child_process');
const path = require('path');

const MONITOR_PATH = path.join('./data', 'dynamic-allocation-monitor.js');
const INTERVAL_MS = 300000; // 5 minutes

console.log('Starting Dynamic Allocation Scheduler');
console.log(`Will adjust capital allocation every ${INTERVAL_MS/1000} seconds`);

// Run the monitor immediately
runMonitor();

// Schedule regular runs
setInterval(runMonitor, INTERVAL_MS);

function runMonitor() {
  console.log(`[${new Date().toISOString()}] Running dynamic allocation monitor...`);
  
  const monitor = spawn('node', [MONITOR_PATH]);
  
  monitor.stdout.on('data', (data) => {
    console.log(`${data}`);
  });
  
  monitor.stderr.on('data', (data) => {
    console.error(`${data}`);
  });
  
  monitor.on('close', (code) => {
    console.log(`Monitor process exited with code ${code}`);
  });
}
