// Trading signal model

use serde::{Serialize, Deserialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};
use std::collections::HashMap;

/// Signal type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum SignalType {
    /// Buy signal
    Buy,
    
    /// Sell signal
    Sell,
    
    /// Hold signal
    Hold,
}

impl std::fmt::Display for SignalType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SignalType::Buy => write!(f, "BUY"),
            SignalType::Sell => write!(f, "SELL"),
            SignalType::Hold => write!(f, "HOLD"),
        }
    }
}

/// Signal strength
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum SignalStrength {
    /// Weak signal
    Weak,
    
    /// Moderate signal
    Moderate,
    
    /// Strong signal
    Strong,
}

impl std::fmt::Display for SignalStrength {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SignalStrength::Weak => write!(f, "WEAK"),
            SignalStrength::Moderate => write!(f, "MODERATE"),
            SignalStrength::Strong => write!(f, "STRONG"),
        }
    }
}

/// Trading signal
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TradingSignal {
    /// Unique identifier
    pub id: String,
    
    /// Strategy ID that generated this signal
    pub strategy_id: String,
    
    /// Signal type
    pub signal_type: SignalType,
    
    /// Signal strength
    pub strength: SignalStrength,
    
    /// Token pair (e.g., "SOL/USDC")
    pub token_pair: String,
    
    /// Current price when signal was generated
    pub price: f64,
    
    /// Target price (if applicable)
    pub target_price: Option<f64>,
    
    /// Stop loss price (if applicable)
    pub stop_loss_price: Option<f64>,
    
    /// Signal time window (in seconds)
    pub time_window_seconds: Option<u64>,
    
    /// Signal confidence score (0.0 - 1.0)
    pub confidence: f64,
    
    /// Signal metadata
    pub metadata: HashMap<String, serde_json::Value>,
    
    /// Signal source (e.g., "transformer", "momentum", "arbitrage")
    pub source: String,
    
    /// Whether this signal was executed
    pub executed: bool,
    
    /// Related transaction ID (if executed)
    pub transaction_id: Option<String>,
    
    /// Signal result (profit/loss if executed)
    pub result: Option<SignalResult>,
    
    /// Creation timestamp
    pub created_at: DateTime<Utc>,
    
    /// Expiration timestamp
    pub expires_at: Option<DateTime<Utc>>,
}

/// Signal result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignalResult {
    /// Whether the signal was profitable
    pub profitable: bool,
    
    /// Profit/loss amount
    pub pnl: f64,
    
    /// Profit/loss percentage
    pub pnl_percentage: f64,
    
    /// Execution price
    pub execution_price: f64,
    
    /// Exit price
    pub exit_price: Option<f64>,
    
    /// Time to execution (in seconds)
    pub time_to_execution_seconds: u64,
    
    /// Position holding time (in seconds)
    pub holding_time_seconds: Option<u64>,
}

impl TradingSignal {
    /// Create a new trading signal
    pub fn new(
        strategy_id: String,
        signal_type: SignalType,
        strength: SignalStrength,
        token_pair: String,
        price: f64,
        confidence: f64,
        source: String,
    ) -> Self {
        let now = Utc::now();
        
        Self {
            id: Uuid::new_v4().to_string(),
            strategy_id,
            signal_type,
            strength,
            token_pair,
            price,
            target_price: None,
            stop_loss_price: None,
            time_window_seconds: None,
            confidence,
            metadata: HashMap::new(),
            source,
            executed: false,
            transaction_id: None,
            result: None,
            created_at: now,
            expires_at: None,
        }
    }
    
    /// Set signal metadata
    pub fn set_metadata<T: Serialize>(&mut self, key: &str, value: T) {
        if let Ok(json_value) = serde_json::to_value(value) {
            self.metadata.insert(key.to_string(), json_value);
        }
    }
    
    /// Get signal metadata
    pub fn get_metadata<T: for<'de> Deserialize<'de>>(&self, key: &str) -> Option<T> {
        self.metadata.get(key).and_then(|value| {
            serde_json::from_value(value.clone()).ok()
        })
    }
    
    /// Mark signal as executed
    pub fn mark_executed(&mut self, transaction_id: String) {
        self.executed = true;
        self.transaction_id = Some(transaction_id);
    }
    
    /// Update signal result
    pub fn update_result(&mut self, result: SignalResult) {
        self.result = Some(result);
    }
    
    /// Check if signal is expired
    pub fn is_expired(&self) -> bool {
        if let Some(expires_at) = self.expires_at {
            Utc::now() > expires_at
        } else {
            false
        }
    }
    
    /// Set expiration time
    pub fn set_expiration(&mut self, seconds: u64) {
        self.expires_at = Some(Utc::now() + chrono::Duration::seconds(seconds as i64));
        self.time_window_seconds = Some(seconds);
    }
}