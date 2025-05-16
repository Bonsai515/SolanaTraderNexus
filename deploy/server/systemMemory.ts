/**
 * System Memory Module
 * 
 * This module provides a centralized memory system that tracks all significant
 * operations and state changes across the trading system. It enables components
 * to log their activities and query the system's past and present state.
 * 
 * Key features:
 * - Event tracking with timestamps
 * - Component state monitoring
 * - Error and process failure detection
 * - Query interface for system analysis
 * - Performance metrics collection
 */

import * as logger from './logger';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';

// Event types for system memory
export enum EventType {
  SYSTEM_START = 'SYSTEM_START',
  SYSTEM_STOP = 'SYSTEM_STOP',
  COMPONENT_START = 'COMPONENT_START',
  COMPONENT_STOP = 'COMPONENT_STOP',
  TRANSACTION_INITIATED = 'TRANSACTION_INITIATED',
  TRANSACTION_COMPLETED = 'TRANSACTION_COMPLETED',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  SIGNAL_GENERATED = 'SIGNAL_GENERATED',
  SIGNAL_PROCESSED = 'SIGNAL_PROCESSED',
  WALLET_UPDATE = 'WALLET_UPDATE',
  PROFIT_CAPTURED = 'PROFIT_CAPTURED',
  ERROR = 'ERROR',
  WARNING = 'WARNING',
  PERFORMANCE_METRIC = 'PERFORMANCE_METRIC',
  COMPONENT_STATUS_CHANGE = 'COMPONENT_STATUS_CHANGE',
  CUSTOM = 'CUSTOM'
}

// Severity levels for events
export enum Severity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL'
}

// Component types in the system
export enum ComponentType {
  TRANSACTION_ENGINE = 'TRANSACTION_ENGINE',
  SIGNAL_HUB = 'SIGNAL_HUB',
  WALLET_MANAGER = 'WALLET_MANAGER',
  TRANSACTION_VERIFIER = 'TRANSACTION_VERIFIER',
  ANCHOR_CONNECTOR = 'ANCHOR_CONNECTOR',
  AGENT = 'AGENT',
  PRICE_FEED = 'PRICE_FEED',
  TRANSFORMER = 'TRANSFORMER',
  API = 'API',
  SYSTEM = 'SYSTEM'
}

// Status values for components
export enum ComponentStatus {
  INITIALIZING = 'INITIALIZING',
  ACTIVE = 'ACTIVE',
  DEGRADED = 'DEGRADED',
  ERROR = 'ERROR',
  INACTIVE = 'INACTIVE',
  MAINTENANCE = 'MAINTENANCE'
}

// Interface for system memory events
export interface SystemEvent {
  id: string;
  timestamp: number;
  type: EventType;
  component: ComponentType;
  severity: Severity;
  message: string;
  data?: any;
  relatedEvents?: string[];
  processId?: string;
}

// Interface for component status
export interface ComponentState {
  type: ComponentType;
  name: string;
  status: ComponentStatus;
  lastUpdated: number;
  metrics?: Record<string, any>;
  errors?: string[];
  details?: any;
}

// Interface for system process
export interface SystemProcess {
  id: string;
  name: string;
  startTime: number;
  endTime?: number;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'TIMEOUT';
  steps: SystemEvent[];
  result?: any;
  error?: string;
}

// System memory class
class SystemMemory extends EventEmitter {
  private static instance: SystemMemory;
  private events: Record<string, SystemEvent> = {};
  private components: Record<string, ComponentState> = {};
  private processes: Record<string, SystemProcess> = {};
  private metrics: Record<string, any[]> = {};
  private readonly MAX_EVENTS = 10000; // Maximum number of events to keep in memory
  private readonly PERSIST_INTERVAL = 300000; // 5 minutes in milliseconds
  private persistInterval: NodeJS.Timeout | null = null;
  private dataDir: string = path.join(process.cwd(), 'data');
  
  private constructor() {
    super();
    
    // Create data directory if it doesn't exist
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    
    // Set up persistence interval
    this.persistInterval = setInterval(() => {
      this.persistMemory();
    }, this.PERSIST_INTERVAL);
    
    // Log initialization
    logger.info('System Memory initialized');
    
    // Record system start event
    this.recordEvent({
      type: EventType.SYSTEM_START,
      component: ComponentType.SYSTEM,
      severity: Severity.INFO,
      message: 'System Memory initialized'
    });
  }
  
