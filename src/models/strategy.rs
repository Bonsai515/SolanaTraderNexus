// Strategy model

use serde::{Serialize, Deserialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};
use std::collections::HashMap;

/// Strategy type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum StrategyType {
    /// Market making strategy
    MarketMaking,
    
    /// Arbitrage strategy
    Arbitrage,
    
    /// Momentum trading strategy
    Momentum,
    
    /// Range trading strategy
    RangeTrading,
    
    /// Liquidity providing strategy
    LiquidityProviding,
}

impl std::fmt::Display for StrategyType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            StrategyType::MarketMaking => write!(f, "MARKET_MAKING"),
            StrategyType::Arbitrage => write!(f, "ARBITRAGE"),
            StrategyType::Momentum => write!(f, "MOMENTUM"),
            StrategyType::RangeTrading => write!(f, "RANGE_TRADING"),
            StrategyType::LiquidityProviding => write!(f, "LIQUIDITY_PROVIDING"),
        }
    }
}

/// Strategy status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum StrategyStatus {
    /// Strategy is active
    Active,
    
    /// Strategy is paused
    Paused,
    
    /// Strategy is stopped
    Stopped,
    
    /// Strategy is in testing mode
    Testing,
    
    /// Strategy failed
    Failed,
}

impl std::fmt::Display for StrategyStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            StrategyStatus::Active => write!(f, "ACTIVE"),
            StrategyStatus::Paused => write!(f, "PAUSED"),
            StrategyStatus::Stopped => write!(f, "STOPPED"),
            StrategyStatus::Testing => write!(f, "TESTING"),
            StrategyStatus::Failed => write!(f, "FAILED"),
        }
    }
}

/// Trading strategy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Strategy {
    /// Unique identifier
    pub id: String,
    
    /// Strategy name
    pub name: String,
    
    /// Strategy description
    pub description: Option<String>,
    
    /// Strategy type
    pub strategy_type: StrategyType,
    
    /// Strategy status
    pub status: StrategyStatus,
    
    /// Target token pair (e.g., "SOL/USDC")
    pub token_pair: String,
    
    /// Strategy parameters
    pub parameters: HashMap<String, serde_json::Value>,
    
    /// Wallet ID used for this strategy
    pub wallet_id: String,
    
    /// Position size limit (in quote currency)
    pub position_size_limit: f64,
    
    /// Maximum allowed slippage (percentage)
    pub max_slippage: f64,
    
    /// Daily profit target (percentage)
    pub daily_profit_target: Option<f64>,
    
    /// Stop loss level (percentage)
    pub stop_loss: Option<f64>,
    
    /// Maximum allowed daily loss (percentage)
    pub max_daily_loss: Option<f64>,
    
    /// Strategy performance metrics
    pub performance: StrategyPerformance,
    
    /// Auto-rebalance settings
    pub auto_rebalance: bool,
    
    /// Creation timestamp
    pub created_at: DateTime<Utc>,
    
    /// Last update timestamp
    pub updated_at: DateTime<Utc>,
}

/// Strategy performance metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StrategyPerformance {
    /// Total profit/loss (in quote currency)
    pub total_pnl: f64,
    
    /// 24h profit/loss (in quote currency)
    pub pnl_24h: f64,
    
    /// Profit/loss percentage
    pub pnl_percentage: f64,
    
    /// Number of executed trades
    pub trade_count: u32,
    
    /// Win rate (percentage)
    pub win_rate: f64,
    
    /// Average profit per winning trade
    pub avg_profit_per_win: f64,
    
    /// Average loss per losing trade
    pub avg_loss_per_loss: f64,
    
    /// Maximum drawdown (percentage)
    pub max_drawdown: f64,
    
    /// Current drawdown (percentage)
    pub current_drawdown: f64,
    
    /// Sharpe ratio
    pub sharpe_ratio: Option<f64>,
    
    /// Last update timestamp
    pub updated_at: DateTime<Utc>,
}

impl Strategy {
    /// Create a new strategy
    pub fn new(
        name: String,
        description: Option<String>,
        strategy_type: StrategyType,
        token_pair: String,
        wallet_id: String,
        position_size_limit: f64,
        max_slippage: f64,
    ) -> Self {
        let now = Utc::now();
        
        Self {
            id: Uuid::new_v4().to_string(),
            name,
            description,
            strategy_type,
            status: StrategyStatus::Stopped,
            token_pair,
            parameters: HashMap::new(),
            wallet_id,
            position_size_limit,
            max_slippage,
            daily_profit_target: None,
            stop_loss: None,
            max_daily_loss: None,
            performance: StrategyPerformance {
                total_pnl: 0.0,
                pnl_24h: 0.0,
                pnl_percentage: 0.0,
                trade_count: 0,
                win_rate: 0.0,
                avg_profit_per_win: 0.0,
                avg_loss_per_loss: 0.0,
                max_drawdown: 0.0,
                current_drawdown: 0.0,
                sharpe_ratio: None,
                updated_at: now,
            },
            auto_rebalance: false,
            created_at: now,
            updated_at: now,
        }
    }
    
    /// Set strategy parameter
    pub fn set_parameter<T: Serialize>(&mut self, key: &str, value: T) {
        if let Ok(json_value) = serde_json::to_value(value) {
            self.parameters.insert(key.to_string(), json_value);
            self.updated_at = Utc::now();
        }
    }
    
    /// Get strategy parameter
    pub fn get_parameter<T: for<'de> Deserialize<'de>>(&self, key: &str) -> Option<T> {
        self.parameters.get(key).and_then(|value| {
            serde_json::from_value(value.clone()).ok()
        })
    }
    
    /// Update strategy status
    pub fn update_status(&mut self, status: StrategyStatus) {
        self.status = status;
        self.updated_at = Utc::now();
    }
    
    /// Update strategy performance
    pub fn update_performance(&mut self, performance: StrategyPerformance) {
        self.performance = performance;
        self.updated_at = Utc::now();
    }
    
    /// Check if strategy is active
    pub fn is_active(&self) -> bool {
        self.status == StrategyStatus::Active
    }
}