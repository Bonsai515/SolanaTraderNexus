/**
 * Logger Module
 * 
 * Provides consistent logging functionality throughout the system
 * with different log levels and formatting.
 */

// Log levels
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4
}

// Current log level (can be changed at runtime)
let currentLogLevel: LogLevel = LogLevel.DEBUG;

// Log with timestamp and level
function log(level: LogLevel, message: string, ...args: any[]): void {
  if (level < currentLogLevel) {
    return;
  }

  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const levelStr = LogLevel[level].toLowerCase();
  
  let formattedMessage = `${timestamp} ${levelStr}: ${message}`;
  
  if (args.length > 0) {
    // Format error objects specially
    const formattedArgs = args.map(arg => {
      if (arg instanceof Error) {
        return arg.stack || arg.message;
      }
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg);
        } catch (e) {
          return String(arg);
        }
      }
      return arg;
    });
    
    console.log(formattedMessage, ...formattedArgs);
  } else {
    console.log(formattedMessage);
  }
}

// Debug level logs
export function debug(message: string, ...args: any[]): void {
  log(LogLevel.DEBUG, message, ...args);
}

// Info level logs
export function info(message: string, ...args: any[]): void {
  log(LogLevel.INFO, message, ...args);
}

// Warning level logs
export function warn(message: string, ...args: any[]): void {
  log(LogLevel.WARN, message, ...args);
}

// Error level logs
export function error(message: string, ...args: any[]): void {
  log(LogLevel.ERROR, message, ...args);
}

// Set the log level
export function setLogLevel(level: LogLevel): void {
  currentLogLevel = level;
  info(`Log level set to ${LogLevel[level]}`);
}

// Get the current log level
export function getLogLevel(): LogLevel {
  return currentLogLevel;
}

// Export default object for compatibility
export default {
  debug,
  info,
  warn,
  error,
  setLogLevel,
  getLogLevel,
  LogLevel
};