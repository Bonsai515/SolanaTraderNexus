/**
 * Logger module for the Quantum HitSquad Nexus Professional System
 * 
 * Provides unified logging functionality with timestamps, log levels, and 
 * structured format for all system components.
 */

// Log levels enum
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  FATAL = 'FATAL'
}

// Logger interface for consistent implementation
interface ILogger {
  debug(message: string): void;
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  fatal(message: string): void;
}

/**
 * Default logger implementation
 */
class Logger implements ILogger {
  private logLevel: LogLevel = LogLevel.INFO;

  /**
   * Set the minimum log level to display
   */
  public setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  /**
   * Log a debug message
   */
  public debug(message: string): void {
    this.log(LogLevel.DEBUG, message);
  }

  /**
   * Log an info message
   */
  public info(message: string): void {
    this.log(LogLevel.INFO, message);
  }

  /**
   * Log a warning message
   */
  public warn(message: string): void {
    this.log(LogLevel.WARN, message);
  }

  /**
   * Log an error message
   */
  public error(message: string): void {
    this.log(LogLevel.ERROR, message);
  }

  /**
   * Log a fatal error message
   */
  public fatal(message: string): void {
    this.log(LogLevel.FATAL, message);
  }

  /**
   * Internal logging method with timestamp and formatting
   */
  private log(level: LogLevel, message: string): void {
    // Only log if the message level is greater than or equal to the configured level
    const logLevelValues = {
      [LogLevel.DEBUG]: 0,
      [LogLevel.INFO]: 1,
      [LogLevel.WARN]: 2,
      [LogLevel.ERROR]: 3,
      [LogLevel.FATAL]: 4
    };

    if (logLevelValues[level] >= logLevelValues[this.logLevel]) {
      const timestamp = new Date().toISOString();
      const formattedMessage = `${timestamp} [${level}] ${message}`;
      
      // Output to console with appropriate styling
      switch (level) {
        case LogLevel.DEBUG:
          console.log(formattedMessage);
          break;
        case LogLevel.INFO:
          console.info(formattedMessage);
          break;
        case LogLevel.WARN:
          console.warn(formattedMessage);
          break;
        case LogLevel.ERROR:
        case LogLevel.FATAL:
          console.error(formattedMessage);
          break;
      }
    }
  }
}

// Create singleton instance
const logger = new Logger();

// Set default log level (can be overridden by environment variable)
if (process.env.LOG_LEVEL && Object.values(LogLevel).includes(process.env.LOG_LEVEL as LogLevel)) {
  logger.setLogLevel(process.env.LOG_LEVEL as LogLevel);
}

// Export default logger instance
export default logger;