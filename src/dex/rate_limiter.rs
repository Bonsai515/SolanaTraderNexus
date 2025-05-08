use anyhow::Result;
use governor::{Quota, RateLimiter as GovernorRateLimiter, clock::{DefaultClock, Clock}};
use nonzero_ext::nonzero;
use std::num::NonZeroU32;
use std::sync::Arc;
use std::time::Duration;
use log::{info, warn, debug};

/// Rate limiter to prevent exceeding API limits
pub struct RateLimiter {
    /// DEX API rate limiter (queries per second)
    dex_limiter: Arc<GovernorRateLimiter<&'static str, DefaultClock>>,
    
    /// Price feed rate limiter (queries per second)
    price_limiter: Arc<GovernorRateLimiter<&'static str, DefaultClock>>,
    
    /// Order submission rate limiter (orders per minute)
    order_limiter: Arc<GovernorRateLimiter<&'static str, DefaultClock>>,
}

impl RateLimiter {
    /// Create a new rate limiter with default settings
    pub fn new() -> Self {
        // Default limits
        // 5 DEX queries per second
        let dex_limiter = Arc::new(GovernorRateLimiter::direct(Quota::per_second(nonzero!(5u32))));
        
        // 10 price queries per second
        let price_limiter = Arc::new(GovernorRateLimiter::direct(Quota::per_second(nonzero!(10u32))));
        
        // 10 orders per minute
        let order_limiter = Arc::new(GovernorRateLimiter::direct(Quota::per_minute(nonzero!(10u32))));
        
        info!("Rate limiter initialized with default settings");
        Self {
            dex_limiter,
            price_limiter,
            order_limiter,
        }
    }
    
    /// Create a new rate limiter with custom settings
    pub fn with_limits(dex_per_second: u32, price_per_second: u32, orders_per_minute: u32) -> Self {
        let dex_per_second = NonZeroU32::new(dex_per_second).unwrap_or(nonzero!(5u32));
        let price_per_second = NonZeroU32::new(price_per_second).unwrap_or(nonzero!(10u32));
        let orders_per_minute = NonZeroU32::new(orders_per_minute).unwrap_or(nonzero!(10u32));
        
        let dex_limiter = Arc::new(GovernorRateLimiter::direct(Quota::per_second(dex_per_second)));
        let price_limiter = Arc::new(GovernorRateLimiter::direct(Quota::per_second(price_per_second)));
        let order_limiter = Arc::new(GovernorRateLimiter::direct(Quota::per_minute(orders_per_minute)));
        
        info!("Rate limiter initialized with custom settings: DEX={}/s, Price={}/s, Orders={}/min", 
              dex_per_second, price_per_second, orders_per_minute);
        
        Self {
            dex_limiter,
            price_limiter,
            order_limiter,
        }
    }
    
    /// Check if we can make a DEX query and wait if necessary
    pub async fn check_dex_query(&self) -> Result<()> {
        match self.dex_limiter.check_key(&"dex_query") {
            Ok(_) => {
                debug!("DEX query permitted immediately");
                Ok(())
            },
            Err(negative) => {
                let wait_time = negative.wait_time_from(DefaultClock::default().now());
                debug!("Rate limit hit for DEX query, waiting for {:?}", wait_time);
                tokio::time::sleep(wait_time).await;
                Ok(())
            }
        }
    }
    
    /// Check if we can make a price query and wait if necessary
    pub async fn check_price_query(&self) -> Result<()> {
        match self.price_limiter.check_key(&"price_query") {
            Ok(_) => {
                debug!("Price query permitted immediately");
                Ok(())
            },
            Err(negative) => {
                let wait_time = negative.wait_time_from(DefaultClock::default().now());
                debug!("Rate limit hit for price query, waiting for {:?}", wait_time);
                tokio::time::sleep(wait_time).await;
                Ok(())
            }
        }
    }
    
    /// Check if we can submit an order and wait if necessary
    pub async fn check_order_submission(&self) -> Result<()> {
        match self.order_limiter.check_key(&"order_submission") {
            Ok(_) => {
                debug!("Order submission permitted immediately");
                Ok(())
            },
            Err(negative) => {
                let wait_time = negative.wait_time_from(DefaultClock::default().now());
                warn!("Rate limit hit for order submission, waiting for {:?}", wait_time);
                tokio::time::sleep(wait_time).await;
                Ok(())
            }
        }
    }
    
    /// Update the DEX queries per second limit
    pub fn set_dex_queries_per_second(&mut self, queries_per_second: u32) {
        let queries_per_second = NonZeroU32::new(queries_per_second).unwrap_or(nonzero!(5u32));
        self.dex_limiter = Arc::new(GovernorRateLimiter::direct(Quota::per_second(queries_per_second)));
        info!("DEX query rate limit updated to {}/second", queries_per_second);
    }
    
    /// Update the price queries per second limit
    pub fn set_price_queries_per_second(&mut self, queries_per_second: u32) {
        let queries_per_second = NonZeroU32::new(queries_per_second).unwrap_or(nonzero!(10u32));
        self.price_limiter = Arc::new(GovernorRateLimiter::direct(Quota::per_second(queries_per_second)));
        info!("Price query rate limit updated to {}/second", queries_per_second);
    }
    
    /// Update the orders per minute limit
    pub fn set_orders_per_minute(&mut self, orders_per_minute: u32) {
        let orders_per_minute = NonZeroU32::new(orders_per_minute).unwrap_or(nonzero!(10u32));
        self.order_limiter = Arc::new(GovernorRateLimiter::direct(Quota::per_minute(orders_per_minute)));
        info!("Order submission rate limit updated to {}/minute", orders_per_minute);
    }
}