// Rate limiter for API calls to prevent hitting rate limits

use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tokio::time::sleep;
use log::{debug, warn};
use once_cell::sync::Lazy;
use nonzero_ext::nonzero;
use governor::{
    Quota, RateLimiter,
    clock::DefaultClock,
    state::{InMemoryState, NotKeyed},
};

/// Global rate limiters for different APIs
static RATE_LIMITERS: Lazy<Mutex<HashMap<String, ApiRateLimiter>>> = 
    Lazy::new(|| Mutex::new(HashMap::new()));

/// API rate limiter using token bucket algorithm
pub struct ApiRateLimiter {
    /// API name for logging
    name: String,
    
    /// Rate limiter implementation
    limiter: RateLimiter<NotKeyed, InMemoryState, DefaultClock>,
    
    /// Last request time for this API
    last_request: Instant,
    
    /// Minimum delay between requests (ms)
    min_delay_ms: u64,
    
    /// Whether to warn on rate limiting
    warn_on_limit: bool,
}

impl ApiRateLimiter {
    /// Create a new API rate limiter
    pub fn new(
        name: &str,
        requests_per_minute: u32,
        min_delay_ms: u64,
        warn_on_limit: bool,
    ) -> Self {
        let quota = Quota::per_minute(nonzero!(requests_per_minute));
        
        Self {
            name: name.to_string(),
            limiter: RateLimiter::direct(quota),
            last_request: Instant::now(),
            min_delay_ms,
            warn_on_limit,
        }
    }
    
    /// Try to acquire a rate limit token, sleeping if necessary
    pub async fn acquire(&mut self) {
        // Check minimum delay between requests
        let elapsed = self.last_request.elapsed();
        let min_delay = Duration::from_millis(self.min_delay_ms);
        
        if elapsed < min_delay {
            let sleep_duration = min_delay - elapsed;
            debug!("Enforcing minimum delay for {}, sleeping for {:?}", 
                   self.name, sleep_duration);
            sleep(sleep_duration).await;
        }
        
        // Use the governor rate limiter
        match self.limiter.check() {
            Ok(_) => {
                // We're good to go
                self.last_request = Instant::now();
            }
            Err(negative) => {
                // Need to wait
                let wait_time = negative.wait_time_from(Instant::now());
                
                if self.warn_on_limit {
                    warn!("Rate limit reached for {}, waiting for {:?}",
                          self.name, wait_time);
                } else {
                    debug!("Rate limit reached for {}, waiting for {:?}",
                           self.name, wait_time);
                }
                
                sleep(wait_time).await;
                self.last_request = Instant::now();
            }
        }
    }
}

/// Get or create a rate limiter for an API
pub fn get_rate_limiter(
    name: &str,
    requests_per_minute: u32,
    min_delay_ms: u64,
    warn_on_limit: bool,
) -> ApiRateLimiter {
    let mut limiters = RATE_LIMITERS.lock().unwrap();
    
    if let Some(limiter) = limiters.get(name) {
        return limiter.clone();
    }
    
    // Create new rate limiter
    let limiter = ApiRateLimiter::new(name, requests_per_minute, min_delay_ms, warn_on_limit);
    limiters.insert(name.to_string(), limiter.clone());
    
    limiter
}

/// Apply rate limiting for an API
pub async fn apply_rate_limiting(
    name: &str,
    requests_per_minute: u32,
    min_delay_ms: u64,
) {
    let mut limiter = get_rate_limiter(name, requests_per_minute, min_delay_ms, false);
    limiter.acquire().await;
}

impl Clone for ApiRateLimiter {
    fn clone(&self) -> Self {
        Self {
            name: self.name.clone(),
            limiter: self.limiter.clone(),
            last_request: self.last_request,
            min_delay_ms: self.min_delay_ms,
            warn_on_limit: self.warn_on_limit,
        }
    }
}