  /**
   * Get the SystemMemory singleton instance
   * @returns SystemMemory instance
   */
  public static getInstance(): SystemMemory {
    if (!SystemMemory.instance) {
      SystemMemory.instance = new SystemMemory();
    }
    return SystemMemory.instance;
  }
  
  /**
   * Record an event in the system memory
   * @param event Event details
   * @returns Event ID
   */
  public recordEvent(event: Omit<SystemEvent, 'id' | 'timestamp'>): string {
    const id = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const timestamp = Date.now();
    
    const fullEvent: SystemEvent = {
      id,
      timestamp,
      ...event
    };
    
    // Store the event
    this.events[id] = fullEvent;
    
    // Emit event for subscribers
    this.emit('event', fullEvent);
    
    // If this is an error event, update component status
    if (event.severity === Severity.ERROR || event.severity === Severity.CRITICAL) {
      this.updateComponentStatus(event.component, ComponentStatus.ERROR, {
        lastError: event.message,
        errorTimestamp: timestamp,
        errorData: event.data
      });
    }
    
    // If this is related to a process, add it to the process
    if (event.processId && this.processes[event.processId]) {
      this.processes[event.processId].steps.push(fullEvent);
      
      // If it's an error, update process status
      if (event.severity === Severity.ERROR || event.severity === Severity.CRITICAL) {
        this.processes[event.processId].status = 'FAILED';
        this.processes[event.processId].error = event.message;
      }
    }
    
    // Prune old events if we exceed the maximum
    this.pruneEvents();
    
    return id;
  }
  
