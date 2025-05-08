use crate::models::{
    Transaction, TradingSignal, WebSocketMessage, SystemComponentStatus
};
use crate::security::SecurityProtocol;
use anyhow::{Result, Context};
use log::{info, error, warn, debug};
use std::sync::{Arc, RwLock, Mutex};
use chrono::Utc;
use uuid::Uuid;
use std::collections::{HashMap, VecDeque};
use tokio::sync::broadcast;
use serde::{Serialize, Deserialize};

/// Communication Center - Manages data flow between system components
/// Acts as the layer around the transaction engine for inter-component communication
pub struct CommunicationCenter {
    security_protocol: Arc<SecurityProtocol>,
    
    // Component registry
    active_components: RwLock<HashMap<String, ComponentInfo>>,
    
    // Signal queues
    pending_signals: RwLock<VecDeque<TradingSignal>>,
    
    // Broadcast channels for real-time updates
    transaction_updates: broadcast::Sender<Transaction>,
    system_status_updates: broadcast::Sender<SystemComponentStatus>,
    
    // Performance/telemetry data
    system_logs: RwLock<VecDeque<SystemLog>>,
    max_log_entries: usize,
    
    // Hidden data registry for secure storage
    hidden_data_registry: RwLock<HashMap<String, HiddenDataInfo>>,
}

/// Information about a registered component
#[derive(Debug, Clone)]
struct ComponentInfo {
    name: String,
    status: ComponentStatus,
    last_heartbeat: chrono::DateTime<Utc>,
}

/// Component status
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ComponentStatus {
    Active,
    Inactive,
    Error,
}

/// System log entry
#[derive(Debug, Clone, Serialize, Deserialize)]
struct SystemLog {
    timestamp: chrono::DateTime<Utc>,
    level: LogLevel,
    component: String,
    message: String,
    data: Option<serde_json::Value>,
}

/// Log level
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
enum LogLevel {
    Info,
    Warning,
    Error,
    Security,
    Transaction,
}

/// Information about hidden data
#[derive(Debug, Clone)]
struct HiddenDataInfo {
    id: String,
    data_type: String,
    security_tag: String,
    last_access: chrono::DateTime<Utc>,
    access_count: u32,
    owner_component: String,
}

impl CommunicationCenter {
    /// Create a new communication center
    pub fn new(security_protocol: Arc<SecurityProtocol>) -> Self {
        info!("Initializing Communication Center - System Communication Layer");
        
        // Create broadcast channels with capacity
        let (tx_transaction, _) = broadcast::channel(100);
        let (tx_status, _) = broadcast::channel(100);
        
        Self {
            security_protocol,
            active_components: RwLock::new(HashMap::new()),
            pending_signals: RwLock::new(VecDeque::new()),
            transaction_updates: tx_transaction,
            system_status_updates: tx_status,
            system_logs: RwLock::new(VecDeque::new()),
            max_log_entries: 1000,
            hidden_data_registry: RwLock::new(HashMap::new()),
        }
    }
    
    /// Register a component as active
    pub fn register_active_component(&self, component_name: &str) -> Result<()> {
        // Security verification
        self.security_protocol.verify_component_registration(component_name)?;
        
        let mut components = self.active_components.write().unwrap();
        components.insert(component_name.to_string(), ComponentInfo {
            name: component_name.to_string(),
            status: ComponentStatus::Active,
            last_heartbeat: Utc::now(),
        });
        
        self.log_event(
            LogLevel::Info,
            "CommunicationCenter",
            &format!("Component registered: {}", component_name),
            None,
        );
        
        info!("Component registered as active: {}", component_name);
        Ok(())
    }
    
    /// Unregister a component
    pub fn unregister_component(&self, component_name: &str) -> Result<()> {
        let mut components = self.active_components.write().unwrap();
        
        if components.remove(component_name).is_some() {
            self.log_event(
                LogLevel::Info,
                "CommunicationCenter",
                &format!("Component unregistered: {}", component_name),
                None,
            );
            
            info!("Component unregistered: {}", component_name);
        } else {
            warn!("Attempted to unregister unknown component: {}", component_name);
        }
        
        Ok(())
    }
    
