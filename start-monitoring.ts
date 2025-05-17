/**
 * Start TypeScript Monitoring Dashboard
 * 
 * This script starts the TypeScript-based monitoring dashboard
 * to provide system metrics in the terminal
 */

import { MonitoringDashboard } from './server/monitoring/dashboard';

// Create dashboard instance
const dashboard = new MonitoringDashboard();

// Start the dashboard
dashboard.start();

console.log('Starting TypeScript monitoring dashboard...');