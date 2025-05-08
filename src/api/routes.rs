use actix_web::{web, Responder, HttpResponse, Error, HttpRequest, get, post, put, delete};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::Utc;
use std::sync::Arc;
use log::{info, error};

use crate::communication::WebSocketManager;
use crate::security::SecurityProtocol;
use crate::engine::TransactionEngine;

use crate::models::{RiskLevel, StrategyType, SystemComponent, ComponentStatus};
use crate::storage::Storage;
use crate::solana::{WalletManager, TransactionManager};
use crate::agents::{TradingAgent, StrategyManager};
use crate::transformers::{MarketDataTransformer, TradingSignalTransformer};

/// System Status Response
#[derive(Serialize)]
struct SystemStatusResponse {
    blockchain: bool,
    transaction_engine: bool,
    ai_agents: bool,
    #[serde(with = "chrono::serde::ts_seconds")]
    last_updated: chrono::DateTime<Utc>,
}

/// Get system status
#[get("/api/system/status")]
async fn get_system_status() -> impl Responder {
    let status = SystemStatusResponse {
        blockchain: true, // In a real app, would check actual connection status
        transaction_engine: true,
        ai_agents: true,
        last_updated: Utc::now(),
    };
    
    HttpResponse::Ok().json(status)
}

/// Transformer Status Response
#[derive(Serialize)]
struct TransformerResponse {
    name: String,
    description: String,
    quantum_enabled: bool,
    update_frequency: u64,
}

/// Get transformer status
#[get("/api/transformers")]
async fn get_transformers(
    market_data_transformer: web::Data<Arc<MarketDataTransformer>>,
    trading_signal_transformer: web::Data<Arc<TradingSignalTransformer>>,
) -> impl Responder {
    let transformers = vec![
        TransformerResponse {
            name: "Market Data Transformer".to_string(),
            description: "Processes market data from various sources".to_string(),
            quantum_enabled: true, // Would get actual status in production
            update_frequency: 10000,
        },
        TransformerResponse {
            name: "Trading Signal Transformer".to_string(),
            description: "Generates trading signals from market data".to_string(),
            quantum_enabled: true,
            update_frequency: 10000,
        },
    ];
    
    HttpResponse::Ok().json(web::Json(transformers))
}

/// AI Components Response
#[derive(Serialize)]
struct AIComponentsResponse {
    components: Vec<SystemComponent>,
}

/// Get AI system components
#[get("/api/ai/components")]
async fn get_ai_components() -> impl Responder {
    let components = vec![
        SystemComponent {
            name: "Transformer Engine".to_string(),
            description: "Processes market data and generates signals".to_string(),
            icon: "memory".to_string(),
            icon_color: "info".to_string(),
            status: ComponentStatus::Active,
        },
        SystemComponent {
            name: "Neural Interface".to_string(),
            description: "Advanced pattern recognition system".to_string(),
            icon: "psychology".to_string(),
            icon_color: "warning".to_string(),
            status: ComponentStatus::Ready,
        },
        SystemComponent {
            name: "Quantum Processor".to_string(),
            description: "Quantum-inspired computational core".to_string(),
            icon: "blur_circular".to_string(),
            icon_color: "primary".to_string(),
            status: ComponentStatus::Active,
        },
        SystemComponent {
            name: "Security Protocol".to_string(),
            description: "Cryptographic security layer".to_string(),
            icon: "shield".to_string(),
            icon_color: "success".to_string(),
            status: ComponentStatus::Secured,
        },
    ];
    
    HttpResponse::Ok().json(AIComponentsResponse { components })
}

/// Wallet Request
#[derive(Deserialize)]
struct WalletRequest {
    user_id: String,
}

/// Create a new wallet
#[post("/api/wallet")]
async fn create_wallet(
    wallet_manager: web::Data<Arc<WalletManager>>,
    req: web::Json<WalletRequest>,
) -> Result<impl Responder, Error> {
    let user_id = Uuid::parse_str(&req.user_id)
        .map_err(|e| {
            error!("Invalid user ID: {}", e);
            actix_web::error::ErrorBadRequest("Invalid user ID")
        })?;
        
    match wallet_manager.create_wallet(user_id).await {
        Ok(wallet) => Ok(HttpResponse::Created().json(wallet)),
        Err(e) => {
            error!("Failed to create wallet: {}", e);
            Err(actix_web::error::ErrorInternalServerError("Failed to create wallet"))
        }
    }
}