    /// Update component heartbeat
    pub fn update_component_heartbeat(&self, component_name: &str) -> Result<()> {
        let mut components = self.active_components.write().unwrap();
        
        if let Some(component) = components.get_mut(component_name) {
            component.last_heartbeat = Utc::now();
            debug!("Updated heartbeat for component: {}", component_name);
        } else {
            warn!("Attempted to update heartbeat for unknown component: {}", component_name);
        }
        
        Ok(())
    }
    
    /// Submit a trading signal for processing
    pub fn submit_trading_signal(&self, signal: TradingSignal) -> Result<()> {
        // Verify the signal through security
        self.security_protocol.verify_trading_signal(&signal)?;
        
        // Add to pending signals
        let mut signals = self.pending_signals.write().unwrap();
        signals.push_back(signal.clone());
        
        self.log_event(
            LogLevel::Info,
            "CommunicationCenter",
            &format!("Trading signal submitted for {}", signal.asset),
            Some(serde_json::to_value(&signal)?),
        );
        
        debug!("Trading signal submitted for {}", signal.asset);
        Ok(())
    }
    
    /// Get pending trading signals
    pub fn get_pending_signals(&self) -> Result<Vec<TradingSignal>> {
        let mut signals = self.pending_signals.write().unwrap();
        
        // Take all pending signals
        let signals_vec: Vec<TradingSignal> = signals.drain(..).collect();
        
        debug!("Retrieved {} pending trading signals", signals_vec.len());
        Ok(signals_vec)
    }
    
    /// Log a transaction for monitoring and auditing
    pub fn log_transaction(&self, transaction: &Transaction) -> Result<()> {
        // Log the transaction
        self.log_event(
            LogLevel::Transaction,
            "TransactionEngine",
            &format!("Transaction executed: {:?}", transaction.id),
            Some(serde_json::to_value(transaction)?),
        );
        
        // Broadcast the transaction to all listeners
        if let Err(e) = self.transaction_updates.send(transaction.clone()) {
            warn!("Failed to broadcast transaction: {}", e);
        }
        
        Ok(())
    }
    
    /// Log transaction execution for a trading signal
    pub fn log_transaction_execution(
        &self,
        signal: &TradingSignal,
        transaction: &Transaction,
        success: bool,
    ) -> Result<()> {
        let status = if success { "success" } else { "failure" };
        
        self.log_event(
            LogLevel::Transaction,
            "TransactionEngine",
            &format!("Signal execution {}: {} for {}", 
                status, transaction.id, signal.asset),
            Some(serde_json::json!({
                "signal": signal,
                "transaction": transaction,
                "success": success
            })),
        );
        
        Ok(())
    }
    
    /// Log execution failure
    pub fn log_execution_failure(
        &self,
        signal: &TradingSignal,
        strategy_id: Uuid,
        error_message: String,
    ) -> Result<()> {
        self.log_event(
            LogLevel::Error,
            "TransactionEngine",
            &format!("Failed to execute transaction for signal: {}", signal.asset),
            Some(serde_json::json!({
                "signal": signal,
                "strategy_id": strategy_id.to_string(),
                "error": error_message
            })),
        );
        
        Ok(())
    }
    
    /// Update system status and broadcast to clients
    pub fn update_system_status(&self, status: SystemComponentStatus) -> Result<()> {
        // Broadcast the status update
        if let Err(e) = self.system_status_updates.send(status.clone()) {
            warn!("Failed to broadcast system status: {}", e);
        }
        
        self.log_event(
            LogLevel::Info,
            "CommunicationCenter",
            "System status updated",
            Some(serde_json::to_value(&status)?),
        );
        
        Ok(())
    }
    
    /// Get a WebSocket message receiver for real-time updates
    pub fn get_transaction_receiver(&self) -> broadcast::Receiver<Transaction> {
        self.transaction_updates.subscribe()
    }
    
    /// Get a WebSocket message receiver for system status updates
    pub fn get_status_receiver(&self) -> broadcast::Receiver<SystemComponentStatus> {
        self.system_status_updates.subscribe()
    }
    
