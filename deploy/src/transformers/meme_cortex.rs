use crate::models::{MarketData, TokenPrice, TradingSignal, SignalType};
use anyhow::Result;
use log::{info, debug, warn};
use std::sync::{Arc, RwLock};
use std::collections::{HashMap, VecDeque};
use chrono::{DateTime, Utc, Duration};
use rand::{Rng, thread_rng};

/// MEME Cortex Transformer
/// 
/// Specialized transformer for meme token analysis and social sentiment correlation.
/// Uses advanced pattern recognition to detect social media trends and meme token momentum.
pub struct MEMECortexTransformer {
    // Social sentiment tracking
    social_sentiment: RwLock<HashMap<String, SentimentData>>,
    
    // Meme token watchlist
    meme_tokens: RwLock<HashMap<String, MemeTokenData>>,
    
    // Token correlation matrix
    correlation_matrix: RwLock<HashMap<(String, String), f64>>,
    
    // Recent signals to avoid duplication
    recent_signals: RwLock<VecDeque<SignalRecord>>,
    
    // Configuration
    social_weight: RwLock<f64>,
    momentum_threshold: RwLock<f64>,
    volatility_filter: RwLock<f64>,
    
    // Is transformer enabled
    enabled: RwLock<bool>,
}

/// Social sentiment data for an asset
#[derive(Clone, Debug)]
struct SentimentData {
    // Asset name
    asset: String,
    
    // Current sentiment score (-1.0 to 1.0)
    score: f64,
    
    // Sentiment momentum (rate of change)
    momentum: f64,
    
    // Historical sentiment scores
    history: VecDeque<(DateTime<Utc>, f64)>,
    
    // Last update time
    last_update: DateTime<Utc>,
}

/// Meme token specific data
#[derive(Clone, Debug)]
struct MemeTokenData {
    // Token symbol
    symbol: String,
    
    // Volatility score (higher = more volatile)
    volatility: f64,
    
    // Correlation to social signals (0.0 to 1.0)
    social_correlation: f64,
    
    // Historical price points
    price_history: VecDeque<(DateTime<Utc>, f64)>,
    
    // Classification confidence (how confident we are this is a meme token)
    classification_confidence: f64,
}

/// Recent signal record to prevent duplicates
#[derive(Clone, Debug)]
struct SignalRecord {
    // Asset name
    asset: String,
    
    // Signal type
    signal_type: SignalType,
    
    // Timestamp of signal
    timestamp: DateTime<Utc>,
}

impl MEMECortexTransformer {
    /// Create a new MEME Cortex transformer
    pub fn new() -> Self {
        info!("Initializing MEME Cortex Transformer - Meme Token & Social Sentiment Analysis");
        
        Self {
            social_sentiment: RwLock::new(HashMap::new()),
            meme_tokens: RwLock::new(HashMap::new()),
            correlation_matrix: RwLock::new(HashMap::new()),
            recent_signals: RwLock::new(VecDeque::with_capacity(100)),
            social_weight: RwLock::new(0.6),
            momentum_threshold: RwLock::new(0.05),
            volatility_filter: RwLock::new(0.7),
            enabled: RwLock::new(true),
        }
    }
    
    /// Process market data to generate meme token signals
    pub fn process_data(&self, market_data: &MarketData) -> Result<Vec<TradingSignal>> {
        // Check if transformer is enabled
        if !*self.enabled.read().unwrap() {
            debug!("MEME Cortex Transformer is disabled");
            return Ok(Vec::new());
        }
        
        let mut signals = Vec::new();
        debug!("Processing {} tokens with MEME Cortex Transformer", market_data.tokens.len());
        
        // Update social sentiment data
        self.update_social_sentiment()?;
        
        // Process each token
        for token in &market_data.tokens {
            // Check if this is a meme token or update classification
            self.update_meme_classification(token)?;
            
            // Generate signals for meme tokens
            if let Some(signal) = self.analyze_meme_token(token)? {
                // Check if similar signal was recently generated
                if !self.is_recent_signal(&token.symbol, signal.signal_type)? {
                    signals.push(signal);
                    debug!("MEME Cortex generated signal for {}: {:?} (conf: {})", 
                           token.symbol, signal.signal_type, signal.confidence);
                    
                    // Record this signal
                    self.record_signal(&token.symbol, signal.signal_type)?;
                }
            }
        }
        
        // Update correlations between tokens
        self.update_correlations(&market_data.tokens)?;
        
        Ok(signals)
    }
    
