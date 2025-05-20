use crate::models::{
    TradingSignal, Transaction, MarketData, SystemComponentStatus, WebSocketMessage,
    SystemMessage, MessagePriority, WebSocketMessageType
};
use anyhow::Result;
use log::{info, warn, error, debug};
use std::sync::{Arc, RwLock, Mutex};
use std::collections::{VecDeque, HashMap, HashSet};
use tokio::sync::mpsc;
use tokio::task::JoinHandle;
use chrono::{DateTime, Utc, Duration};
use uuid::Uuid;
use serde_json::Value;

/// Communication Center
/// 
/// Central hub for system-wide communication between components.
/// Handles signal routing, message queuing, and system status monitoring.
pub struct CommunicationCenter {
    // Pending trading signals queue
    pending_signals: RwLock<VecDeque<TradingSignal>>,
    
    // Transaction log
    transaction_log: RwLock<VecDeque<TransactionLogEntry>>,
    
    // System messages
    system_messages: RwLock<VecDeque<SystemMessage>>,
    
    // Latest market data
    latest_market_data: RwLock<Option<MarketData>>,
    
    // System status
    system_status: RwLock<SystemComponentStatus>,
    
    // Active components registry
    active_components: RwLock<HashSet<String>>,
    
    // WebSocket channels for UI updates
    ws_channels: RwLock<Vec<mpsc::Sender<WebSocketMessage>>>,
    
    // Background tasks
    background_tasks: Mutex<Vec<JoinHandle<()>>>,
    
    // Last activity timestamp by component
    last_activity: RwLock<HashMap<String, DateTime<Utc>>>,
}

/// Entry in the transaction log
#[derive(Clone, Debug)]
struct TransactionLogEntry {
    timestamp: DateTime<Utc>,
    transaction: Transaction,
    signal: Option<TradingSignal>,
    notes: Option<String>,
}

impl CommunicationCenter {
    /// Create a new communication center
    pub fn new() -> Self {
        info!("Initializing Communication Center - System Messaging Hub");
        
        let system_status = SystemComponentStatus {
            blockchain: false,
            transaction_engine: false,
            ai_agents: false,
        };
        
        Self {
            pending_signals: RwLock::new(VecDeque::new()),
            transaction_log: RwLock::new(VecDeque::with_capacity(1000)),
            system_messages: RwLock::new(VecDeque::with_capacity(1000)),
            latest_market_data: RwLock::new(None),
            system_status: RwLock::new(system_status),
            active_components: RwLock::new(HashSet::new()),
            ws_channels: RwLock::new(Vec::new()),
            background_tasks: Mutex::new(Vec::new()),
            last_activity: RwLock::new(HashMap::new()),
        }
    }
    
    /// Start the communication center
    pub fn start(&self) -> Result<()> {
        info!("Starting Communication Center");
        
        // Start WebSocket message dispatcher
        let task = tokio::spawn(async move {
            // In the real implementation, this would continuously dispatch messages
            // to WebSocket clients for UI updates
            loop {
                tokio::time::sleep(tokio::time::Duration::from_secs(10)).await;
                // Handle dispatching...
            }
        });
        
        // Store task handle
        let mut tasks = self.background_tasks.lock().unwrap();
        tasks.push(task);
        
        Ok(())
    }
    
    /// Stop the communication center
    pub fn stop(&self) -> Result<()> {
        info!("Stopping Communication Center");
        
        // Abort all background tasks
        let mut tasks = self.background_tasks.lock().unwrap();
        for task in tasks.drain(..) {
            task.abort();
        }
        
        Ok(())
    }
    
    /// Register an active component
    pub fn register_active_component(&self, component_name: &str) -> Result<()> {
        let mut active_components = self.active_components.write().unwrap();
        active_components.insert(component_name.to_string());
        
        // Update last activity timestamp
        let mut last_activity = self.last_activity.write().unwrap();
        last_activity.insert(component_name.to_string(), Utc::now());
        
        info!("Component registered with Communication Center: {}", component_name);
        Ok(())
    }
    
    /// Unregister a component
    pub fn unregister_component(&self, component_name: &str) -> Result<()> {
        let mut active_components = self.active_components.write().unwrap();
        if active_components.remove(component_name) {
            info!("Component unregistered from Communication Center: {}", component_name);
        } else {
            warn!("Attempted to unregister unknown component: {}", component_name);
        }
        Ok(())
    }
    