    /// Register hidden data with a security tag
    pub fn register_hidden_data(
        &self,
        data_id: &str,
        data_type: &str,
        security_tag: &str,
        owner_component: &str,
    ) -> Result<()> {
        // Verify with security protocol
        self.security_protocol.verify_hidden_data_registration(
            data_id, data_type, security_tag, owner_component)?;
        
        let mut registry = self.hidden_data_registry.write().unwrap();
        
        registry.insert(data_id.to_string(), HiddenDataInfo {
            id: data_id.to_string(),
            data_type: data_type.to_string(),
            security_tag: security_tag.to_string(),
            last_access: Utc::now(),
            access_count: 0,
            owner_component: owner_component.to_string(),
        });
        
        self.log_event(
            LogLevel::Security,
            "CommunicationCenter",
            &format!("Hidden data registered: {} (type: {}, owner: {})", 
                data_id, data_type, owner_component),
            None,
        );
        
        info!("Hidden data registered with ID: {}", data_id);
        Ok(())
    }
    
    /// Record access to hidden data
    pub fn record_hidden_data_access(
        &self,
        data_id: &str,
        accessing_component: &str,
    ) -> Result<()> {
        // Verify access with security protocol
        self.security_protocol.verify_hidden_data_access(data_id, accessing_component)?;
        
        let mut registry = self.hidden_data_registry.write().unwrap();
        
        if let Some(data_info) = registry.get_mut(data_id) {
            data_info.last_access = Utc::now();
            data_info.access_count += 1;
            
            self.log_event(
                LogLevel::Security,
                "CommunicationCenter",
                &format!("Hidden data accessed: {} by {}", data_id, accessing_component),
                None,
            );
            
            debug!("Hidden data {} accessed by {}", data_id, accessing_component);
        } else {
            return Err(anyhow::anyhow!("Hidden data not found: {}", data_id));
        }
        
        Ok(())
    }
    
    /// Get activity log for a specific hidden data item
    pub fn get_hidden_data_activity(&self, data_id: &str) -> Result<HiddenDataActivity> {
        // Verify access with security protocol
        self.security_protocol.verify_hidden_data_monitoring(data_id)?;
        
        let registry = self.hidden_data_registry.read().unwrap();
        
        if let Some(data_info) = registry.get(data_id) {
            Ok(HiddenDataActivity {
                id: data_info.id.clone(),
                last_access: data_info.last_access,
                access_count: data_info.access_count,
                owner: data_info.owner_component.clone(),
            })
        } else {
            Err(anyhow::anyhow!("Hidden data not found: {}", data_id))
        }
    }
    
    /// Get system logs with optional filtering
    pub fn get_system_logs(
        &self,
        level: Option<LogLevel>,
        component: Option<&str>,
        limit: Option<usize>,
    ) -> Vec<SystemLog> {
        let logs = self.system_logs.read().unwrap();
        
        let filtered = logs.iter()
            .filter(|log| {
                // Filter by log level if specified
                if let Some(log_level) = level {
                    if log.level != log_level {
                        return false;
                    }
                }
                
                // Filter by component if specified
                if let Some(comp_name) = component {
                    if log.component != comp_name {
                        return false;
                    }
                }
                
                true
            })
            .take(limit.unwrap_or(100))
            .cloned()
            .collect();
            
        filtered
    }
    
    /// Add a log entry to the system logs
    fn log_event(
        &self,
        level: LogLevel,
        component: &str,
        message: &str,
        data: Option<serde_json::Value>,
    ) {
        let log_entry = SystemLog {
            timestamp: Utc::now(),
            level,
            component: component.to_string(),
            message: message.to_string(),
            data,
        };
        
        let mut logs = self.system_logs.write().unwrap();
        
        // Add the new log entry
        logs.push_back(log_entry);
        
        // Ensure we don't exceed the maximum number of log entries
        while logs.len() > self.max_log_entries {
            logs.pop_front();
        }
    }
}

/// Activity information for hidden data
#[derive(Debug, Clone, Serialize)]
pub struct HiddenDataActivity {
    pub id: String,
    pub last_access: chrono::DateTime<Utc>,
    pub access_count: u32,
    pub owner: String,
}