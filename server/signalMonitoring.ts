/**
 * Signal Monitoring Module
 * 
 * This module provides metrics, monitoring, and diagnostics for the signal system.
 * It tracks signal throughput, validation rates, and component-specific performance.
 */

import { SignalType, SignalSource } from '../shared/signalTypes';
import { Signal } from './signalHub';
import { logger } from './logger';
import { signalValidator } from './signalValidator';

interface TimeFrameStats {
  totalSignals: number;
  validSignals: number;
  invalidSignals: number;
  warningSignals: number;
  byType: Record<string, number>;
  bySource: Record<string, number>;
  byTarget: Record<string, number>;
  byPriority: Record<string, number>;
  validationErrors: Record<string, number>;
  actionableSignals: number;
  processingTimes: number[]; // in ms
}

interface SignalLatency {
  generation: number; // Time to generate signal
  validation: number; // Time to validate signal
  processing: number; // Time to process through processors
  delivery: number; // Time to deliver to targets
  total: number; // Total latency
}

class SignalMonitoring {
  private static instance: SignalMonitoring;
  private lastMinuteStats: TimeFrameStats;
  private last10MinutesStats: TimeFrameStats;
  private last1HourStats: TimeFrameStats;
  private last24HoursStats: TimeFrameStats;
  private signalLatencies: Map<string, SignalLatency> = new Map();
  private componentHealth: Map<string, {
    lastActive: Date;
    processedCount: number;
    errorCount: number;
    averageProcessingTime: number;
    status: 'healthy' | 'degraded' | 'error' | 'inactive';
  }> = new Map();
  
  private constructor() {
    this.resetTimeFrameStats();
    
    // Start the periodic aggregation
    setInterval(() => this.aggregateMinuteStats(), 60 * 1000); // Every minute
    setInterval(() => this.cleanup24HourStats(), 60 * 60 * 1000); // Every hour
  }
  
  public static getInstance(): SignalMonitoring {
    if (!SignalMonitoring.instance) {
      SignalMonitoring.instance = new SignalMonitoring();
    }
    return SignalMonitoring.instance;
  }
  
  /**
   * Reset stats for all time frames
   */
  private resetTimeFrameStats(): void {
    const emptyStats = (): TimeFrameStats => ({
      totalSignals: 0,
      validSignals: 0,
      invalidSignals: 0,
      warningSignals: 0,
      byType: {},
      bySource: {},
      byTarget: {},
      byPriority: {},
      validationErrors: {},
      actionableSignals: 0,
      processingTimes: []
    });
    
    this.lastMinuteStats = emptyStats();
    this.last10MinutesStats = emptyStats();
    this.last1HourStats = emptyStats();
    this.last24HoursStats = emptyStats();
  }
  
  /**
   * Track a signal being processed
   * @param signal The signal being processed
   * @param validationResult Result of validation
   * @param processingTime Time taken to process the signal
   */
  public trackSignal(
    signal: Signal, 
    validationResult: { valid: boolean; errors: { rule: string; severity: string }[] },
    processingTime: number
  ): void {
    // Update last minute stats
    this.lastMinuteStats.totalSignals++;
    
    if (validationResult.valid) {
      this.lastMinuteStats.validSignals++;
    } else {
      this.lastMinuteStats.invalidSignals++;
    }
    
    if (validationResult.errors.some(e => e.severity === 'warning')) {
      this.lastMinuteStats.warningSignals++;
    }
    
    // Track by type
    this.lastMinuteStats.byType[signal.type] = (this.lastMinuteStats.byType[signal.type] || 0) + 1;
    
    // Track by source
    this.lastMinuteStats.bySource[signal.source] = (this.lastMinuteStats.bySource[signal.source] || 0) + 1;
    
    // Track by target components
    if (signal.targetComponents && signal.targetComponents.length > 0) {
      for (const target of signal.targetComponents) {
        this.lastMinuteStats.byTarget[target] = (this.lastMinuteStats.byTarget[target] || 0) + 1;
      }
    } else {
      this.lastMinuteStats.byTarget['unspecified'] = (this.lastMinuteStats.byTarget['unspecified'] || 0) + 1;
    }
    
    // Track by priority
    this.lastMinuteStats.byPriority[signal.priority] = (this.lastMinuteStats.byPriority[signal.priority] || 0) + 1;
    
    // Track validation errors
    for (const error of validationResult.errors) {
      this.lastMinuteStats.validationErrors[error.rule] = (this.lastMinuteStats.validationErrors[error.rule] || 0) + 1;
    }
    
    // Track actionable signals
    if (signal.actionable) {
      this.lastMinuteStats.actionableSignals++;
    }
    
    // Track processing times
    this.lastMinuteStats.processingTimes.push(processingTime);
  }
  
