use serde::{Serialize, Deserialize};
use chrono::{DateTime, Utc};
use uuid::Uuid;
use std::collections::HashMap;
use serde_json::Value;

/// Transaction for the Solana blockchain
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Transaction {
    /// Unique ID of the transaction
    pub id: Uuid,
    
    /// Wallet ID associated with the transaction
    pub wallet_id: Uuid,
    
    /// Optional strategy ID that generated this transaction
    pub strategy_id: Option<Uuid>,
    
    /// Transaction signature from Solana
    pub signature: Option<String>,
    
    /// Type of transaction (Buy, Sell, etc.)
    pub transaction_type: TransactionType,
    
    /// Status of the transaction
    pub status: TransactionStatus,
    
    /// Amount involved in the transaction
    pub amount: f64,
    
    /// Transaction fee
    pub fee: Option<f64>,
    
    /// Transaction profit/loss
    pub profit: Option<f64>,
    
    /// Timestamp of the transaction
    pub timestamp: DateTime<Utc>,
    
    /// Additional transaction data
    pub additional_data: Option<HashMap<String, Value>>,
}

/// Type of transaction
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub enum TransactionType {
    Buy,
    Sell,
    Swap,
    Stake,
    Unstake,
    Transfer,
    Withdraw,
    Deposit,
}

/// Status of a transaction
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub enum TransactionStatus {
    Pending,
    Submitted,
    Confirmed,
    Completed,
    Failed,
    Cancelled,
}

/// Trading strategy
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Strategy {
    /// Unique ID of the strategy
    pub id: Uuid,
    
    /// Strategy name
    pub name: String,
    
    /// Strategy description
    pub description: String,
    
    /// Strategy type
    pub strategy_type: StrategyType,
    
    /// Risk level of the strategy
    pub risk_level: RiskLevel,
    
    /// Strategy enabled flag
    pub enabled: bool,
    
    /// Maximum amount per transaction
    pub max_transaction_amount: f64,
    
    /// Maximum allowed loss before stopping
    pub max_loss: f64,
    
    /// Creation timestamp
    pub created_at: DateTime<Utc>,
    
    /// Configuration parameters
    pub parameters: HashMap<String, Value>,
}

/// Strategy types
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub enum StrategyType {
    Arbitrage,
    Momentum,
    Liquidity,
}

/// Risk level for strategies
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
pub enum RiskLevel {
    Low,
    Medium,
    High,
}

/// Trading signal from a transformer or agent
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct TradingSignal {
    /// Asset symbol
    pub asset: String,
    
    /// Signal type (Buy/Sell)
    pub signal_type: SignalType,
    
    /// Current price of the asset
    pub price: f64,
    
    /// Confidence level (0.0 - 1.0)
    pub confidence: f64,
    
    /// Reason or explanation for the signal
    pub reason: String,
    
    /// Signal timestamp
    pub timestamp: DateTime<Utc>,
}

/// Signal type
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub enum SignalType {
    Buy,
    Sell,
}

/// Market data
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct MarketData {
    /// Timestamp of the data
    pub timestamp: DateTime<Utc>,
    
    /// Token price data
    pub tokens: Vec<TokenPrice>,
    
    /// Market metrics
    pub metrics: MarketMetrics,
}

/// Token price information
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct TokenPrice {
    /// Token symbol
    pub symbol: String,
    
    /// Token name
    pub name: String,
    
    /// Current price
    pub price: f64,
    
    /// 24h volume
    pub volume_24h: f64,
    
    /// 24h price change percentage
    pub change_24h: f64,
    
    /// Market cap
    pub market_cap: Option<f64>,
}

/// Market metrics
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct MarketMetrics {
    /// Total market capitalization
    pub total_market_cap: f64,
    
    /// Total 24h volume
    pub total_volume_24h: f64,
    
    /// Bitcoin dominance percentage
    pub btc_dominance: f64,
    
    /// Market trend
    pub trend: MarketTrend,
}

/// Market trend
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub enum MarketTrend {
    Bullish,
    Bearish,
    Neutral,
}

/// Wallet information
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Wallet {
    /// Unique ID of the wallet
    pub id: Uuid,
    
    /// Wallet name
    pub name: String,
    
    /// Wallet address
    pub address: String,
    
    /// Wallet balance
    pub balance: f64,
    
    /// Wallet creation timestamp
    pub created_at: DateTime<Utc>,
}

/// System component status
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SystemComponentStatus {
    /// Blockchain connection status
    pub blockchain: bool,
    
    /// Transaction engine status
    pub transaction_engine: bool,
    
    /// AI agent status
    pub ai_agents: bool,
}

/// WebSocket message for UI updates
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct WebSocketMessage {
    /// Message ID
    pub id: Uuid,
    
    /// Message type
    pub message_type: WebSocketMessageType,
    
    /// Timestamp
    pub timestamp: DateTime<Utc>,
    
    /// Message data
    pub data: Value,
}

/// WebSocket message type
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub enum WebSocketMessageType {
    TradingSignal,
    Transaction,
    MarketData,
    SystemStatus,
    SystemMessage,
}

/// System message
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SystemMessage {
    /// Message ID
    pub id: Uuid,
    
    /// Timestamp
    pub timestamp: DateTime<Utc>,
    
    /// Message priority
    pub priority: MessagePriority,
    
    /// Source component
    pub source: String,
    
    /// Message text
    pub message: String,
    
    /// Acknowledged flag
    pub acknowledged: bool,
}

/// Message priority
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
pub enum MessagePriority {
    Info,
    Warning,
    Error,
    Critical,
}