    /// Submit a trading signal to be processed
    pub fn submit_trading_signal(&self, signal: TradingSignal) -> Result<()> {
        let mut pending_signals = self.pending_signals.write().unwrap();
        
        // Check if we already have this signal (avoid duplicates)
        if pending_signals.iter().any(|s| {
            s.asset == signal.asset && s.signal_type == signal.signal_type &&
            (Utc::now() - s.timestamp) < Duration::minutes(30)
        }) {
            debug!("Duplicate signal for {} ignored", signal.asset);
            return Ok(());
        }
        
        // Add to queue
        pending_signals.push_back(signal.clone());
        
        // Limit queue size
        if pending_signals.len() > 100 {
            pending_signals.pop_front();
        }
        
        // Broadcast to WebSocket clients
        self.broadcast_signal_update(signal)?;
        
        Ok(())
    }
    
    /// Get pending trading signals
    pub fn get_pending_signals(&self) -> Result<Vec<TradingSignal>> {
        // Get all signals from the queue
        let mut pending_signals = self.pending_signals.write().unwrap();
        let signals: Vec<TradingSignal> = pending_signals.drain(..).collect();
        
        Ok(signals)
    }
    
    /// Update latest market data
    pub fn update_market_data(&self, data: MarketData) -> Result<()> {
        let mut market_data = self.latest_market_data.write().unwrap();
        *market_data = Some(data.clone());
        
        // Broadcast to WebSocket clients
        self.broadcast_market_data_update(data)?;
        
        Ok(())
    }
    
    /// Get latest market data
    pub fn get_latest_market_data(&self) -> Result<Option<MarketData>> {
        let market_data = self.latest_market_data.read().unwrap();
        Ok(market_data.clone())
    }
    
    /// Log a transaction
    pub fn log_transaction(&self, transaction: &Transaction) -> Result<()> {
        let entry = TransactionLogEntry {
            timestamp: Utc::now(),
            transaction: transaction.clone(),
            signal: None,
            notes: None,
        };
        
        // Add to log
        let mut transaction_log = self.transaction_log.write().unwrap();
        transaction_log.push_back(entry);
        
        // Limit log size
        while transaction_log.len() > 1000 {
            transaction_log.pop_front();
        }
        
        // Broadcast to WebSocket clients
        self.broadcast_transaction_update(transaction)?;
        
        Ok(())
    }
    
    /// Log transaction execution from a signal
    pub fn log_transaction_execution(
        &self,
        signal: &TradingSignal,
        transaction: &Transaction,
        success: bool,
    ) -> Result<()> {
        let notes = if success {
            Some(format!("Successfully executed transaction from signal"))
        } else {
            Some(format!("Failed to execute transaction from signal"))
        };
        
        let entry = TransactionLogEntry {
            timestamp: Utc::now(),
            transaction: transaction.clone(),
            signal: Some(signal.clone()),
            notes,
        };
        
        // Add to log
        let mut transaction_log = self.transaction_log.write().unwrap();
        transaction_log.push_back(entry);
        
        // Limit log size
        while transaction_log.len() > 1000 {
            transaction_log.pop_front();
        }
        
        // Broadcast to WebSocket clients
        self.broadcast_transaction_update(transaction)?;
        
        Ok(())
    }
    
    /// Log execution failure
    pub fn log_execution_failure(
        &self,
        signal: &TradingSignal,
        strategy_id: Uuid,
        error_message: String,
    ) -> Result<()> {
        // Add system message for the error
        let system_message = SystemMessage {
            id: Uuid::new_v4(),
            timestamp: Utc::now(),
            priority: MessagePriority::Error,
            source: "TransactionEngine".to_string(),
            message: format!("Failed to execute transaction for strategy {:?}: {}", 
                             strategy_id, error_message),
            acknowledged: false,
        };
        
        self.add_system_message(system_message)?;
        
        Ok(())
    }
    
    /// Add a system message
    pub fn add_system_message(&self, message: SystemMessage) -> Result<()> {
        let mut system_messages = self.system_messages.write().unwrap();
        system_messages.push_back(message.clone());
        
        // Limit message queue
        while system_messages.len() > 1000 {
            system_messages.pop_front();
        }
        
        // Broadcast to WebSocket clients
        self.broadcast_system_message(message)?;
        
        Ok(())
    }
    
