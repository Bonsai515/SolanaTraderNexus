// Common data models for the Solana Trading Platform

use uuid::Uuid;
use chrono::{DateTime, Utc};
use serde::{Serialize, Deserialize};

/// Types of trading strategies
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
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
            StrategyType::MarketMaking => write!(f, "Market Making"),
            StrategyType::Arbitrage => write!(f, "Arbitrage"),
            StrategyType::Momentum => write!(f, "Momentum"),
            StrategyType::RangeTrading => write!(f, "Range Trading"),
            StrategyType::LiquidityProviding => write!(f, "Liquidity Providing"),
        }
    }
}

/// Trading strategy configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Strategy {
    /// Unique strategy ID
    pub id: Uuid,
    
    /// Strategy name
    pub name: String,
    
    /// Strategy description
    pub description: Option<String>,
    
    /// Strategy type
    pub strategy_type: StrategyType,
    
    /// Trading pair/market (e.g., "SOL/USDC")
    pub pair: String,
    
    /// Whether the strategy is currently active
    pub active: bool,
    
    /// Strategy-specific parameters
    pub parameters: serde_json::Value,
    
    /// Wallet ID to use for trading
    pub wallet_id: Option<Uuid>,
    
    /// Created at timestamp
    pub created_at: DateTime<Utc>,
    
    /// Updated at timestamp
    pub updated_at: DateTime<Utc>,
}

/// Transaction types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TransactionType {
    /// Buy order
    Buy,
    
    /// Sell order
    Sell,
    
    /// Token swap
    Swap,
    
    /// Add liquidity to a pool
    AddLiquidity,
    
    /// Remove liquidity from a pool
    RemoveLiquidity,
    
    /// Stake tokens
    Stake,
    
    /// Unstake tokens
    Unstake,
}

/// Transaction status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TransactionStatus {
    /// Transaction is pending to be sent
    Pending,
    
    /// Transaction has been sent but not confirmed
    Sent,
    
    /// Transaction has been confirmed on-chain
    Confirmed,
    
    /// Transaction failed
    Failed,
    
    /// Transaction was cancelled
    Cancelled,
}

/// Transaction record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Transaction {
    /// Unique transaction ID
    pub id: Uuid,
    
    /// Solana transaction signature
    pub signature: Option<String>,
    
    /// Transaction type
    pub transaction_type: TransactionType,
    
    /// Transaction status
    pub status: TransactionStatus,
    
    /// Amount involved
    pub amount: f64,
    
    /// Transaction fee
    pub fee: Option<f64>,
    
    /// Wallet ID used for the transaction
    pub wallet_id: Uuid,
    
    /// Trading pair/market (e.g., "SOL/USDC")
    pub pair: String,
    
    /// Signal ID that triggered this transaction (if any)
    pub signal_id: Option<Uuid>,
    
    /// Strategy ID that generated this transaction (if any)
    pub strategy_id: Option<Uuid>,
    
    /// Execution price
    pub price: Option<f64>,
    
    /// Additional metadata
    pub metadata: serde_json::Value,
    
    /// Created at timestamp
    pub created_at: DateTime<Utc>,
    
    /// Confirmed at timestamp
    pub confirmed_at: Option<DateTime<Utc>>,
}

/// Signal types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SignalType {
    /// Buy signal
    Buy,
    
    /// Sell signal
    Sell,
    
    /// Hold signal
    Hold,
}

/// Signal strength/confidence level
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SignalStrength {
    /// Weak signal
    Weak,
    
    /// Moderate signal
    Moderate,
    
    /// Strong signal
    Strong,
}

/// Risk level for strategies
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum RiskLevel {
    /// Low risk
    Low,
    
    /// Medium risk
    Medium,
    
    /// High risk
    High,
}

/// Trading signal
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TradingSignal {
    /// Unique signal ID
    pub id: Uuid,
    
    /// Trading pair/market (e.g., "SOL/USDC")
    pub pair: String,
    
    /// Signal type
    pub signal_type: SignalType,
    
    /// Signal strength
    pub strength: SignalStrength,
    
    /// Price at signal generation
    pub price: f64,
    
    /// Strategy ID that generated this signal
    pub strategy_id: Option<Uuid>,
    
    /// Additional metadata
    pub metadata: serde_json::Value,
    
    /// Created at timestamp
    pub created_at: DateTime<Utc>,
    
    /// Expiration timestamp
    pub expires_at: Option<DateTime<Utc>>,
}