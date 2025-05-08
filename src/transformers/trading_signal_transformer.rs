use crate::models::{TradingSignal, SignalType};
use anyhow::Result;
use log::{info, debug};
use std::sync::{Arc, RwLock};
use std::collections::VecDeque;
use chrono::{DateTime, Utc, Duration};

/// Trading Signal Transformer
/// 
/// Processes, filters, and enhances trading signals.
pub struct TradingSignalTransformer {
    // Is transformer enabled
    enabled: RwLock<bool>,
    
    // Recent signals history (for pattern detection)
    recent_signals: RwLock<VecDeque<TradingSignal>>,
    
    // Minimum confidence threshold
    min_confidence: RwLock<f64>,
    
    // Signal debounce interval (minutes)
    debounce_interval: RwLock<i64>,
}

impl TradingSignalTransformer {
    /// Create a new trading signal transformer
    pub fn new() -> Self {
        info!("Initializing Trading Signal Transformer");
        
        Self {
            enabled: RwLock::new(true),
            recent_signals: RwLock::new(VecDeque::with_capacity(100)),
            min_confidence: RwLock::new(0.6),
            debounce_interval: RwLock::new(30),
        }
    }
    
    /// Process trading signals
    pub fn process_signals(&self, signals: &[TradingSignal]) -> Result<Vec<TradingSignal>> {
        // Check if transformer is enabled
        if !*self.enabled.read().unwrap() {
            debug!("Trading Signal Transformer is disabled");
            return Ok(Vec::new());
        }
        
        let mut processed_signals = Vec::new();
        let min_confidence = *self.min_confidence.read().unwrap();
        let debounce_minutes = *self.debounce_interval.read().unwrap();
        
        debug!("Processing {} trading signals", signals.len());
        
        for signal in signals {
            // Filter out low confidence signals
            if signal.confidence < min_confidence {
                debug!("Filtered out low confidence signal for {}: {:.2}",
                      signal.asset, signal.confidence);
                continue;
            }
            
            // Check for recent similar signals (debouncing)
            if self.is_duplicate_signal(signal, debounce_minutes)? {
                debug!("Filtered out duplicate signal for {}", signal.asset);
                continue;
            }
            
            // Process and enhance signal
            let enhanced_signal = self.enhance_signal(signal)?;
            
            // Add to processed signals
            processed_signals.push(enhanced_signal.clone());
            
            // Add to recent signals history
            let mut history = self.recent_signals.write().unwrap();
            history.push_back(enhanced_signal);
            
            // Limit history size
            while history.len() > 100 {
                history.pop_front();
            }
        }
        
        Ok(processed_signals)
    }
    
    /// Enable or disable the transformer
    pub fn set_enabled(&self, enabled: bool) {
        let mut state = self.enabled.write().unwrap();
        *state = enabled;
        info!("Trading Signal Transformer {}abled", if enabled { "en" } else { "dis" });
    }
    
    /// Set minimum confidence threshold
    pub fn set_min_confidence(&self, threshold: f64) {
        let mut value = self.min_confidence.write().unwrap();
        *value = threshold;
        info!("Trading Signal Transformer minimum confidence set to {:.2}", threshold);
    }
    
    /// Set debounce interval in minutes
    pub fn set_debounce_interval(&self, minutes: i64) {
        let mut value = self.debounce_interval.write().unwrap();
        *value = minutes;
        info!("Trading Signal Transformer debounce interval set to {} minutes", minutes);
    }
    
    /// Check if this is a duplicate of a recent signal
    fn is_duplicate_signal(&self, signal: &TradingSignal, debounce_minutes: i64) -> Result<bool> {
        let history = self.recent_signals.read().unwrap();
        
        // Check for recent similar signals
        for recent in history.iter() {
            // Same asset and signal type
            if recent.asset == signal.asset && recent.signal_type == signal.signal_type {
                // Within debounce interval
                let time_diff = signal.timestamp - recent.timestamp;
                if time_diff < Duration::minutes(debounce_minutes) {
                    return Ok(true);
                }
            }
        }
        
        Ok(false)
    }
    
    /// Enhance a trading signal with additional insights
    fn enhance_signal(&self, signal: &TradingSignal) -> Result<TradingSignal> {
        // In a real implementation, would add additional insights
        // based on historical data, correlations, etc.
        // For now, just clone and possibly adjust confidence
        
        let mut enhanced = signal.clone();
        
        // Check for reinforcement from multiple signals
        let reinforcement = self.check_signal_reinforcement(signal)?;
        if reinforcement > 0.0 {
            enhanced.confidence = (enhanced.confidence + reinforcement).min(0.98);
            enhanced.reason = format!("{} (reinforced by pattern analysis)", enhanced.reason);
        }
        
        Ok(enhanced)
    }
    
    /// Check if this signal is reinforced by previous signals
    fn check_signal_reinforcement(&self, signal: &TradingSignal) -> Result<f64> {
        let history = self.recent_signals.read().unwrap();
        let mut reinforcement = 0.0;
        
        // Look for patterns of similar signals
        let mut similar_count = 0;
        for recent in history.iter() {
            // Same asset and signal type within last 24 hours
            if recent.asset == signal.asset && recent.signal_type == signal.signal_type {
                let time_diff = signal.timestamp - recent.timestamp;
                if time_diff < Duration::hours(24) {
                    similar_count += 1;
                }
            }
        }
        
        // Calculate reinforcement based on number of similar signals
        if similar_count >= 3 {
            // Strong reinforcement for consistent signals
            reinforcement = 0.1;
        } else if similar_count >= 1 {
            // Mild reinforcement
            reinforcement = 0.05;
        }
        
        Ok(reinforcement)
    }
}