    /// Enable or disable the transformer
    pub fn set_enabled(&self, enabled: bool) {
        let mut state = self.enabled.write().unwrap();
        *state = enabled;
        info!("MEME Cortex Transformer {}abled", if enabled { "en" } else { "dis" });
    }
    
    /// Set the social sentiment weight
    pub fn set_social_weight(&self, weight: f64) {
        if weight < 0.0 || weight > 1.0 {
            warn!("Invalid social weight: {}. Must be between 0.0 and 1.0", weight);
            return;
        }
        
        let mut w = self.social_weight.write().unwrap();
        *w = weight;
        info!("MEME Cortex social weight set to {}", weight);
    }
    
    /// Set the momentum threshold
    pub fn set_momentum_threshold(&self, threshold: f64) {
        if threshold < 0.0 || threshold > 1.0 {
            warn!("Invalid momentum threshold: {}. Must be between 0.0 and 1.0", threshold);
            return;
        }
        
        let mut t = self.momentum_threshold.write().unwrap();
        *t = threshold;
        info!("MEME Cortex momentum threshold set to {}", threshold);
    }
    
    /// Update social sentiment data (in real app, would fetch from APIs)
    fn update_social_sentiment(&self) -> Result<()> {
        let mut sentiment = self.social_sentiment.write().unwrap();
        let now = Utc::now();
        
        // For each token in watchlist, update social sentiment
        // In a real app, this would call social media APIs
        
        // Simulate updating a few popular meme tokens
        let meme_tokens = ["DOGE", "SHIB", "PEPE", "BONK", "WIF", "FLOKI"];
        let mut rng = thread_rng();
        
        for &token in &meme_tokens {
            let entry = sentiment.entry(token.to_string()).or_insert_with(|| SentimentData {
                asset: token.to_string(),
                score: 0.0,
                momentum: 0.0,
                history: VecDeque::with_capacity(100),
                last_update: now - Duration::hours(1), // Start with old data
            });
            
            // Only update if enough time has passed
            if now - entry.last_update < Duration::minutes(5) {
                continue;
            }
            
            // Store previous score for momentum calculation
            let prev_score = entry.score;
            
            // In real app, would fetch real social sentiment
            // Simulate changing sentiment with some randomness
            let sentiment_change = rng.gen_range(-0.1..0.1);
            entry.score = (entry.score + sentiment_change).max(-1.0).min(1.0);
            
            // Calculate momentum (rate of change)
            entry.momentum = entry.score - prev_score;
            
            // Add to history
            entry.history.push_back((now, entry.score));
            
            // Limit history size
            while entry.history.len() > 100 {
                entry.history.pop_front();
            }
            
            // Update timestamp
            entry.last_update = now;
            
            debug!("Updated social sentiment for {}: score={:.2}, momentum={:.2}", 
                   token, entry.score, entry.momentum);
        }
        
        Ok(())
    }
    
    /// Update meme token classification
    fn update_meme_classification(&self, token: &TokenPrice) -> Result<()> {
        let mut meme_tokens = self.meme_tokens.write().unwrap();
        let now = Utc::now();
        
        // Check if token is already in our meme token list
        let token_data = meme_tokens.entry(token.symbol.clone()).or_insert_with(|| {
            // Initialize new token data
            let is_known_meme = ["DOGE", "SHIB", "PEPE", "BONK", "WIF", "FLOKI"]
                .contains(&token.symbol.as_str());
                
            MemeTokenData {
                symbol: token.symbol.clone(),
                volatility: 0.0,
                social_correlation: if is_known_meme { 0.8 } else { 0.2 },
                price_history: VecDeque::with_capacity(100),
                classification_confidence: if is_known_meme { 0.9 } else { 0.1 },
            }
        });
        
        // Update volatility based on recent price change
        token_data.volatility = 0.8 * token_data.volatility + 0.2 * token.change_24h.abs() / 10.0;
        
        // Add to price history
        token_data.price_history.push_back((now, token.price));
        
        // Limit history size
        while token_data.price_history.len() > 100 {
            token_data.price_history.pop_front();
        }
        
        // Update classification confidence based on volatility and other factors
        // Meme tokens tend to be more volatile
        if token_data.volatility > 0.5 {
            token_data.classification_confidence = 
                (token_data.classification_confidence + 0.01).min(0.99);
        } else {
            token_data.classification_confidence =
                (token_data.classification_confidence - 0.01).max(0.01);
        }
        
        Ok(())
    }
    