  /**
   * Track signal latency
   * @param signalId Signal ID
   * @param stage Processing stage
   * @param timeMs Time in milliseconds
   */
  public trackLatency(
    signalId: string,
    stage: 'generation' | 'validation' | 'processing' | 'delivery',
    timeMs: number
  ): void {
    if (!this.signalLatencies.has(signalId)) {
      this.signalLatencies.set(signalId, {
        generation: 0,
        validation: 0,
        processing: 0,
        delivery: 0,
        total: 0
      });
    }
    
    const latency = this.signalLatencies.get(signalId)!;
    latency[stage] = timeMs;
    latency.total = latency.generation + latency.validation + latency.processing + latency.delivery;
  }
  
  /**
   * Track component health
   * @param componentName Name of the component
   * @param success Whether processing was successful
   * @param processingTime Time taken to process
   */
  public trackComponentHealth(
    componentName: string,
    success: boolean,
    processingTime: number
  ): void {
    if (!this.componentHealth.has(componentName)) {
      this.componentHealth.set(componentName, {
        lastActive: new Date(),
        processedCount: 0,
        errorCount: 0,
        averageProcessingTime: 0,
        status: 'healthy'
      });
    }
    
    const health = this.componentHealth.get(componentName)!;
    health.lastActive = new Date();
    health.processedCount++;
    
    if (!success) {
      health.errorCount++;
    }
    
    // Update rolling average of processing time
    health.averageProcessingTime = 
      (health.averageProcessingTime * (health.processedCount - 1) + processingTime) / health.processedCount;
    
    // Update status
    const errorRate = health.errorCount / health.processedCount;
    
    if (errorRate > 0.1) {
      health.status = 'error';
    } else if (errorRate > 0.01) {
      health.status = 'degraded';
    } else {
      health.status = 'healthy';
    }
    
    // Check if inactive (no activity in last 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    if (health.lastActive < fiveMinutesAgo) {
      health.status = 'inactive';
    }
  }
  
  /**
   * Aggregate minute stats into longer time frames
   */
  private aggregateMinuteStats(): void {
    // Avoid division by zero
    if (this.lastMinuteStats.totalSignals === 0) {
      return;
    }
    
    // Aggregate to 10 minute window
    this.updateTimeFrameStats(this.last10MinutesStats, this.lastMinuteStats);
    
    // Aggregate to 1 hour window
    this.updateTimeFrameStats(this.last1HourStats, this.lastMinuteStats);
    
    // Aggregate to 24 hour window
    this.updateTimeFrameStats(this.last24HoursStats, this.lastMinuteStats);
    
    // Reset minute stats
    this.lastMinuteStats = {
      totalSignals: 0,
      validSignals: 0,
      invalidSignals: 0,
      warningSignals: 0,
      byType: {},
      bySource: {},
      byTarget: {},
      byPriority: {},
      validationErrors: {},
      actionableSignals: 0,
      processingTimes: []
    };
    
    // Clean up latency tracking (keep only last 1000)
    if (this.signalLatencies.size > 1000) {
      const keys = Array.from(this.signalLatencies.keys()).slice(0, this.signalLatencies.size - 1000);
      for (const key of keys) {
        this.signalLatencies.delete(key);
      }
    }
  }
  
  /**
   * Update a time frame's stats with new stats
   */
  private updateTimeFrameStats(target: TimeFrameStats, source: TimeFrameStats): void {
    target.totalSignals += source.totalSignals;
    target.validSignals += source.validSignals;
    target.invalidSignals += source.invalidSignals;
    target.warningSignals += source.warningSignals;
    target.actionableSignals += source.actionableSignals;
    target.processingTimes.push(...source.processingTimes);
    
    // Only keep last 1000 processing times
    if (target.processingTimes.length > 1000) {
      target.processingTimes = target.processingTimes.slice(target.processingTimes.length - 1000);
    }
    
    // Merge type counts
    for (const [type, count] of Object.entries(source.byType)) {
      target.byType[type] = (target.byType[type] || 0) + count;
    }
    
    // Merge source counts
    for (const [src, count] of Object.entries(source.bySource)) {
      target.bySource[src] = (target.bySource[src] || 0) + count;
    }
    
    // Merge target counts
    for (const [tgt, count] of Object.entries(source.byTarget)) {
      target.byTarget[tgt] = (target.byTarget[tgt] || 0) + count;
    }
    
    // Merge priority counts
    for (const [priority, count] of Object.entries(source.byPriority)) {
      target.byPriority[priority] = (target.byPriority[priority] || 0) + count;
    }
    
    // Merge validation errors
    for (const [rule, count] of Object.entries(source.validationErrors)) {
      target.validationErrors[rule] = (target.validationErrors[rule] || 0) + count;
    }
  }
  
  /**
   * Clean up 24 hour stats (keep them from growing unbounded)
   */
  private cleanup24HourStats(): void {
    // Reset stats if older than 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    // We're not actually tracking timestamps here, so we'll just cap the values
    // to avoid them growing unbounded
    if (this.last24HoursStats.totalSignals > 1000000) {
      this.last24HoursStats = {
        totalSignals: 0,
        validSignals: 0,
        invalidSignals: 0,
        warningSignals: 0,
        byType: {},
        bySource: {},
        byTarget: {},
        byPriority: {},
        validationErrors: {},
        actionableSignals: 0,
        processingTimes: []
      };
    }
  }
  
  /**
   * Get current signal metrics for all time frames
   */
  public getMetrics(): {
    lastMinute: any;
    last10Minutes: any;
    lastHour: any;
    last24Hours: any;
    components: any;
    validation: any;
  } {
    const calculateAverageProcessingTime = (times: number[]) => {
      if (times.length === 0) return 0;
      return times.reduce((sum, time) => sum + time, 0) / times.length;
    };
    
    const validationStats = signalValidator.getStats();
    
    const formatTimeFrame = (stats: TimeFrameStats) => {
      return {
        total: stats.totalSignals,
        valid: stats.validSignals,
        invalid: stats.invalidSignals,
        withWarnings: stats.warningSignals,
        validRatio: stats.totalSignals ? (stats.validSignals / stats.totalSignals) : 1,
        actionable: stats.actionableSignals,
        byType: stats.byType,
        bySource: stats.bySource,
        byTarget: stats.byTarget,
        byPriority: stats.byPriority,
        validationErrors: stats.validationErrors,
        averageProcessingTimeMs: calculateAverageProcessingTime(stats.processingTimes)
      };
    };
    
    // Calculate average latencies
    const latencies = Array.from(this.signalLatencies.values());
    const averageLatencies = {
      generation: 0,
      validation: 0,
      processing: 0,
      delivery: 0,
      total: 0
    };
    
    if (latencies.length > 0) {
      averageLatencies.generation = latencies.reduce((sum, l) => sum + l.generation, 0) / latencies.length;
      averageLatencies.validation = latencies.reduce((sum, l) => sum + l.validation, 0) / latencies.length;
      averageLatencies.processing = latencies.reduce((sum, l) => sum + l.processing, 0) / latencies.length;
      averageLatencies.delivery = latencies.reduce((sum, l) => sum + l.delivery, 0) / latencies.length;
      averageLatencies.total = latencies.reduce((sum, l) => sum + l.total, 0) / latencies.length;
    }
    
    // Calculate p95 latency
    let p95Latency = 0;
    if (latencies.length > 0) {
      const sortedTotals = latencies.map(l => l.total).sort((a, b) => a - b);
      const p95Index = Math.floor(sortedTotals.length * 0.95);
      p95Latency = sortedTotals[p95Index] || sortedTotals[sortedTotals.length - 1];
    }
    
    return {
      lastMinute: formatTimeFrame(this.lastMinuteStats),
      last10Minutes: formatTimeFrame(this.last10MinutesStats),
      lastHour: formatTimeFrame(this.last1HourStats),
      last24Hours: formatTimeFrame(this.last24HoursStats),
      components: Array.from(this.componentHealth.entries()).map(([name, health]) => ({
        name,
        lastActive: health.lastActive,
        processedCount: health.processedCount,
        errorCount: health.errorCount,
        errorRate: health.processedCount ? (health.errorCount / health.processedCount) : 0,
        averageProcessingTimeMs: health.averageProcessingTime,
        status: health.status
      })),
      validation: {
        totalValidated: validationStats.totalValidated,
        validSignals: validationStats.validSignals,
        invalidSignals: validationStats.invalidSignals,
        warningSignals: validationStats.warningSignals,
        errorsByRule: validationStats.errorsByRule,
        latency: {
          average: averageLatencies,
          p95: p95Latency
        }
      }
    };
  }
  
  /**
   * Reset all metrics and stats
   */
  public resetMetrics(): void {
    this.resetTimeFrameStats();
    this.signalLatencies.clear();
    this.componentHealth.clear();
    signalValidator.resetStats();
  }
}

// Export singleton instance
export const signalMonitoring = SignalMonitoring.getInstance();