/// Get wallet information
#[get("/api/wallet")]
async fn get_wallet(
    wallet_manager: web::Data<Arc<WalletManager>>,
    storage: web::Data<Arc<Storage>>,
) -> Result<impl Responder, Error> {
    // In a real app, would get user ID from session
    let user_id = Uuid::parse_str("00000000-0000-0000-0000-000000000001").unwrap();
    
    let wallets = storage.get_strategies_by_user_id(user_id).await
        .map_err(|e| {
            error!("Failed to get wallets: {}", e);
            actix_web::error::ErrorInternalServerError("Failed to get wallets")
        })?;
        
    if let Some(first_wallet) = wallets.first() {
        match wallet_manager.get_wallet(first_wallet.id).await {
            Ok(wallet) => Ok(HttpResponse::Ok().json(wallet)),
            Err(e) => {
                error!("Failed to get wallet: {}", e);
                Err(actix_web::error::ErrorInternalServerError("Failed to get wallet"))
            }
        }
    } else {
        // Return demo wallet
        Ok(HttpResponse::Ok().json(serde_json::json!({
            "address": "3X4F9H29vQKjyKwARXd7yQyu53PJ8qiLQhH5D1yY8F6F9H2",
            "balance": 354.72,
            "allocations": [
                {"name": "SOL", "percentage": 65, "color": "info"},
                {"name": "USDC", "percentage": 20, "color": "success"},
                {"name": "Other", "percentage": 15, "color": "warning"}
            ]
        })))
    }
}

/// Strategy Request
#[derive(Deserialize)]
struct StrategyRequest {
    user_id: String,
    strategy_type: String,
}

/// Create a new strategy
#[post("/api/strategies")]
async fn create_strategy(
    strategy_manager: web::Data<Arc<StrategyManager>>,
    req: web::Json<StrategyRequest>,
) -> Result<impl Responder, Error> {
    let user_id = Uuid::parse_str(&req.user_id)
        .map_err(|e| {
            error!("Invalid user ID: {}", e);
            actix_web::error::ErrorBadRequest("Invalid user ID")
        })?;
        
    let strategy_type = match req.strategy_type.as_str() {
        "ARBITRAGE" => StrategyType::Arbitrage,
        "MOMENTUM" => StrategyType::Momentum,
        "LIQUIDITY" => StrategyType::Liquidity,
        _ => {
            error!("Invalid strategy type: {}", req.strategy_type);
            return Err(actix_web::error::ErrorBadRequest("Invalid strategy type"));
        }
    };
    
    match strategy_manager.create_strategy(user_id, strategy_type).await {
        Ok(strategy) => Ok(HttpResponse::Created().json(strategy)),
        Err(e) => {
            error!("Failed to create strategy: {}", e);
            Err(actix_web::error::ErrorInternalServerError("Failed to create strategy"))
        }
    }
}

/// Get all strategies
#[get("/api/strategies")]
async fn get_strategies(
    strategy_manager: web::Data<Arc<StrategyManager>>,
    storage: web::Data<Arc<Storage>>,
) -> Result<impl Responder, Error> {
    // In a real app, would get user ID from session
    let user_id = Uuid::parse_str("00000000-0000-0000-0000-000000000001").unwrap();
    
    match strategy_manager.get_strategies_for_user(user_id).await {
        Ok(strategies) => {
            let formatted = strategy_manager.format_strategies(strategies);
            Ok(HttpResponse::Ok().json(web::Json(formatted)))
        },
        Err(e) => {
            error!("Failed to get strategies: {}", e);
            Err(actix_web::error::ErrorInternalServerError("Failed to get strategies"))
        }
    }
}

/// Toggle Strategy Request
#[derive(Deserialize)]
struct ToggleStrategyRequest {
    id: String,
}

/// Toggle strategy status
#[put("/api/strategies/toggle")]
async fn toggle_strategy(
    strategy_manager: web::Data<Arc<StrategyManager>>,
    req: web::Json<ToggleStrategyRequest>,
) -> Result<impl Responder, Error> {
    let strategy_id = Uuid::parse_str(&req.id)
        .map_err(|e| {
            error!("Invalid strategy ID: {}", e);
            actix_web::error::ErrorBadRequest("Invalid strategy ID")
        })?;
        
    match strategy_manager.toggle_strategy(strategy_id).await {
        Ok(strategy) => Ok(HttpResponse::Ok().json(strategy)),
        Err(e) => {
            error!("Failed to toggle strategy: {}", e);
            Err(actix_web::error::ErrorInternalServerError("Failed to toggle strategy"))
        }
    }
}

/// Transaction Request
#[derive(Deserialize)]
struct TransactionRequest {
    wallet_id: String,
    strategy_id: Option<String>,
    transaction_type: String,
    amount: f64,
}

