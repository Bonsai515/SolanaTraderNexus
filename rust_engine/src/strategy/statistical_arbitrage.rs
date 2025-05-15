use rayon::prelude::*;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use crate::transaction::{Transaction, TransactionEngine, TransactionResult};
use crate::strategy::Strategy;
use log::info;

/// Statistical Arbitrage Strategy
///
/// This strategy identifies short-term pricing inefficiencies across pairs and
/// executes trades with sub-second timing while maintaining delta-neutral positions.
pub struct StatisticalArbitrageStrategy {
    // Transaction engine for executing trades
    transaction_engine: Arc<Mutex<TransactionEngine>>,
    
    // Minimum profit threshold in basis points (1 bp = 0.01%)
    min_profit_bps: i32,
    
    // Maximum position size in USD
    max_position_size: f64,
    
    // Pairs to monitor
    pairs: Vec<(String, String)>,
    
    // Exchanges to monitor
    exchanges: Vec<String>,
    
    // Historical price data for computing statistical relationships
    price_history: HashMap<String, Vec<f64>>,
    
    // Current positions for delta-neutral management
    positions: HashMap<String, f64>,
    
    // Statistical model parameters
    z_score_threshold: f64,
    mean_reversion_strength: f64,
    volatility_scaling: bool,
    
    // Trading timing optimization
    execution_timing_ms: i32,
}

/// Statistical model parameters for pair trading
struct PairStats {
    // Mean price ratio between two assets
    mean_ratio: f64,
    
    // Standard deviation of price ratio
    std_dev_ratio: f64,
    
    // Current z-score (how many standard deviations from mean)
    current_z_score: f64,
    
    // Half-life of mean reversion in minutes
    mean_reversion_half_life: f64,
    
    // Correlation coefficient between assets
    correlation: f64,
}

impl StatisticalArbitrageStrategy {
    /// Create a new statistical arbitrage strategy
    pub fn new(
        transaction_engine: Arc<Mutex<TransactionEngine>>,
        min_profit_bps: i32,
        max_position_size: f64,
        pairs: Vec<(String, String)>,
        exchanges: Vec<String>
    ) -> Self {
        StatisticalArbitrageStrategy {
            transaction_engine,
            min_profit_bps,
            max_position_size,
            pairs,
            exchanges,
            price_history: HashMap::new(),
            positions: HashMap::new(),
            z_score_threshold: 2.0,
            mean_reversion_strength: 0.5,
            volatility_scaling: true,
            execution_timing_ms: 250,
        }
    }
    
    /// Update price history with new data
    pub fn update_price_history(&mut self, symbol: &str, price: f64) {
        let prices = self.price_history.entry(symbol.to_string()).or_insert_with(Vec::new);
        prices.push(price);
        
        // Keep only last 1000 prices (rolling window)
        if prices.len() > 1000 {
            *prices = prices.iter().skip(prices.len() - 1000).cloned().collect();
        }
    }
    
    /// Calculate statistical properties for a pair
    fn calculate_pair_stats(&self, base: &str, quote: &str) -> Option<PairStats> {
        let base_prices = self.price_history.get(base)?;
        let quote_prices = self.price_history.get(quote)?;
        
        // Ensure we have enough data points and equal length
        if base_prices.len() < 30 || base_prices.len() != quote_prices.len() {
            return None;
        }
        
        // Calculate price ratios
        let ratios: Vec<f64> = base_prices.iter()
            .zip(quote_prices.iter())
            .map(|(&b, &q)| b / q)
            .collect();
        
        // Calculate mean ratio
        let mean_ratio = ratios.par_iter().sum::<f64>() / ratios.len() as f64;
        
        // Calculate standard deviation
        let variance = ratios.par_iter()
            .map(|&x| (x - mean_ratio).powi(2))
            .sum::<f64>() / ratios.len() as f64;
        let std_dev_ratio = variance.sqrt();
        
        // Calculate current z-score
        let current_ratio = base_prices.last()? / quote_prices.last()?;
        let current_z_score = (current_ratio - mean_ratio) / std_dev_ratio;
        
        // Calculate correlation
        let correlation = self.calculate_correlation(base_prices, quote_prices);
        
        // Estimate mean reversion half-life
        let mean_reversion_half_life = self.estimate_mean_reversion_half_life(&ratios);
        
        Some(PairStats {
            mean_ratio,
            std_dev_ratio,
            current_z_score,
            mean_reversion_half_life,
            correlation,
        })
    }
    
