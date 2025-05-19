/**
 * API Usage Analyzer
 * 
 * This module analyzes and reports on API request usage to help optimize
 * and balance the system's request pattern.
 */

import fs from 'fs';
import path from 'path';

// Type definitions
interface RequestCount {
  total: number;
  byCategory: Record<string, number>;
  byEndpoint: Record<string, number>;
  byComponent: Record<string, number>;
}

// Class for tracking API requests
class ApiUsageTracker {
  private requestCounts: RequestCount = {
    total: 0,
    byCategory: {},
    byEndpoint: {},
    byComponent: {}
  };
  
  private startTime: number = Date.now();
  private logPath: string = path.join(process.cwd(), 'logs', 'api-usage.json');
  
  constructor() {
    // Create logs directory if it doesn't exist
    const logsDir = path.dirname(this.logPath);
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    // Initialize default categories
    this.requestCounts.byCategory = {
      'price': 0,
      'market': 0,
      'trade': 0,
      'wallet': 0,
      'verification': 0,
      'other': 0
    };
    
    // Initialize default components
    this.requestCounts.byComponent = {
      'price-feed': 0,
      'trade-verification': 0,
      'market-scanner': 0,
      'trade-execution': 0,
      'wallet-checks': 0,
      'other': 0
    };
    
    this.loadFromFile();
  }
  
  private loadFromFile(): void {
    try {
      if (fs.existsSync(this.logPath)) {
        const data = fs.readFileSync(this.logPath, 'utf8');
        const saved = JSON.parse(data);
        this.requestCounts = saved;
      }
    } catch (error) {
      console.error('Error loading API usage data:', error);
    }
  }
  
  private saveToFile(): void {
    try {
      fs.writeFileSync(this.logPath, JSON.stringify(this.requestCounts, null, 2));
    } catch (error) {
      console.error('Error saving API usage data:', error);
    }
  }
  
  /**
   * Track a new API request
   */
  public trackRequest(
    endpoint: string, 
    category: 'price' | 'market' | 'trade' | 'wallet' | 'verification' | 'other' = 'other',
    component: 'price-feed' | 'trade-verification' | 'market-scanner' | 'trade-execution' | 'wallet-checks' | 'other' = 'other'
  ): void {
    // Update total count
    this.requestCounts.total++;
    
    // Update category count
    this.requestCounts.byCategory[category] = (this.requestCounts.byCategory[category] || 0) + 1;
    
    // Update endpoint count
    this.requestCounts.byEndpoint[endpoint] = (this.requestCounts.byEndpoint[endpoint] || 0) + 1;
    
    // Update component count
    this.requestCounts.byComponent[component] = (this.requestCounts.byComponent[component] || 0) + 1;
    
    // Save to file every 20 requests or so
    if (this.requestCounts.total % 20 === 0) {
      this.saveToFile();
    }
  }
  
  /**
   * Generate a usage report
   */
  public generateReport(): Record<string, any> {
    const runTimeMs = Date.now() - this.startTime;
    const runTimeHours = runTimeMs / (1000 * 60 * 60);
    
    // Calculate percentages
    const categoryPercentages: Record<string, number> = {};
    const componentPercentages: Record<string, number> = {};
    const topEndpoints: [string, number][] = [];
    
    // Calculate category percentages
    for (const [category, count] of Object.entries(this.requestCounts.byCategory)) {
      categoryPercentages[category] = (count / this.requestCounts.total) * 100;
    }
    
    // Calculate component percentages
    for (const [component, count] of Object.entries(this.requestCounts.byComponent)) {
      componentPercentages[component] = (count / this.requestCounts.total) * 100;
    }
    
    // Find top endpoints
    const endpointEntries = Object.entries(this.requestCounts.byEndpoint);
    endpointEntries.sort((a, b) => b[1] - a[1]);
    topEndpoints.push(...endpointEntries.slice(0, 10));
    
    // Calculate request rates
    const requestsPerHour = this.requestCounts.total / runTimeHours;
    const requestsPerMinute = requestsPerHour / 60;
    const requestsPerSecond = requestsPerMinute / 60;
    
    // Create report
    return {
      total: this.requestCounts.total,
      runTimeMs,
      runTimeHours,
      requestsPerSecond,
      requestsPerMinute,
      requestsPerHour,
      categoryPercentages,
      componentPercentages,
      topEndpoints
    };
  }
  
  /**
   * Print a formatted report to the console
   */
  public printReport(): void {
    const report = this.generateReport();
    
    console.log('=== API USAGE REPORT ===');
    console.log(`Total Requests: ${report.total}`);
    console.log(`Run Time: ${(report.runTimeHours).toFixed(2)} hours`);
    console.log(`Request Rate: ${report.requestsPerSecond.toFixed(2)}/sec, ${report.requestsPerMinute.toFixed(2)}/min`);
    
    console.log('\nBy Category:');
    for (const [category, percentage] of Object.entries(report.categoryPercentages)) {
      console.log(`  ${category}: ${percentage.toFixed(1)}%`);
    }
    
    console.log('\nBy Component:');
    for (const [component, percentage] of Object.entries(report.componentPercentages)) {
      console.log(`  ${component}: ${percentage.toFixed(1)}%`);
    }
    
    console.log('\nTop Endpoints:');
    for (const [endpoint, count] of report.topEndpoints) {
      console.log(`  ${endpoint}: ${count} requests`);
    }
    
    console.log('\nRecommendations:');
    console.log('  1. Focus on reducing price feed requests which account for the highest usage');
    console.log('  2. Implement more aggressive caching for market data');
    console.log('  3. Reduce frequency of balance checking operations');
    console.log('  4. Prioritize transaction submission and verification requests');
    console.log('  5. Implement batch operations where possible to reduce request count');
  }
}

// Export the tracker
export const apiUsageTracker = new ApiUsageTracker();

// If this module is run directly, print the report
if (require.main === module) {
  const tracker = new ApiUsageTracker();
  tracker.printReport();
}