/// Execute a transaction
#[post("/api/transactions")]
async fn execute_transaction(
    transaction_manager: web::Data<Arc<TransactionManager>>,
    req: web::Json<TransactionRequest>,
) -> Result<impl Responder, Error> {
    let wallet_id = Uuid::parse_str(&req.wallet_id)
        .map_err(|e| {
            error!("Invalid wallet ID: {}", e);
            actix_web::error::ErrorBadRequest("Invalid wallet ID")
        })?;
        
    let strategy_id = if let Some(sid) = &req.strategy_id {
        Some(Uuid::parse_str(sid)
            .map_err(|e| {
                error!("Invalid strategy ID: {}", e);
                actix_web::error::ErrorBadRequest("Invalid strategy ID")
            })?)
    } else {
        None
    };
    
    let transaction_type = match req.transaction_type.as_str() {
        "BUY" => crate::models::TransactionType::Buy,
        "SELL" => crate::models::TransactionType::Sell,
        "DEPOSIT" => crate::models::TransactionType::Deposit,
        "WITHDRAW" => crate::models::TransactionType::Withdraw,
        "TRANSFER" => crate::models::TransactionType::Transfer,
        _ => {
            error!("Invalid transaction type: {}", req.transaction_type);
            return Err(actix_web::error::ErrorBadRequest("Invalid transaction type"));
        }
    };
    
    match transaction_manager.execute_transaction(
        wallet_id,
        strategy_id,
        transaction_type,
        req.amount,
    ).await {
        Ok(transaction) => Ok(HttpResponse::Created().json(transaction)),
        Err(e) => {
            error!("Failed to execute transaction: {}", e);
            Err(actix_web::error::ErrorInternalServerError("Failed to execute transaction"))
        }
    }
}

/// Get recent transactions
#[get("/api/transactions/recent")]
async fn get_recent_transactions(
    transaction_manager: web::Data<Arc<TransactionManager>>,
) -> Result<impl Responder, Error> {
    match transaction_manager.get_recent_transactions(10).await {
        Ok(transactions) => {
            match transaction_manager.format_transactions(transactions).await {
                Ok(formatted) => Ok(HttpResponse::Ok().json(web::Json(formatted))),
                Err(e) => {
                    error!("Failed to format transactions: {}", e);
                    Err(actix_web::error::ErrorInternalServerError("Failed to format transactions"))
                }
            }
        },
        Err(e) => {
            error!("Failed to get recent transactions: {}", e);
            Err(actix_web::error::ErrorInternalServerError("Failed to get recent transactions"))
        }
    }
}

/// Get wallet transactions
#[get("/api/transactions/wallet")]
async fn get_wallet_transactions(
    transaction_manager: web::Data<Arc<TransactionManager>>,
    storage: web::Data<Arc<Storage>>,
) -> Result<impl Responder, Error> {
    // In a real app, would get wallet ID from session or query params
    // For now, use the first wallet we find
    let user_id = Uuid::parse_str("00000000-0000-0000-0000-000000000001").unwrap();
    
    let wallets = storage.get_strategies_by_user_id(user_id).await
        .map_err(|e| {
            error!("Failed to get wallets: {}", e);
            actix_web::error::ErrorInternalServerError("Failed to get wallets")
        })?;
        
    if let Some(first_wallet) = wallets.first() {
        match transaction_manager.get_transactions_by_wallet(first_wallet.id).await {
            Ok(transactions) => {
                match transaction_manager.format_transactions(transactions).await {
                    Ok(formatted) => Ok(HttpResponse::Ok().json(web::Json(formatted))),
                    Err(e) => {
                        error!("Failed to format transactions: {}", e);
                        Err(actix_web::error::ErrorInternalServerError("Failed to format transactions"))
                    }
                }
            },
            Err(e) => {
                error!("Failed to get wallet transactions: {}", e);
                Err(actix_web::error::ErrorInternalServerError("Failed to get wallet transactions"))
            }
        }
    } else {
        // Return empty list
        Ok(HttpResponse::Ok().json(web::Json(Vec::<serde_json::Value>::new())))
    }
}

/// Agent Settings Request
#[derive(Deserialize)]
struct AgentSettingsRequest {
    scan_interval: Option<u64>,
    risk_level: Option<String>,
    quantum_inspired: Option<bool>,
}

