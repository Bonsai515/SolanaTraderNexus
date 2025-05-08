// Rate limiter for Solana API calls

use anyhow::{Result, anyhow, Context};
use log::{info, warn, error, debug};
use serde::{Serialize, Deserialize};
use std::time::{Duration, Instant};

/// Rate limiter configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RateLimiterConfig {
    /// Maximum number of requests per interval
    pub max_requests: usize,
    
    /// Interval duration in seconds
    pub interval_seconds: u64,
    
    /// Burst allowance (additional requests allowed in short period)
    pub burst_allowance: usize,
}

impl Default for RateLimiterConfig {
    fn default() -> Self {
        Self {
            max_requests: 100,
            interval_seconds: 10,
            burst_allowance: 10,
        }
    }
}

/// Rate limiter for API calls
pub struct RateLimiter {
    /// Configuration
    config: RateLimiterConfig,
    
    /// Request count
    request_count: usize,
    
    /// Last reset time
    last_reset: Instant,
    
    /// Burst count (additional requests used)
    burst_count: usize,
}

impl RateLimiter {
    /// Create a new rate limiter
    pub fn new(config: RateLimiterConfig) -> Self {
        Self {
            config,
            request_count: 0,
            last_reset: Instant::now(),
            burst_count: 0,
        }
    }
    
    /// Check if rate limited
    pub fn is_limited(&self) -> bool {
        let elapsed = self.last_reset.elapsed();
        let interval = Duration::from_secs(self.config.interval_seconds);
        
        // If interval has passed, we're not limited
        if elapsed >= interval {
            return false;
        }
        
        // Check if we've exceeded the request limit
        if self.request_count < self.config.max_requests {
            return false;
        }
        
        // Check if we have burst allowance
        if self.burst_count < self.config.burst_allowance {
            return false;
        }
        
        // We're rate limited
        true
    }
    
    /// Increment request count
    pub fn increment(&mut self) {
        let elapsed = self.last_reset.elapsed();
        let interval = Duration::from_secs(self.config.interval_seconds);
        
        // Reset if interval has passed
        if elapsed >= interval {
            self.request_count = 1;
            self.last_reset = Instant::now();
            self.burst_count = 0;
            return;
        }
        
        // Increment request count
        self.request_count += 1;
        
        // If we've exceeded the request limit, use burst allowance
        if self.request_count > self.config.max_requests {
            self.burst_count += 1;
            debug!("Using burst allowance: {}/{}", self.burst_count, self.config.burst_allowance);
        }
    }
    
    /// Get time until next reset
    pub fn time_until_reset(&self) -> Duration {
        let elapsed = self.last_reset.elapsed();
        let interval = Duration::from_secs(self.config.interval_seconds);
        
        if elapsed >= interval {
            return Duration::from_secs(0);
        }
        
        interval - elapsed
    }
    
    /// Get time to wait before retry
    pub fn retry_after(&self) -> Duration {
        // If we're not limited, no need to wait
        if !self.is_limited() {
            return Duration::from_secs(0);
        }
        
        // Wait until reset
        self.time_until_reset()
    }
    
    /// Get remaining requests
    pub fn remaining_requests(&self) -> usize {
        let elapsed = self.last_reset.elapsed();
        let interval = Duration::from_secs(self.config.interval_seconds);
        
        // If interval has passed, we have all requests available
        if elapsed >= interval {
            return self.config.max_requests;
        }
        
        // Calculate remaining requests
        if self.request_count < self.config.max_requests {
            self.config.max_requests - self.request_count
        } else {
            // Using burst allowance
            if self.burst_count < self.config.burst_allowance {
                self.config.burst_allowance - self.burst_count
            } else {
                0
            }
        }
    }
    
    /// Get rate limiter statistics
    pub fn get_stats(&self) -> RateLimiterStats {
        RateLimiterStats {
            request_count: self.request_count,
            burst_count: self.burst_count,
            remaining_requests: self.remaining_requests(),
            time_until_reset: self.time_until_reset(),
            is_limited: self.is_limited(),
        }
    }
}

/// Rate limiter statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RateLimiterStats {
    /// Request count
    pub request_count: usize,
    
    /// Burst count
    pub burst_count: usize,
    
    /// Remaining requests
    pub remaining_requests: usize,
    
    /// Time until reset
    #[serde(skip)]
    pub time_until_reset: Duration,
    
    /// Is limited
    pub is_limited: bool,
}