    /// Update system status
    pub fn update_system_status(&self, status: SystemComponentStatus) -> Result<()> {
        let mut system_status = self.system_status.write().unwrap();
        *system_status = status.clone();
        
        // Broadcast to WebSocket clients
        self.broadcast_status_update(status)?;
        
        Ok(())
    }
    
    /// Get current system status
    pub fn get_system_status(&self) -> Result<SystemComponentStatus> {
        let status = self.system_status.read().unwrap();
        Ok(status.clone())
    }
    
    /// Register a WebSocket channel for UI updates
    pub fn register_ws_channel(&self, channel: mpsc::Sender<WebSocketMessage>) -> Result<()> {
        let mut ws_channels = self.ws_channels.write().unwrap();
        ws_channels.push(channel);
        
        Ok(())
    }
    
    /// Update component activity timestamp
    pub fn update_component_activity(&self, component_name: &str) -> Result<()> {
        let mut last_activity = self.last_activity.write().unwrap();
        last_activity.insert(component_name.to_string(), Utc::now());
        
        Ok(())
    }
    
    /// Broadcast a trading signal update to WebSocket clients
    fn broadcast_signal_update(&self, signal: TradingSignal) -> Result<()> {
        // Create WebSocket message
        let message = WebSocketMessage {
            id: Uuid::new_v4(),
            message_type: WebSocketMessageType::TradingSignal,
            timestamp: Utc::now(),
            data: serde_json::to_value(signal)?,
        };
        
        // Broadcast to all channels
        self.broadcast_ws_message(message)?;
        
        Ok(())
    }
    
    /// Broadcast a transaction update to WebSocket clients
    fn broadcast_transaction_update(&self, transaction: &Transaction) -> Result<()> {
        // Create WebSocket message
        let message = WebSocketMessage {
            id: Uuid::new_v4(),
            message_type: WebSocketMessageType::Transaction,
            timestamp: Utc::now(),
            data: serde_json::to_value(transaction)?,
        };
        
        // Broadcast to all channels
        self.broadcast_ws_message(message)?;
        
        Ok(())
    }
    
    /// Broadcast market data update to WebSocket clients
    fn broadcast_market_data_update(&self, data: MarketData) -> Result<()> {
        // Create WebSocket message
        let message = WebSocketMessage {
            id: Uuid::new_v4(),
            message_type: WebSocketMessageType::MarketData,
            timestamp: Utc::now(),
            data: serde_json::to_value(data)?,
        };
        
        // Broadcast to all channels
        self.broadcast_ws_message(message)?;
        
        Ok(())
    }
    
    /// Broadcast status update to WebSocket clients
    fn broadcast_status_update(&self, status: SystemComponentStatus) -> Result<()> {
        // Create WebSocket message
        let message = WebSocketMessage {
            id: Uuid::new_v4(),
            message_type: WebSocketMessageType::SystemStatus,
            timestamp: Utc::now(),
            data: serde_json::to_value(status)?,
        };
        
        // Broadcast to all channels
        self.broadcast_ws_message(message)?;
        
        Ok(())
    }
    
    /// Broadcast system message to WebSocket clients
    fn broadcast_system_message(&self, system_message: SystemMessage) -> Result<()> {
        // Create WebSocket message
        let message = WebSocketMessage {
            id: Uuid::new_v4(),
            message_type: WebSocketMessageType::SystemMessage,
            timestamp: Utc::now(),
            data: serde_json::to_value(system_message)?,
        };
        
        // Broadcast to all channels
        self.broadcast_ws_message(message)?;
        
        Ok(())
    }
    
    /// Broadcast a message to all WebSocket channels
    fn broadcast_ws_message(&self, message: WebSocketMessage) -> Result<()> {
        // Get all channels
        let ws_channels = self.ws_channels.read().unwrap();
        
        // Send message to each channel (non-blocking)
        for channel in ws_channels.iter() {
            if let Err(e) = channel.try_send(message.clone()) {
                // Only log error, don't propagate
                debug!("Failed to send WebSocket message: {}", e);
            }
        }
        
        Ok(())
    }
}