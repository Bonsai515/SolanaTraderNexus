use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use log::{info, warn, error, debug};
use anyhow::{Result, anyhow};
use tokio::time::sleep;

// RPC rate limit configuration
const DAILY_LIMIT: u32 = 40_000; // 40k requests per day
const HOURLY_ALLOCATION: u32 = DAILY_LIMIT / 24; // Distribute evenly across 24 hours
const MINUTE_ALLOCATION: u32 = HOURLY_ALLOCATION / 60; // Distribute evenly across 60 minutes
const BURST_LIMIT: u32 = MINUTE_ALLOCATION * 5; // Allow for bursts of activity (5 minutes worth)
const COOL_DOWN_PERIOD: Duration = Duration::from_secs(60); // 1 minute cooldown if we hit limits

// Prioritization of different request types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum RequestPriority {
    Critical,  // Must execute (transaction signing, etc.)
    High,      // Important but can be delayed (price checks for active strategies)
    Medium,    // Regular operations (routine monitoring)
    Low,       // Background tasks (historical data, analytics)
}

impl RequestPriority {
    pub fn to_cost(&self) -> u32 {
        match self {
            RequestPriority::Critical => 1,  // Always allow critical requests
            RequestPriority::High => 2,      // 2 request cost units
            RequestPriority::Medium => 3,    // 3 request cost units
            RequestPriority::Low => 5,       // 5 request cost units
        }
    }
}

// Usage stats for tracking RPC consumption
#[derive(Debug, Clone)]
pub struct RpcUsageStats {
    pub total_requests: u32,
    pub successful_requests: u32,
    pub failed_requests: u32,
    pub throttled_requests: u32,
    pub current_daily_usage: u32,
    pub last_reset: Instant,
    pub requests_by_priority: std::collections::HashMap<RequestPriority, u32>,
}

impl RpcUsageStats {
    pub fn new() -> Self {
        Self {
            total_requests: 0,
            successful_requests: 0,
            failed_requests: 0,
            throttled_requests: 0,
            current_daily_usage: 0,
            last_reset: Instant::now(),
            requests_by_priority: std::collections::HashMap::new(),
        }
    }

    pub fn reset_daily(&mut self) {
        debug!("Resetting daily RPC usage stats");
        self.current_daily_usage = 0;
        self.last_reset = Instant::now();
    }

    pub fn record_request(&mut self, priority: RequestPriority, success: bool) {
        self.total_requests += 1;
        
        // Update priority-specific counter
        *self.requests_by_priority.entry(priority).or_insert(0) += 1;
        
        if success {
            self.successful_requests += 1;
            self.current_daily_usage += priority.to_cost();
        } else {
            self.failed_requests += 1;
        }
    }

    pub fn record_throttled(&mut self, priority: RequestPriority) {
        self.throttled_requests += 1;
        
        // Still count towards total
        self.total_requests += 1;
        
        // Update priority-specific counter
        *self.requests_by_priority.entry(priority).or_insert(0) += 1;
    }

    pub fn get_success_rate(&self) -> f64 {
        if self.total_requests == 0 {
            return 1.0;
        }
        self.successful_requests as f64 / self.total_requests as f64
    }

    pub fn get_usage_percent(&self) -> f64 {
        self.current_daily_usage as f64 / DAILY_LIMIT as f64 * 100.0
    }

    pub fn get_summary(&self) -> String {
        format!(
            "RPC Usage: {:.2}% ({}/{}) - Success rate: {:.2}% - Throttled: {}",
            self.get_usage_percent(),
            self.current_daily_usage,
            DAILY_LIMIT,
            self.get_success_rate() * 100.0,
            self.throttled_requests
        )
    }
}

// Rate limiter for controlling RPC usage
pub struct RpcRateLimiter {
    stats: Mutex<RpcUsageStats>,
    minute_counter: Mutex<(Instant, u32)>, // (start_time, count)
    burst_counter: Mutex<(Instant, u32)>,  // (start_time, count)
    is_cooling_down: Mutex<bool>,
}

impl RpcRateLimiter {
    pub fn new() -> Self {
        let now = Instant::now();
        
        Self {
            stats: Mutex::new(RpcUsageStats::new()),
            minute_counter: Mutex::new((now, 0)),
            burst_counter: Mutex::new((now, 0)),
            is_cooling_down: Mutex::new(false),
        }
    }

    pub fn get_stats(&self) -> RpcUsageStats {
        self.stats.lock().unwrap().clone()
    }