    /// Calculate correlation between two price series
    fn calculate_correlation(&self, series_a: &[f64], series_b: &[f64]) -> f64 {
        if series_a.len() < 2 || series_a.len() != series_b.len() {
            return 0.0;
        }
        
        let mean_a = series_a.par_iter().sum::<f64>() / series_a.len() as f64;
        let mean_b = series_b.par_iter().sum::<f64>() / series_b.len() as f64;
        
        let mut numerator = 0.0;
        let mut denom_a = 0.0;
        let mut denom_b = 0.0;
        
        for i in 0..series_a.len() {
            let diff_a = series_a[i] - mean_a;
            let diff_b = series_b[i] - mean_b;
            
            numerator += diff_a * diff_b;
            denom_a += diff_a * diff_a;
            denom_b += diff_b * diff_b;
        }
        
        if denom_a == 0.0 || denom_b == 0.0 {
            return 0.0;
        }
        
        numerator / (denom_a.sqrt() * denom_b.sqrt())
    }
    
    /// Estimate mean reversion half-life using AR(1) model
    fn estimate_mean_reversion_half_life(&self, series: &[f64]) -> f64 {
        if series.len() < 30 {
            return 60.0; // Default to 60 minutes
        }
        
        // Calculate lag-1 correlation (AR1 coefficient)
        let mut x = Vec::with_capacity(series.len() - 1);
        let mut y = Vec::with_capacity(series.len() - 1);
        
        let mean = series.par_iter().sum::<f64>() / series.len() as f64;
        let centered: Vec<f64> = series.iter().map(|&v| v - mean).collect();
        
        for i in 0..(series.len() - 1) {
            x.push(centered[i]);
            y.push(centered[i + 1]);
        }
        
        let ar1_coef = self.calculate_correlation(&x, &y);
        
        // Calculate half-life = -ln(2) / ln(ar1_coef)
        if ar1_coef >= 1.0 || ar1_coef <= 0.0 {
            return 60.0; // Default to 60 minutes
        }
        
        -(0.693) / ar1_coef.ln()
    }
    
    /// Find arbitrage opportunities across all monitored pairs
    fn find_arbitrage_opportunities(&self) -> Vec<ArbitrageOpportunity> {
        let mut opportunities = Vec::new();
        
        for (base, quote) in &self.pairs {
            // Skip if we don't have enough price history
            if !self.price_history.contains_key(base) || !self.price_history.contains_key(quote) {
                continue;
            }
            
            // Calculate statistical properties
            if let Some(stats) = self.calculate_pair_stats(base, quote) {
                // Check if z-score exceeds threshold
                if stats.current_z_score.abs() > self.z_score_threshold {
                    // Calculate trade size based on z-score and mean reversion strength
                    let confidence = (stats.current_z_score.abs() - self.z_score_threshold) / 2.0;
                    let trade_size = self.max_position_size * confidence.min(1.0);
                    
                    // Adjust size based on volatility if enabled
                    let adjusted_size = if self.volatility_scaling {
                        trade_size * (0.2 / stats.std_dev_ratio).min(1.0)
                    } else {
                        trade_size
                    };
                    
                    // Direction depends on z-score sign
                    let (buy_symbol, sell_symbol) = if stats.current_z_score > 0.0 {
                        (quote, base) // Base is overvalued, buy quote and sell base
                    } else {
                        (base, quote) // Base is undervalued, buy base and sell quote
                    };
                    
                    opportunities.push(ArbitrageOpportunity {
                        pair: format!("{}/{}", base, quote),
                        z_score: stats.current_z_score,
                        mean_reversion_half_life: stats.mean_reversion_half_life,
                        expected_profit_bps: (stats.current_z_score.abs() * 10.0) as i32,
                        buy_symbol: buy_symbol.clone(),
                        sell_symbol: sell_symbol.clone(),
                        trade_size: adjusted_size,
                        confidence: confidence.min(1.0),
                    });
                }
            }
        }
        
        // Sort by expected profit
        opportunities.sort_by(|a, b| b.expected_profit_bps.cmp(&a.expected_profit_bps));
        
        opportunities
    }
    
