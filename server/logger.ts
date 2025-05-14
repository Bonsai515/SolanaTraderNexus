/**
 * Enhanced Logger Module
 * 
 * Provides consistent logging functionality across the application
 * with support for different log levels and output formats.
 */

import fs from 'fs';
import path from 'path';

// Log levels
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

// Logger interface
export interface Logger {
  error(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  debug(message: string, ...args: any[]): void;
}

// Logger implementation
class LoggerImpl implements Logger {
  private name: string;
  private level: LogLevel;
  private logToFile: boolean;
  private logDir: string;
  private logFileName: string;
  
  constructor(name: string, level: LogLevel = LogLevel.INFO, logToFile: boolean = true) {
    this.name = name;
    this.level = level;
    this.logToFile = logToFile;
    this.logDir = path.join(process.cwd(), 'logs');
    this.logFileName = path.join(this.logDir, `${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}.log`);
    
    // Ensure log directory exists
    if (this.logToFile && !fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }
  
  private log(level: string, message: string, ...args: any[]): void {
    const timestamp = new Date().toISOString();
    const formattedMessage = `${timestamp} ${level} [${this.name}] ${message}`;
    
    // Format additional arguments
    let logLine = formattedMessage;
    if (args.length > 0) {
      const argsStr = args.map(arg => {
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg);
          } catch (e) {
            return String(arg);
          }
        }
        return String(arg);
      }).join(' ');
      
      logLine = `${formattedMessage} ${argsStr}`;
    }
    
    // Log to console
    switch (level) {
      case 'ERROR':
        console.error(logLine);
        break;
      case 'WARN':
        console.warn(logLine);
        break;
      case 'INFO':
        console.info(logLine);
        break;
      case 'DEBUG':
        console.debug(logLine);
        break;
      default:
        console.log(logLine);
    }
    
    // Log to file if enabled
    if (this.logToFile) {
      try {
        fs.appendFileSync(this.logFileName, `${logLine}\n`);
      } catch (error) {
        console.error(`Failed to write to log file: ${error.message}`);
      }
    }
  }
  
  error(message: string, ...args: any[]): void {
    if (this.level >= LogLevel.ERROR) {
      this.log('ERROR', message, ...args);
    }
  }
  
  warn(message: string, ...args: any[]): void {
    if (this.level >= LogLevel.WARN) {
      this.log('WARN', message, ...args);
    }
  }
  
  info(message: string, ...args: any[]): void {
    if (this.level >= LogLevel.INFO) {
      this.log('INFO', message, ...args);
    }
  }
  
  debug(message: string, ...args: any[]): void {
    if (this.level >= LogLevel.DEBUG) {
      this.log('DEBUG', message, ...args);
    }
  }
}

// Logger cache to avoid creating multiple loggers with the same name
const loggers: Map<string, Logger> = new Map();

// Get log level from environment or use INFO as default
function getLogLevelFromEnv(): LogLevel {
  const envLevel = process.env.LOG_LEVEL?.toLowerCase();
  
  switch (envLevel) {
    case 'error':
      return LogLevel.ERROR;
    case 'warn':
      return LogLevel.WARN;
    case 'debug':
      return LogLevel.DEBUG;
    case 'info':
    default:
      return LogLevel.INFO;
  }
}

// Create or get a logger instance
export function getLogger(name: string): Logger {
  if (loggers.has(name)) {
    return loggers.get(name)!;
  }
  
  const logger = new LoggerImpl(name, getLogLevelFromEnv());
  loggers.set(name, logger);
  
  return logger;
}

// Default logger
export const logger = getLogger('App');