    // Check if a request should be allowed based on priority and current usage
    pub fn check_limit(&self, priority: RequestPriority) -> bool {
        let mut stats = self.stats.lock().unwrap();
        
        // Always reset daily stats if 24 hours have passed
        if stats.last_reset.elapsed() >= Duration::from_secs(24 * 60 * 60) {
            stats.reset_daily();
        }
        
        // If we're already over the daily limit, only allow critical requests
        if stats.current_daily_usage >= DAILY_LIMIT {
            if priority == RequestPriority::Critical {
                debug!("Daily limit exceeded but allowing critical request");
                return true;
            } else {
                warn!("Daily limit exceeded, rejecting {:?} request", priority);
                stats.record_throttled(priority);
                return false;
            }
        }
        
        // If we're cooling down, only accept critical requests
        if *self.is_cooling_down.lock().unwrap() {
            if priority == RequestPriority::Critical {
                debug!("In cooldown but allowing critical request");
                return true;
            } else {
                debug!("In cooldown, rejecting {:?} request", priority);
                stats.record_throttled(priority);
                return false;
            }
        }
        
        // Check minute limit
        let mut minute_data = self.minute_counter.lock().unwrap();
        if minute_data.0.elapsed() >= Duration::from_secs(60) {
            // Reset minute counter if 60 seconds have passed
            *minute_data = (Instant::now(), 0);
        }
        
        if minute_data.1 >= MINUTE_ALLOCATION {
            // We've hit our minute allocation, check the burst limit
            let mut burst_data = self.burst_counter.lock().unwrap();
            
            if burst_data.0.elapsed() >= Duration::from_secs(60 * 5) {
                // Reset burst counter if 5 minutes have passed
                *burst_data = (Instant::now(), 0);
            }
            
            if burst_data.1 >= BURST_LIMIT {
                // We've hit both minute and burst limits, enter cooldown mode
                if !*self.is_cooling_down.lock().unwrap() {
                    warn!("Entering RPC cooldown period due to high request volume");
                    *self.is_cooling_down.lock().unwrap() = true;
                    
                    // Spawn async task to end cooldown after the period
                    let cooldown_state = Arc::new(self.is_cooling_down.clone());
                    tokio::spawn(async move {
                        sleep(COOL_DOWN_PERIOD).await;
                        *cooldown_state.lock().unwrap() = false;
                        debug!("Exiting RPC cooldown period");
                    });
                }
                
                if priority == RequestPriority::Critical {
                    debug!("Hit rate limits but allowing critical request");
                    return true;
                } else {
                    debug!("Hit rate limits, rejecting {:?} request", priority);
                    stats.record_throttled(priority);
                    return false;
                }
            }
            
            // Update burst counter
            burst_data.1 += 1;
        }
        
        // Update minute counter
        minute_data.1 += 1;
        
        // If we made it this far, allow the request
        true
    }

    // Record the result of an RPC request
    pub fn record_request(&self, priority: RequestPriority, success: bool) {
        let mut stats = self.stats.lock().unwrap();
        stats.record_request(priority, success);
        
        // Log current usage every 100 requests
        if stats.total_requests % 100 == 0 {
            info!("{}", stats.get_summary());
        }
    }

    // Wait until a request can be processed (for critical operations that must not be skipped)
    pub async fn wait_for_availability(&self, priority: RequestPriority) -> Result<()> {
        if priority != RequestPriority::Critical {
            // Only Critical priority can force wait
            return Err(anyhow!("Only Critical priority can use wait_for_availability"));
        }
        
        let max_retries = 10;
        let mut retry_count = 0;
        
        while !self.check_limit(priority) {
            retry_count += 1;
            
            if retry_count > max_retries {
                return Err(anyhow!("Exceeded maximum retries waiting for RPC availability"));
            }
            
            debug!("Waiting for RPC availability (retry {}/{})", retry_count, max_retries);
            sleep(Duration::from_secs(retry_count * 5)).await; // Exponential backoff
        }
        
        Ok(())
    }

    // Adaptive request handling based on current system load and rate limits
    pub async fn adaptive_request<F, T>(&self, priority: RequestPriority, f: F) -> Result<T>
    where
        F: FnOnce() -> Result<T>,
    {
        // For critical requests, wait if necessary
        if priority == RequestPriority::Critical {
            self.wait_for_availability(priority).await?;
            
            // Execute the request and record result
            match f() {
                Ok(res) => {
                    self.record_request(priority, true);
                    Ok(res)
                }
                Err(e) => {
                    self.record_request(priority, false);
                    Err(anyhow!("Critical RPC request failed: {}", e))
                }
            }
        } else if self.check_limit(priority) {
            // For non-critical requests, check limits first
            match f() {
                Ok(res) => {
                    self.record_request(priority, true);
                    Ok(res)
                }
                Err(e) => {
                    self.record_request(priority, false);
                    Err(anyhow!("{:?} RPC request failed: {}", priority, e))
                }
            }
        } else {
            // Request would exceed rate limits, log and return error
            Err(anyhow!("Rate limited: {:?} request rejected to prevent API rate limit violation", priority))
        }
    }
}

impl Default for RpcRateLimiter {
    fn default() -> Self {
        Self::new()
    }
}