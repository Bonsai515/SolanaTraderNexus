use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use uuid::Uuid;

/// User model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: Uuid,
    pub username: String,
    pub password_hash: String, // In a real app, password would be hashed
}

/// Wallet model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Wallet {
    pub id: Uuid,
    pub user_id: Uuid,
    pub address: String,
    pub balance: f64,
    pub wallet_type: WalletType,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum WalletType {
    #[serde(rename = "MAIN")]
    Main,
    #[serde(rename = "SECONDARY")]
    Secondary,
}

/// Transaction model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Transaction {
    pub id: Uuid,
    pub wallet_id: Uuid,
    pub strategy_id: Option<Uuid>,
    pub transaction_type: TransactionType,
    pub amount: f64,
    pub status: TransactionStatus,
    pub profit: Option<f64>,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TransactionType {
    #[serde(rename = "BUY")]
    Buy,
    #[serde(rename = "SELL")]
    Sell,
    #[serde(rename = "DEPOSIT")]
    Deposit,
    #[serde(rename = "WITHDRAW")]
    Withdraw,
    #[serde(rename = "TRANSFER")]
    Transfer,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TransactionStatus {
    #[serde(rename = "PENDING")]
    Pending,
    #[serde(rename = "PROCESSING")]
    Processing,
    #[serde(rename = "COMPLETED")]
    Completed,
    #[serde(rename = "FAILED")]
    Failed,
}

/// Strategy model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Strategy {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub strategy_type: StrategyType,
    pub performance: f64,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum StrategyType {
    #[serde(rename = "ARBITRAGE")]
    Arbitrage,
    #[serde(rename = "MOMENTUM")]
    Momentum,
    #[serde(rename = "LIQUIDITY")]
    Liquidity,
}

/// Market data models for transformers
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenPrice {
    pub symbol: String,
    pub price: f64,
    pub volume_24h: f64,
    pub change_24h: f64,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketData {
    pub tokens: Vec<TokenPrice>,
    pub timestamp: DateTime<Utc>,
}

/// Trading signal model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TradingSignal {
    pub asset: String,
    pub signal_type: SignalType,
    pub price: f64,
    pub confidence: f64, // 0-1 scale
    pub reason: String,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SignalType {
    #[serde(rename = "BUY")]
    Buy,
    #[serde(rename = "SELL")]
    Sell,
}

/// Risk level for trading agent
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum RiskLevel {
    #[serde(rename = "low")]
    Low,
    #[serde(rename = "medium")]
    Medium,
    #[serde(rename = "high")]
    High,
}

/// System component status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ComponentStatus {
    #[serde(rename = "Active")]
    Active,
    #[serde(rename = "Ready")]
    Ready,
    #[serde(rename = "Scanning")]
    Scanning,
    #[serde(rename = "Secured")]
    Secured,
    #[serde(rename = "Offline")]
    Offline,
}

/// System component model for frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemComponent {
    pub name: String,
    pub description: String,
    pub icon: String,
    pub icon_color: String,
    pub status: ComponentStatus,
}

/// Formatted transaction for frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FormattedTransaction {
    pub id: String,
    pub strategy: StrategyInfo,
    pub transaction_type: TransactionType,
    pub amount: String,
    pub status: TransactionStatus,
    pub profit: Option<String>,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StrategyInfo {
    pub name: String,
    pub icon: String,
    pub color: String,
}

/// Formatted strategy for frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FormattedStrategy {
    pub id: String,
    pub name: String,
    pub description: String,
    pub icon: String,
    pub icon_color: String,
    pub performance: PerformanceInfo,
    pub is_active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceInfo {
    pub value: String,
    pub is_positive: bool,
}

/// System status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemStatus {
    pub blockchain: bool,
    pub transaction_engine: bool,
    pub ai_agents: bool,
    pub last_updated: DateTime<Utc>,
}

/// WebSocket message types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum WebSocketMessage {
    #[serde(rename = "status")]
    Status {
        components: SystemComponentStatus,
    },
    #[serde(rename = "transaction")]
    Transaction {
        id: String,
        timestamp: DateTime<Utc>,
    },
    #[serde(rename = "transaction_completed")]
    TransactionCompleted {
        transaction: FormattedTransaction,
    },
    #[serde(rename = "ping")]
    Ping,
    #[serde(rename = "pong")]
    Pong {
        timestamp: DateTime<Utc>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemComponentStatus {
    pub blockchain: bool,
    pub transaction_engine: bool,
    pub ai_agents: bool,
}