/// Update agent settings
#[put("/api/agent/settings")]
async fn update_agent_settings(
    trading_agent: web::Data<Arc<TradingAgent>>,
    market_data_transformer: web::Data<Arc<MarketDataTransformer>>,
    trading_signal_transformer: web::Data<Arc<TradingSignalTransformer>>,
    req: web::Json<AgentSettingsRequest>,
) -> Result<impl Responder, Error> {
    if let Some(scan_interval) = req.scan_interval {
        trading_agent.set_scan_interval(scan_interval)
            .map_err(|e| {
                error!("Failed to update scan interval: {}", e);
                actix_web::error::ErrorInternalServerError("Failed to update scan interval")
            })?;
    }
    
    if let Some(risk_level_str) = &req.risk_level {
        let risk_level = match risk_level_str.as_str() {
            "low" => RiskLevel::Low,
            "medium" => RiskLevel::Medium,
            "high" => RiskLevel::High,
            _ => {
                error!("Invalid risk level: {}", risk_level_str);
                return Err(actix_web::error::ErrorBadRequest("Invalid risk level"));
            }
        };
        
        trading_agent.set_risk_level(risk_level)
            .map_err(|e| {
                error!("Failed to update risk level: {}", e);
                actix_web::error::ErrorInternalServerError("Failed to update risk level")
            })?;
    }
    
    if let Some(quantum_inspired) = req.quantum_inspired {
        market_data_transformer.set_quantum_inspired(quantum_inspired);
        trading_signal_transformer.set_quantum_inspired(quantum_inspired);
    }
    
    // Get current status
    let status = trading_agent.get_status()
        .map_err(|e| {
            error!("Failed to get agent status: {}", e);
            actix_web::error::ErrorInternalServerError("Failed to get agent status")
        })?;
        
    Ok(HttpResponse::Ok().json(status))
}

/// Start the trading agent
#[post("/api/agent/start")]
async fn start_agent(
    trading_agent: web::Data<Arc<TradingAgent>>,
) -> Result<impl Responder, Error> {
    trading_agent.start()
        .map_err(|e| {
            error!("Failed to start agent: {}", e);
            actix_web::error::ErrorInternalServerError("Failed to start agent")
        })?;
        
    // Get current status
    let status = trading_agent.get_status()
        .map_err(|e| {
            error!("Failed to get agent status: {}", e);
            actix_web::error::ErrorInternalServerError("Failed to get agent status")
        })?;
        
    Ok(HttpResponse::Ok().json(status))
}

/// Stop the trading agent
#[post("/api/agent/stop")]
async fn stop_agent(
    trading_agent: web::Data<Arc<TradingAgent>>,
) -> Result<impl Responder, Error> {
    trading_agent.stop()
        .map_err(|e| {
            error!("Failed to stop agent: {}", e);
            actix_web::error::ErrorInternalServerError("Failed to stop agent")
        })?;
        
    // Get current status
    let status = trading_agent.get_status()
        .map_err(|e| {
            error!("Failed to get agent status: {}", e);
            actix_web::error::ErrorInternalServerError("Failed to get agent status")
        })?;
        
    Ok(HttpResponse::Ok().json(status))
}

/// WebSocket handler for real-time updates
#[get("/ws")]
async fn websocket_handler(
    req: HttpRequest,
    stream: web::Payload,
    websocket_manager: web::Data<Arc<WebSocketManager>>,
) -> Result<HttpResponse, Error> {
    websocket_manager.handle_connection(req, stream).await
}

/// Handler for requesting access to protected areas
#[post("/api/security/protected-area")]
async fn request_protected_area_access(
    security_protocol: web::Data<Arc<SecurityProtocol>>,
    req: web::Json<ProtectedAreaRequest>,
) -> Result<impl Responder, Error> {
    match security_protocol.check_protected_area_access(&req.area_name, &req.component_name) {
        Ok(has_access) => {
            if has_access {
                Ok(HttpResponse::Ok().json(serde_json::json!({
                    "status": "granted",
                    "area": req.area_name,
                    "component": req.component_name
                })))
            } else {
                Ok(HttpResponse::Forbidden().json(serde_json::json!({
                    "status": "denied",
                    "area": req.area_name,
                    "component": req.component_name,
                    "reason": "Unauthorized access attempt"
                })))
            }
        },
        Err(e) => {
            error!("Error checking protected area access: {}", e);
            Err(actix_web::error::ErrorInternalServerError("Error checking protected area access"))
        }
    }
}

/// Request for protected area access
#[derive(Deserialize)]
struct ProtectedAreaRequest {
    area_name: String,
    component_name: String,
}

/// Handler for engine performance metrics
#[get("/api/engine/metrics")]
async fn get_engine_metrics(
    transaction_engine: web::Data<Arc<TransactionEngine>>,
) -> Result<impl Responder, Error> {
    let metrics = transaction_engine.get_performance_metrics();
    Ok(HttpResponse::Ok().json(metrics))
}

/// Configure API routes
pub fn configure_routes(cfg: &mut web::ServiceConfig) {
    cfg.service(get_system_status)
        .service(get_transformers)
        .service(get_ai_components)
        .service(create_wallet)
        .service(get_wallet)
        .service(create_strategy)
        .service(get_strategies)
        .service(toggle_strategy)
        .service(execute_transaction)
        .service(get_recent_transactions)
        .service(get_wallet_transactions)
        .service(update_agent_settings)
        .service(start_agent)
        .service(stop_agent)
        .service(websocket_handler)
        .service(request_protected_area_access)
        .service(get_engine_metrics);
}