    /// Analyze a potential meme token
    fn analyze_meme_token(&self, token: &TokenPrice) -> Result<Option<TradingSignal>> {
        // Get meme token data
        let meme_tokens = self.meme_tokens.read().unwrap();
        let token_data = match meme_tokens.get(&token.symbol) {
            Some(data) => data,
            None => return Ok(None), // Not classified as meme token
        };
        
        // Skip tokens with low classification confidence
        if token_data.classification_confidence < 0.5 {
            return Ok(None);
        }
        
        // Get social sentiment data
        let sentiment = self.social_sentiment.read().unwrap();
        let sentiment_data = match sentiment.get(&token.symbol) {
            Some(data) => data,
            None => return Ok(None), // No sentiment data
        };
        
        // Get configuration values
        let social_weight = *self.social_weight.read().unwrap();
        let momentum_threshold = *self.momentum_threshold.read().unwrap();
        
        // Combine price momentum and social momentum
        let price_momentum = token.change_24h / 100.0; // Normalize
        let combined_momentum = 
            (1.0 - social_weight) * price_momentum + 
            social_weight * sentiment_data.momentum;
            
        // Generate signal if momentum is strong enough
        if combined_momentum.abs() > momentum_threshold {
            let signal_type = if combined_momentum > 0.0 {
                SignalType::Buy
            } else {
                SignalType::Sell
            };
            
            // Higher confidence for tokens with greater meme classification confidence
            // and stronger momentum
            let confidence = token_data.classification_confidence * 
                             (0.5 + 0.5 * (combined_momentum.abs() / momentum_threshold).min(1.0));
            
            let signal = TradingSignal {
                asset: token.symbol.clone(),
                signal_type,
                price: token.price,
                confidence,
                reason: format!("MEME Cortex social-momentum analysis (momentum: {:.2})", combined_momentum),
                timestamp: Utc::now(),
            };
            
            return Ok(Some(signal));
        }
        
        Ok(None)
    }
    
    /// Update correlations between tokens
    fn update_correlations(&self, tokens: &[TokenPrice]) -> Result<()> {
        let mut correlations = self.correlation_matrix.write().unwrap();
        
        // Update correlations between all token pairs
        for i in 0..tokens.len() {
            for j in (i+1)..tokens.len() {
                let token1 = &tokens[i];
                let token2 = &tokens[j];
                
                let key = if token1.symbol < token2.symbol {
                    (token1.symbol.clone(), token2.symbol.clone())
                } else {
                    (token2.symbol.clone(), token1.symbol.clone())
                };
                
                // In a real app, would calculate actual price correlation
                // Here we just simulate a correlation value
                let old_corr = correlations.get(&key).copied().unwrap_or(0.0);
                
                // Update correlation (simulate with some randomness)
                let mut rng = thread_rng();
                let change = rng.gen_range(-0.05..0.05);
                let new_corr = (old_corr + change).max(-1.0).min(1.0);
                
                correlations.insert(key, new_corr);
            }
        }
        
        Ok(())
    }
    
    /// Check if a similar signal was recently generated
    fn is_recent_signal(&self, asset: &str, signal_type: SignalType) -> Result<bool> {
        let recent_signals = self.recent_signals.read().unwrap();
        let now = Utc::now();
        
        // Check for similar signals in the last hour
        for record in recent_signals.iter() {
            if record.asset == asset && 
               record.signal_type == signal_type && 
               now - record.timestamp < Duration::hours(1) {
                return Ok(true);
            }
        }
        
        Ok(false)
    }
    
    /// Record a signal to prevent duplicates
    fn record_signal(&self, asset: &str, signal_type: SignalType) -> Result<()> {
        let mut recent_signals = self.recent_signals.write().unwrap();
        
        // Add new signal record
        recent_signals.push_back(SignalRecord {
            asset: asset.to_string(),
            signal_type,
            timestamp: Utc::now(),
        });
        
        // Limit size of recent signals
        while recent_signals.len() > 100 {
            recent_signals.pop_front();
        }
        
        Ok(())
    }
}