  /**
   * Start tracking a system process
   * @param name Process name
   * @param details Optional process details
   * @returns Process ID
   */
  public startProcess(name: string, details?: any): string {
    const id = `proc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const startTime = Date.now();
    
    const process: SystemProcess = {
      id,
      name,
      startTime,
      status: 'RUNNING',
      steps: [],
      details
    };
    
    // Store the process
    this.processes[id] = process;
    
    // Record process start event
    this.recordEvent({
      type: EventType.CUSTOM,
      component: ComponentType.SYSTEM,
      severity: Severity.INFO,
      message: `Process started: ${name}`,
      data: details,
      processId: id
    });
    
    return id;
  }
  
  /**
   * End tracking of a system process
   * @param id Process ID
   * @param status Process final status
   * @param result Optional process result
   * @param error Optional error message
   */
  public endProcess(
    id: string,
    status: 'COMPLETED' | 'FAILED' | 'TIMEOUT',
    result?: any,
    error?: string
  ): void {
    if (!this.processes[id]) {
      logger.warn(`Cannot end process ${id}: process not found`);
      return;
    }
    
    const process = this.processes[id];
    process.endTime = Date.now();
    process.status = status;
    
    if (result !== undefined) {
      process.result = result;
    }
    
    if (error !== undefined) {
      process.error = error;
    }
    
    // Record process end event
    this.recordEvent({
      type: EventType.CUSTOM,
      component: ComponentType.SYSTEM,
      severity: status === 'COMPLETED' ? Severity.INFO : Severity.ERROR,
      message: `Process ${status.toLowerCase()}: ${process.name}`,
      data: {
        result,
        error,
        duration: process.endTime - process.startTime
      },
      processId: id
    });
  }
  
  /**
   * Update the status of a system component
   * @param componentType Component type
   * @param status Component status
   * @param details Additional details
   * @param componentName Optional component name for specific instances
   */
  public updateComponentStatus(
    componentType: ComponentType,
    status: ComponentStatus,
    details?: any,
    componentName?: string
  ): void {
    const name = componentName || componentType;
    const key = `${componentType}:${name}`;
    const timestamp = Date.now();
    
    // Get current component state or create new one
    const currentState = this.components[key] || {
      type: componentType,
      name,
      status: ComponentStatus.INITIALIZING,
      lastUpdated: timestamp,
      metrics: {},
      errors: []
    };
    
    // Determine if this is a status change
    const isStatusChange = currentState.status !== status;
    
    // Update component state
    const updatedState: ComponentState = {
      ...currentState,
      status,
      lastUpdated: timestamp
    };
    
    // Add details if provided
    if (details) {
      updatedState.details = {
        ...updatedState.details,
        ...details
      };
      
      // If there's an error, add it to errors array
      if (details.lastError) {
        updatedState.errors = [
          ...(updatedState.errors || []),
          details.lastError
        ].slice(-10); // Keep only the last 10 errors
      }
    }
    
    // Store updated state
    this.components[key] = updatedState;
    
    // If status changed, record an event
    if (isStatusChange) {
      this.recordEvent({
        type: EventType.COMPONENT_STATUS_CHANGE,
        component: componentType,
        severity: 
          status === ComponentStatus.ERROR ? Severity.ERROR :
          status === ComponentStatus.DEGRADED ? Severity.WARNING :
          Severity.INFO,
        message: `Component ${name} status changed to ${status}`,
        data: {
          previousStatus: currentState.status,
          newStatus: status,
          details
        }
      });
    }
  }
  
  /**
   * Record a performance metric
   * @param component Component being measured
   * @param metric Metric name
   * @param value Metric value
   * @param units Optional units
   * @param context Optional context
   */
  public recordMetric(
    component: ComponentType,
    metric: string,
    value: number,
    units?: string,
    context?: any
  ): void {
    const timestamp = Date.now();
    const metricKey = `${component}:${metric}`;
    
    // Create metrics array if it doesn't exist
    if (!this.metrics[metricKey]) {
      this.metrics[metricKey] = [];
    }
    
    // Add metric
    this.metrics[metricKey].push({
      timestamp,
      value,
      units,
      context
    });
    
    // Keep only the last 100 metric readings
    if (this.metrics[metricKey].length > 100) {
      this.metrics[metricKey] = this.metrics[metricKey].slice(-100);
    }
    
    // Update component metrics
    const componentKey = `${component}:${component}`;
    if (this.components[componentKey]) {
      this.components[componentKey].metrics = {
        ...this.components[componentKey].metrics,
        [metric]: {
          value,
          units,
          timestamp
        }
      };
    }
    
    // Record metric event for significant metrics
    if (context?.significant) {
      this.recordEvent({
        type: EventType.PERFORMANCE_METRIC,
        component,
        severity: Severity.INFO,
        message: `Performance metric: ${metric} = ${value}${units ? ' ' + units : ''}`,
        data: {
          metric,
          value,
          units,
          context
        }
      });
    }
  }
  
  /**
   * Get events by type
   * @param type Event type
   * @param limit Maximum number of events to return
   * @param startTime Optional start time filter
   * @param endTime Optional end time filter
   * @returns Array of events
   */
  public getEventsByType(
    type: EventType,
    limit: number = 100,
    startTime?: number,
    endTime?: number
  ): SystemEvent[] {
    const events = Object.values(this.events)
      .filter(event => {
        // Filter by type
        if (event.type !== type) return false;
        
        // Filter by time range if specified
        if (startTime && event.timestamp < startTime) return false;
        if (endTime && event.timestamp > endTime) return false;
        
        return true;
      })
      .sort((a, b) => b.timestamp - a.timestamp) // Sort by timestamp, newest first
      .slice(0, limit);
    
    return events;
  }
  
  /**
   * Get all system components
   * @returns Record of component states
   */
  public getAllComponents(): Record<string, ComponentState> {
    return { ...this.components };
  }
  
  /**
   * Get all active processes
   * @returns Active processes
   */
  public getActiveProcesses(): SystemProcess[] {
    return Object.values(this.processes)
      .filter(process => process.status === 'RUNNING')
      .sort((a, b) => b.startTime - a.startTime);
  }
  
  /**
   * Get recent processes
   * @param limit Maximum number of processes to return
   * @returns Recent processes
   */
  public getRecentProcesses(limit: number = 20): SystemProcess[] {
    return Object.values(this.processes)
      .sort((a, b) => (b.endTime || b.startTime) - (a.endTime || a.startTime))
      .slice(0, limit);
  }
  
  /**
   * Get process by ID
   * @param id Process ID
   * @returns Process or undefined
   */
  public getProcess(id: string): SystemProcess | undefined {
    return this.processes[id];
  }
  
  /**
   * Get all metrics for a component
   * @param component Component type
   * @returns Metrics for the component
   */
  public getMetricsForComponent(component: ComponentType): Record<string, any[]> {
    const result: Record<string, any[]> = {};
    
    // Find all metrics for this component
    Object.keys(this.metrics)
      .filter(key => key.startsWith(`${component}:`))
      .forEach(key => {
        const metricName = key.split(':')[1];
        result[metricName] = this.metrics[key];
      });
    
    return result;
  }
  
  /**
   * Get component status
   * @param componentType Component type
   * @param componentName Optional component name
   * @returns Component state or undefined
   */
  public getComponentStatus(
    componentType: ComponentType,
    componentName?: string
  ): ComponentState | undefined {
    const name = componentName || componentType;
    const key = `${componentType}:${name}`;
    return this.components[key];
  }
  
  /**
   * Get all component errors
   * @returns Components with errors
   */
  public getComponentsWithErrors(): ComponentState[] {
    return Object.values(this.components)
      .filter(component => component.status === ComponentStatus.ERROR)
      .sort((a, b) => b.lastUpdated - a.lastUpdated);
  }
  
  /**
   * Get system health status
   * @returns System health status
   */
  public getSystemHealth(): {
    status: 'HEALTHY' | 'DEGRADED' | 'ERROR';
    componentStatus: Record<string, string>;
    errors: { component: string; error: string }[];
    activeProcesses: number;
    failedProcesses: number;
    metrics: Record<string, number>;
  } {
    // Count components by status
    const componentsByStatus: Record<string, number> = {};
    const componentStatus: Record<string, string> = {};
    const errors: { component: string; error: string }[] = [];
    
    Object.values(this.components).forEach(component => {
      componentsByStatus[component.status] = (componentsByStatus[component.status] || 0) + 1;
      componentStatus[`${component.type}:${component.name}`] = component.status;
      
      if (component.status === ComponentStatus.ERROR && component.errors && component.errors.length > 0) {
        errors.push({
          component: `${component.type}:${component.name}`,
          error: component.errors[component.errors.length - 1]
        });
      }
    });
    
    // Count processes by status
    const processesByStatus: Record<string, number> = {};
    Object.values(this.processes).forEach(process => {
      processesByStatus[process.status] = (processesByStatus[process.status] || 0) + 1;
    });
    
    // Calculate key metrics
    const metrics: Record<string, number> = {
      totalEvents: Object.keys(this.events).length,
      totalComponents: Object.keys(this.components).length,
      totalProcesses: Object.keys(this.processes).length,
      activeProcesses: processesByStatus['RUNNING'] || 0,
      completedProcesses: processesByStatus['COMPLETED'] || 0,
      failedProcesses: processesByStatus['FAILED'] || 0,
      componentErrors: componentsByStatus[ComponentStatus.ERROR] || 0,
      componentDegraded: componentsByStatus[ComponentStatus.DEGRADED] || 0,
      componentActive: componentsByStatus[ComponentStatus.ACTIVE] || 0
    };
    
    // Determine overall system status
    let status: 'HEALTHY' | 'DEGRADED' | 'ERROR' = 'HEALTHY';
    
    if (componentsByStatus[ComponentStatus.ERROR] > 0 || processesByStatus['FAILED'] > 3) {
      status = 'ERROR';
    } else if (componentsByStatus[ComponentStatus.DEGRADED] > 0) {
      status = 'DEGRADED';
    }
    
    return {
      status,
      componentStatus,
      errors,
      activeProcesses: processesByStatus['RUNNING'] || 0,
      failedProcesses: processesByStatus['FAILED'] || 0,
      metrics
    };
  }
  
  /**
   * Query events using a filter function
   * @param filterFn Filter function
   * @param limit Maximum number of events to return
   * @returns Filtered events
   */
  public queryEvents(
    filterFn: (event: SystemEvent) => boolean,
    limit: number = 100
  ): SystemEvent[] {
    return Object.values(this.events)
      .filter(filterFn)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }
  
  /**
   * Get the most recent errors
   * @param limit Maximum number of errors to return
   * @returns Recent errors
   */
  public getRecentErrors(limit: number = 20): SystemEvent[] {
    return this.queryEvents(
      event => event.severity === Severity.ERROR || event.severity === Severity.CRITICAL,
      limit
    );
  }
  
  /**
   * Find failing processes or components
   * @returns Failing items report
   */
  public findFailingItems(): {
    components: ComponentState[];
    processes: SystemProcess[];
    errors: SystemEvent[];
  } {
    const components = this.getComponentsWithErrors();
    
    const processes = Object.values(this.processes)
      .filter(process => process.status === 'FAILED')
      .sort((a, b) => b.startTime - a.startTime)
      .slice(0, 10);
    
    const errors = this.getRecentErrors(10);
    
    return {
      components,
      processes,
      errors
    };
  }
  
  /**
   * Generate a performance report
   * @returns Performance report
   */
  public generatePerformanceReport(): {
    processTimes: Record<string, number>;
    componentMetrics: Record<string, Record<string, any>>;
    systemMetrics: Record<string, number>;
  } {
    // Calculate average process times
    const processTimes: Record<string, number> = {};
    const processGroups: Record<string, number[]> = {};
    
    Object.values(this.processes)
      .filter(process => process.endTime !== undefined)
      .forEach(process => {
        const duration = (process.endTime as number) - process.startTime;
        
        if (!processGroups[process.name]) {
          processGroups[process.name] = [];
        }
        
        processGroups[process.name].push(duration);
      });
    
    // Calculate average times
    Object.keys(processGroups).forEach(name => {
      const times = processGroups[name];
      const total = times.reduce((sum, time) => sum + time, 0);
      processTimes[name] = Math.round(total / times.length);
    });
    
    // Collect component metrics
    const componentMetrics: Record<string, Record<string, any>> = {};
    
    Object.values(this.components).forEach(component => {
      if (component.metrics) {
        componentMetrics[`${component.type}:${component.name}`] = component.metrics;
      }
    });
    
    // System metrics
    const systemMetrics: Record<string, number> = {
      totalEvents: Object.keys(this.events).length,
      totalProcesses: Object.keys(this.processes).length,
      eventRate: this.calculateEventRate(),
      successRate: this.calculateSuccessRate()
    };
    
    return {
      processTimes,
      componentMetrics,
      systemMetrics
    };
  }
  
  /**
   * Calculate event rate (events per minute)
   * @param minutes Time window in minutes
   * @returns Events per minute
   */
  private calculateEventRate(minutes: number = 5): number {
    const now = Date.now();
    const cutoff = now - (minutes * 60 * 1000);
    
    const recentEvents = Object.values(this.events)
      .filter(event => event.timestamp >= cutoff)
      .length;
    
    return Math.round(recentEvents / minutes);
  }
  
  /**
   * Calculate success rate of processes
   * @returns Success rate (percentage)
   */
  private calculateSuccessRate(): number {
    const recentProcesses = Object.values(this.processes)
      .filter(process => process.endTime !== undefined)
      .slice(-100);
    
    if (recentProcesses.length === 0) {
      return 100;
    }
    
    const successful = recentProcesses.filter(process => process.status === 'COMPLETED').length;
    return Math.round((successful / recentProcesses.length) * 100);
  }
  
  /**
   * Prune old events if we exceed the maximum
   */
  private pruneEvents(): void {
    const eventCount = Object.keys(this.events).length;
    
    if (eventCount > this.MAX_EVENTS) {
      // Sort events by timestamp
      const sortedEvents = Object.values(this.events)
        .sort((a, b) => a.timestamp - b.timestamp);
      
      // Remove oldest events
      const eventsToRemove = sortedEvents.slice(0, eventCount - this.MAX_EVENTS);
      
      // Remove from events object
      eventsToRemove.forEach(event => {
        delete this.events[event.id];
      });
      
      logger.debug(`Pruned ${eventsToRemove.length} old events from system memory`);
    }
  }
  
  /**
   * Persist system memory to disk
   */
  private persistMemory(): void {
    try {
      const data = {
        timestamp: Date.now(),
        events: this.events,
        components: this.components,
        processes: this.processes,
        metrics: this.metrics
      };
      
      const filePath = path.join(this.dataDir, `system_memory_${new Date().toISOString().replace(/:/g, '-')}.json`);
      
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      
      logger.debug(`System memory persisted to ${filePath}`);
      
      // Clean up old persisted files
      this.cleanupPersistedFiles();
    } catch (error) {
      logger.error('Failed to persist system memory:', error);
    }
  }
  
  /**
   * Clean up old persisted files
   */
  private cleanupPersistedFiles(): void {
    try {
      const files = fs.readdirSync(this.dataDir)
        .filter(file => file.startsWith('system_memory_'))
        .sort()
        .reverse();
      
      // Keep the 10 most recent files
      const filesToDelete = files.slice(10);
      
      filesToDelete.forEach(file => {
        fs.unlinkSync(path.join(this.dataDir, file));
      });
      
      if (filesToDelete.length > 0) {
        logger.debug(`Cleaned up ${filesToDelete.length} old system memory files`);
      }
    } catch (error) {
      logger.error('Failed to clean up persisted system memory files:', error);
    }
  }
  
  /**
   * Shutdown and clean up
   */
  public shutdown(): void {
    if (this.persistInterval) {
      clearInterval(this.persistInterval);
      this.persistInterval = null;
    }
    
    // Record shutdown event
    this.recordEvent({
      type: EventType.SYSTEM_STOP,
      component: ComponentType.SYSTEM,
      severity: Severity.INFO,
      message: 'System Memory shutting down'
    });
    
    // Persist memory one last time
    this.persistMemory();
  }
}

// Export the singleton instance
export const systemMemory = SystemMemory.getInstance();

// Export default for compatibility
export default systemMemory;