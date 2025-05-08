// Logger configuration

import winston from 'winston';
import path from 'path';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define log level based on environment
const level = () => {
  const env = process.env.NODE_ENV || 'development';
  return env === 'development' ? 'debug' : 'info';
};

// Define custom colors
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

// Add colors to winston
winston.addColors(colors);

// Define format for console output
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
);

// Define format for file output
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.json(),
);

// Define log directory
const logDir = path.join(process.cwd(), 'logs');

// Configure transports
const transports = [
  // Console transport
  new winston.transports.Console({ format: consoleFormat }),
  
  // File transports - for production use
  // new winston.transports.File({
  //   filename: path.join(logDir, 'error.log'),
  //   level: 'error',
  //   format: fileFormat,
  // }),
  // new winston.transports.File({
  //   filename: path.join(logDir, 'combined.log'),
  //   format: fileFormat,
  // }),
];

// Create logger
export const logger = winston.createLogger({
  level: level(),
  levels,
  transports,
});

// Export default logger
export default logger;