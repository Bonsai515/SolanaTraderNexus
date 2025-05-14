import fs from 'fs';
import path from 'path';

export interface Logger {
  error(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  debug(message: string, ...args: any[]): void;
}

class LoggerImpl implements Logger {
  private name: string;
  private logDir: string;

  constructor(name: string) {
    this.name = name;
    this.logDir = path.join(process.cwd(), 'logs');

    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private log(level: string, message: string, ...args: any[]): void {
    const timestamp = new Date().toISOString();
    const logLine = `${timestamp} [${level}] [${this.name}] ${message} ${args.join(' ')}`;
    console.log(logLine);

    const logFile = path.join(this.logDir, `${this.name.toLowerCase()}.log`);
    fs.appendFileSync(logFile, logLine + '\n');
  }

  error(message: string, ...args: any[]): void {
    this.log('ERROR', message, ...args);
  }

  warn(message: string, ...args: any[]): void {
    this.log('WARN', message, ...args);
  }

  info(message: string, ...args: any[]): void {
    this.log('INFO', message, ...args);
  }

  debug(message: string, ...args: any[]): void {
    this.log('DEBUG', message, ...args);
  }
}

export const logger = new LoggerImpl('App');
export const error = logger.error.bind(logger);
export const warn = logger.warn.bind(logger);
export const info = logger.info.bind(logger);
export const debug = logger.debug.bind(logger);