/**
 * Enhanced Logger Module
 * 
 * Provides structured logging capabilities with multiple severity levels
 * and automatic timestamping. Supports both console and file output.
 */

import fs from 'fs';
import path from 'path';

// Log levels
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

// Current log level (can be changed at runtime)
let currentLogLevel: LogLevel = LogLevel.INFO;

// Directory for log files
const LOG_DIR = path.join(process.cwd(), 'logs');

// Ensure log directory exists
try {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
} catch (error) {
  console.error(`Failed to create log directory: ${error}`);
}

// Log file path
const LOG_FILE = path.join(LOG_DIR, `system_${new Date().toISOString().split('T')[0]}.log`);

/**
 * Write to log file
 * @param message Message to log
 */
function writeToFile(message: string): void {
  try {
    fs.appendFileSync(LOG_FILE, message + '\n');
  } catch (error) {
    console.error(`Failed to write to log file: ${error}`);
  }
}

/**
 * Format timestamp for logging
 * @returns Formatted timestamp
 */
function getTimestamp(): string {
  const now = new Date();
  return now.toISOString();
}

/**
 * Log a debug message
 * @param message Message to log
 * @param args Additional arguments
 */
export function debug(message: string, ...args: any[]): void {
  if (currentLogLevel <= LogLevel.DEBUG) {
    const formattedMessage = `${getTimestamp()} [DEBUG] ${message}`;
    console.debug(formattedMessage, ...args);
    writeToFile(`${formattedMessage} ${args.length ? JSON.stringify(args) : ''}`);
  }
}

/**
 * Log an info message
 * @param message Message to log
 * @param args Additional arguments
 */
export function info(message: string, ...args: any[]): void {
  if (currentLogLevel <= LogLevel.INFO) {
    const formattedMessage = `${getTimestamp()} [INFO] ${message}`;
    console.log(formattedMessage, ...args);
    writeToFile(`${formattedMessage} ${args.length ? JSON.stringify(args) : ''}`);
  }
}

/**
 * Log a warning message
 * @param message Message to log
 * @param args Additional arguments
 */
export function warn(message: string, ...args: any[]): void {
  if (currentLogLevel <= LogLevel.WARN) {
    const formattedMessage = `${getTimestamp()} [WARN] ${message}`;
    console.warn(formattedMessage, ...args);
    writeToFile(`${formattedMessage} ${args.length ? JSON.stringify(args) : ''}`);
  }
}

/**
 * Log an error message
 * @param message Message to log
 * @param args Additional arguments
 */
export function error(message: string, ...args: any[]): void {
  if (currentLogLevel <= LogLevel.ERROR) {
    const formattedMessage = `${getTimestamp()} [ERROR] ${message}`;
    console.error(formattedMessage, ...args);
    writeToFile(`${formattedMessage} ${args.length ? JSON.stringify(args) : ''}`);
  }
}

/**
 * Set the current log level
 * @param level New log level
 */
export function setLogLevel(level: LogLevel): void {
  currentLogLevel = level;
  info(`Log level set to ${LogLevel[level]}`);
}

/**
 * Get the current log level
 * @returns Current log level
 */
export function getLogLevel(): LogLevel {
  return currentLogLevel;
}

/**
 * Get a logger with a specific context name
 * @param context The context name for the logger
 * @returns A logger object with the context
 */
export function getLogger(context: string) {
  return {
    debug: (message: string, ...args: any[]) => debug(`[${context}] ${message}`, ...args),
    info: (message: string, ...args: any[]) => info(`[${context}] ${message}`, ...args),
    warn: (message: string, ...args: any[]) => warn(`[${context}] ${message}`, ...args),
    error: (message: string, ...args: any[]) => error(`[${context}] ${message}`, ...args)
  };
}

// Export the logger object for compatibility with JavaScript's logger.js
export const logger = {
  debug,
  info,
  warn,
  error,
  setLogLevel,
  getLogLevel,
  getLogger
};

// Export default logger for convenience
export default logger;