/**
 * Logger Module
 */

export const logger = {
  info: (message: string, ...args: any[]) => {
    console.log(`${new Date().toISOString().split('T')[0]} ${new Date().toISOString().split('T')[1].split('.')[0].replace(/:/g, ':')} info: ${message}`, ...args);
  },
  
  warn: (message: string, ...args: any[]) => {
    console.warn(`${new Date().toISOString().split('T')[0]} ${new Date().toISOString().split('T')[1].split('.')[0].replace(/:/g, ':')} warn: ${message}`, ...args);
  },
  
  error: (message: string, ...args: any[]) => {
    console.error(`${new Date().toISOString().split('T')[0]} ${new Date().toISOString().split('T')[1].split('.')[0].replace(/:/g, ':')} error: ${message}`, ...args);
  },
  
  debug: (message: string, ...args: any[]) => {
    console.debug(`${new Date().toISOString().split('T')[0]} ${new Date().toISOString().split('T')[1].split('.')[0].replace(/:/g, ':')} debug: ${message}`, ...args);
  }
};