    /// Execute a statistical arbitrage trade
    async fn execute_arbitrage_trade(&self, opportunity: &ArbitrageOpportunity) -> Result<Vec<String>, String> {
        info!(
            "Executing statistical arbitrage trade: {} with z-score {:.2}, expected profit {} bps",
            opportunity.pair, opportunity.z_score, opportunity.expected_profit_bps
        );
        
        let mut transaction_engine = self.transaction_engine.lock().await;
        
        // Create two transactions:
        // 1. Buy the undervalued asset
        let buy_tx = Transaction {
            from_token: "USDC".to_string(),
            to_token: opportunity.buy_symbol.clone(),
            amount: opportunity.trade_size / 2.0,
            slippage_bps: 50,
            dex: self.exchanges[0].clone(),
        };
        
        // 2. Sell the overvalued asset
        let sell_tx = Transaction {
            from_token: "USDC".to_string(),
            to_token: opportunity.sell_symbol.clone(),
            amount: opportunity.trade_size / 2.0,
            slippage_bps: 50,
            dex: self.exchanges[0].clone(),
        };
        
        // Execute transactions
        let buy_result = transaction_engine.execute_transaction(&buy_tx).await;
        let sell_result = transaction_engine.execute_transaction(&sell_tx).await;
        
        // Collect transaction signatures
        let mut signatures = Vec::new();
        
        match buy_result {
            Ok(result) => signatures.push(result.signature),
            Err(e) => return Err(format!("Failed to execute buy transaction: {}", e)),
        }
        
        match sell_result {
            Ok(result) => signatures.push(result.signature),
            Err(e) => return Err(format!("Failed to execute sell transaction: {}", e)),
        }
        
        Ok(signatures)
    }
}

/// An arbitrage opportunity between two assets
pub struct ArbitrageOpportunity {
    // Trading pair
    pair: String,
    
    // Current z-score (statistical deviation from mean)
    z_score: f64,
    
    // Estimated half-life of mean reversion in minutes
    mean_reversion_half_life: f64,
    
    // Expected profit in basis points
    expected_profit_bps: i32,
    
    // Symbol to buy
    buy_symbol: String,
    
    // Symbol to sell
    sell_symbol: String,
    
    // Size of trade in USD
    trade_size: f64,
    
    // Confidence in trade (0.0-1.0)
    confidence: f64,
}

impl Strategy for StatisticalArbitrageStrategy {
    fn name(&self) -> &str {
        "StatisticalArbitrage"
    }
    
    fn description(&self) -> &str {
        "Statistical arbitrage strategy that identifies short-term pricing inefficiencies and maintains delta-neutral positions"
    }
    
    fn execute(&self) -> Result<Vec<String>, String> {
        // This is a synchronous interface, but we need async
        // In a real implementation, use a proper runtime
        let rt = tokio::runtime::Runtime::new().unwrap();
        
        rt.block_on(async {
            // Find arbitrage opportunities
            let opportunities = self.find_arbitrage_opportunities();
            
            if opportunities.is_empty() {
                return Ok(Vec::new());
            }
            
            // Take the best opportunity
            let best_opportunity = &opportunities[0];
            
            // Check if opportunity meets profit threshold
            if best_opportunity.expected_profit_bps < self.min_profit_bps {
                return Ok(Vec::new());
            }
            
            // Execute trade for best opportunity
            self.execute_arbitrage_trade(best_opportunity).await
        })
    }
}