/**
 * Jupiter API Rate Limiter
 * 
 * Implements rate limiting for Jupiter DEX API to 1 API call per second
 * as required for high-volume trading operations.
 */

import { logger } from '../logger';

class JupiterRateLimiter {
  private queue: Array<{
    task: () => Promise<any>;
    resolve: (value: any) => void;
    reject: (reason: any) => void;
  }> = [];
  private processing = false;
  private lastCallTimestamp = 0;
  private minIntervalMs = 1000; // 1 call per second

  /**
   * Execute a task with rate limiting
   * @param task Function that returns a promise
   * @returns Promise resolved with the result of the task
   */
  public async execute<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      // Add task to queue
      this.queue.push({
        task,
        resolve: resolve as (value: any) => void,
        reject
      });

      // Start processing if not already processing
      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  /**
   * Process tasks in the queue with rate limiting
   */
  private async processQueue(): Promise<void> {
    if (this.queue.length === 0) {
      this.processing = false;
      return;
    }

    this.processing = true;

    // Get the next task
    const { task, resolve, reject } = this.queue.shift()!;

    // Calculate time to wait for rate limiting
    const now = Date.now();
    const timeToWait = Math.max(0, this.lastCallTimestamp + this.minIntervalMs - now);

    if (timeToWait > 0) {
      logger.debug(`Jupiter API rate limit: waiting ${timeToWait}ms before next call`);
      await new Promise(resolve => setTimeout(resolve, timeToWait));
    }

    // Update last call timestamp
    this.lastCallTimestamp = Date.now();

    try {
      // Execute the task
      const result = await task();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      // Process next task
      setTimeout(() => this.processQueue(), 0);
    }
  }

  /**
   * Update the rate limit (calls per second)
   * @param callsPerSecond Number of calls allowed per second
   */
  public setRateLimit(callsPerSecond: number): void {
    if (callsPerSecond <= 0) {
      throw new Error("Rate limit must be greater than 0");
    }
    this.minIntervalMs = Math.floor(1000 / callsPerSecond);
    logger.info(`Jupiter API rate limit set to ${callsPerSecond} calls per second (${this.minIntervalMs}ms interval)`);
  }

  /**
   * Clear the queue (cancels all pending tasks)
   */
  public clearQueue(): void {
    const queueLength = this.queue.length;
    this.queue.forEach(({ reject }) => {
      reject(new Error("Task cancelled: queue cleared"));
    });
    this.queue = [];
    logger.info(`Cleared Jupiter API rate limit queue (${queueLength} tasks cancelled)`);
  }
}

// Export a singleton instance
export const jupiterRateLimiter = new JupiterRateLimiter();