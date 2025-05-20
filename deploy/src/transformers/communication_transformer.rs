use crate::models::{MarketData, TokenPrice, TradingSignal, SignalType, WebSocketMessage, SystemComponentStatus};
use crate::communication::CommunicationCenter;
use anyhow::Result;
use log::{info, debug, warn, error};
use std::sync::{Arc, RwLock, Mutex};
use std::collections::{HashMap, VecDeque};
use tokio::sync::mpsc;
use chrono::{DateTime, Utc, Duration};
use uuid::Uuid;
use serde_json::Value;

/// Communication Transformer
/// 
/// Central relay for inter-component communication.
/// Handles data transformation between system components, ensures proper formatting,
/// and maintains the organizational structure of information flow.
pub struct CommunicationTransformer {
    // Reference to communication center
    communication_center: Arc<CommunicationCenter>,
    
    // Data channels for different components
    channels: RwLock<HashMap<String, ComponentChannel>>,
    
    // Message queue for processing
    message_queue: RwLock<VecDeque<TransformerMessage>>,
    
    // Component status tracking
    component_status: RwLock<HashMap<String, bool>>,
    
    // Message processing task
    processing_task: Mutex<Option<tokio::task::JoinHandle<()>>>,
    
    // Is transformer running
    is_running: RwLock<bool>,
    
    // Encryption service for sensitive data
    encryption_enabled: RwLock<bool>,
}

/// Channel for component communication
#[derive(Clone)]
struct ComponentChannel {
    // Component name
    name: String,
    
    // Channel for sending messages to component
    sender: mpsc::Sender<TransformerMessage>,
    
    // Channel for receiving messages from component
    receiver: Arc<Mutex<mpsc::Receiver<TransformerMessage>>>,
    
    // Access level required for this channel
    access_level: AccessLevel,
    
    // Last activity timestamp
    last_activity: DateTime<Utc>,
}

/// Access level for communication channels
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
enum AccessLevel {
    Public,
    Protected,
    Secure,
    SystemOnly,
}

/// Message type for internal transformer communication
#[derive(Clone, Debug)]
enum TransformerMessage {
    // Signal from trading transformer
    TradingSignal(TradingSignal),
    
    // Market data update
    MarketData(MarketData),
    
    // Component status update
    StatusUpdate { component: String, status: bool },
    
    // Raw data message
    Data { source: String, target: String, data: Value },
    
    // Control message
    Control { command: String, parameters: Value },
    
    // Error message
    Error { source: String, message: String, code: u32 },
}

impl CommunicationTransformer {
    /// Create a new communication transformer
    pub fn new(communication_center: Arc<CommunicationCenter>) -> Self {
        info!("Initializing Communication Transformer - Data Organization and Relay");
        
        Self {
            communication_center,
            channels: RwLock::new(HashMap::new()),
            message_queue: RwLock::new(VecDeque::new()),
            component_status: RwLock::new(HashMap::new()),
            processing_task: Mutex::new(None),
            is_running: RwLock::new(false),
            encryption_enabled: RwLock::new(true),
        }
    }
    
    /// Start the communication transformer
    pub async fn start(&self) -> Result<()> {
        let mut is_running = self.is_running.write().unwrap();
        if *is_running {
            warn!("Communication Transformer is already running");
            return Ok(());
        }
        
        // Register with communication center
        self.communication_center.register_active_component("CommunicationTransformer")?;
        
        // Initialize default channels
        self.initialize_default_channels().await?;
        
        // Start processing task
        let communication_center = self.communication_center.clone();
        let task = tokio::spawn(async move {
            info!("Communication Transformer processing task started");
            self.process_messages(communication_center).await;
        });
        
        let mut processing_task = self.processing_task.lock().unwrap();
        *processing_task = Some(task);
        
        // Mark as running
        *is_running = true;
        info!("Communication Transformer started");
        
        Ok(())
    }
    
    /// Stop the communication transformer
    pub async fn stop(&self) -> Result<()> {
        let mut is_running = self.is_running.write().unwrap();
        if !*is_running {
            warn!("Communication Transformer is already stopped");
            return Ok(());
        }
        
        // Abort processing task
        let mut processing_task = self.processing_task.lock().unwrap();
        if let Some(task) = processing_task.take() {
            task.abort();
            info!("Communication Transformer processing task aborted");
        }
        
        // Unregister from communication center
        self.communication_center.unregister_component("CommunicationTransformer")?;
        
        // Mark as stopped
        *is_running = false;
        info!("Communication Transformer stopped");
        
        Ok(())
    }
    
    /// Register a component for communication
    pub async fn register_component(
        &self,
        name: &str,
        access_level: AccessLevel,
    ) -> Result<(mpsc::Sender<TransformerMessage>, mpsc::Receiver<TransformerMessage>)> {
        // Create channels
        let (tx_to_component, rx_to_component) = mpsc::channel(100);
        let (tx_from_component, rx_from_component) = mpsc::channel(100);
        
        // Register channel
        let channel = ComponentChannel {
            name: name.to_string(),
            sender: tx_to_component.clone(),
            receiver: Arc::new(Mutex::new(rx_from_component)),
            access_level,
            last_activity: Utc::now(),
        };
        
        let mut channels = self.channels.write().unwrap();
        channels.insert(name.to_string(), channel);
        
        // Update component status
        let mut status = self.component_status.write().unwrap();
        status.insert(name.to_string(), true);
        
        info!("Component registered with Communication Transformer: {}", name);
        
        // Return channels for the component to use
        Ok((tx_from_component, rx_to_component))
    }
    
    /// Unregister a component
    pub async fn unregister_component(&self, name: &str) -> Result<()> {
        let mut channels = self.channels.write().unwrap();
        if channels.remove(name).is_some() {
            info!("Component unregistered from Communication Transformer: {}", name);
        } else {
            warn!("Attempted to unregister unknown component: {}", name);
        }
        
        // Update component status
        let mut status = self.component_status.write().unwrap();
        status.remove(name);
        
        Ok(())
    }
    
    /// Submit a trading signal for processing
    pub async fn submit_trading_signal(&self, signal: TradingSignal) -> Result<()> {
        // Check if transformer is running
        if !*self.is_running.read().unwrap() {
            return Err(anyhow::anyhow!("Communication Transformer is not running"));
        }
        
        // Queue the message
        let message = TransformerMessage::TradingSignal(signal);
        self.queue_message(message).await?;
        
        Ok(())
    }
    
    /// Submit market data for processing
    pub async fn submit_market_data(&self, data: MarketData) -> Result<()> {
        // Check if transformer is running
        if !*self.is_running.read().unwrap() {
            return Err(anyhow::anyhow!("Communication Transformer is not running"));
        }
        
        // Queue the message
        let message = TransformerMessage::MarketData(data);
        self.queue_message(message).await?;
        
        Ok(())
    }
    
    /// Update component status
    pub async fn update_component_status(&self, component: &str, status: bool) -> Result<()> {
        // Check if transformer is running
        if !*self.is_running.read().unwrap() {
            return Err(anyhow::anyhow!("Communication Transformer is not running"));
        }
        
        // Queue the message
        let message = TransformerMessage::StatusUpdate {
            component: component.to_string(),
            status,
        };
        self.queue_message(message).await?;
        
        // Update component status
        let mut component_status = self.component_status.write().unwrap();
        component_status.insert(component.to_string(), status);
        
        Ok(())
    }
    
    /// Get current system status
    pub fn get_system_status(&self) -> SystemComponentStatus {
        let status = self.component_status.read().unwrap();
        
        // Check status of key components
        let blockchain = status.get("SolanaConnection").copied().unwrap_or(false);
        let transaction_engine = status.get("TransactionEngine").copied().unwrap_or(false);
        let ai_agents = status.get("TradingAgent").copied().unwrap_or(false);
        
        SystemComponentStatus {
            blockchain,
            transaction_engine,
            ai_agents,
        }
    }
    
    /// Toggle encryption for sensitive data
    pub fn set_encryption_enabled(&self, enabled: bool) {
        let mut encryption = self.encryption_enabled.write().unwrap();
        *encryption = enabled;
        info!("Communication Transformer encryption {}abled", if enabled { "en" } else { "dis" });
    }
    
    /// Initialize default communication channels
    async fn initialize_default_channels(&self) -> Result<()> {
        // Register core components
        let components = [
            ("TransactionEngine", AccessLevel::SystemOnly),
            ("SecurityProtocol", AccessLevel::SystemOnly),
            ("MarketDataTransformer", AccessLevel::Protected),
            ("TradingSignalTransformer", AccessLevel::Protected),
            ("MicroQHCTransformer", AccessLevel::Protected),
            ("MEMECortexTransformer", AccessLevel::Protected),
            ("SolanaConnection", AccessLevel::Secure),
            ("WalletManager", AccessLevel::Secure),
            ("TradingAgent", AccessLevel::Protected),
            ("ApiServer", AccessLevel::Public),
        ];
        
        for (name, level) in components {
            self.register_component(name, level).await?;
        }
        
        Ok(())
    }
    
    /// Queue a message for processing
    async fn queue_message(&self, message: TransformerMessage) -> Result<()> {
        let mut queue = self.message_queue.write().unwrap();
        queue.push_back(message);
        
        // Limit queue size
        if queue.len() > 1000 {
            warn!("Communication Transformer message queue over 1000 messages, dropping oldest");
            queue.pop_front();
        }
        
        Ok(())
    }
    
    /// Process messages in the queue
    async fn process_messages(&self, communication_center: Arc<CommunicationCenter>) {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_millis(10));
        
        loop {
            interval.tick().await;
            
            // Check if we should stop
            if !*self.is_running.read().unwrap() {
                debug!("Communication Transformer process_messages loop stopping");
                break;
            }
            
            // Process a batch of messages
            for _ in 0..10 {
                // Get next message
                let message = {
                    let mut queue = self.message_queue.write().unwrap();
                    queue.pop_front()
                };
                
                if let Some(message) = message {
                    // Process the message
                    if let Err(e) = self.process_message(message, &communication_center).await {
                        error!("Error processing message: {}", e);
                    }
                } else {
                    // No more messages
                    break;
                }
            }
            
            // Check for incoming messages from components
            if let Err(e) = self.check_component_messages().await {
                error!("Error checking component messages: {}", e);
            }
        }
    }
    
    /// Process a single message
    async fn process_message(
        &self,
        message: TransformerMessage,
        communication_center: &CommunicationCenter,
    ) -> Result<()> {
        match message {
            TransformerMessage::TradingSignal(signal) => {
                // Submit to communication center
                communication_center.submit_trading_signal(signal)?;
            },
            TransformerMessage::MarketData(data) => {
                // Forward to all relevant components
                self.broadcast_to_transformers(TransformerMessage::MarketData(data)).await?;
            },
            TransformerMessage::StatusUpdate { component, status } => {
                // Update system status
                let system_status = self.get_system_status();
                communication_center.update_system_status(system_status)?;
            },
            TransformerMessage::Data { source, target, data } => {
                // Route data message to target
                self.route_message(&source, &target, TransformerMessage::Data {
                    source: source.clone(),
                    target: target.clone(),
                    data,
                }).await?;
            },
            TransformerMessage::Control { command, parameters } => {
                // Handle control message
                self.handle_control_message(&command, &parameters).await?;
            },
            TransformerMessage::Error { source, message, code } => {
                // Log error
                error!("Error from {}: {} (code: {})", source, message, code);
            },
        }
        
        Ok(())
    }
    
    /// Check for incoming messages from components
    async fn check_component_messages(&self) -> Result<()> {
        let channels = self.channels.read().unwrap();
        
        for (name, channel) in channels.iter() {
            // Try to lock receiver (non-blocking)
            if let Ok(mut receiver) = channel.receiver.try_lock() {
                // Try to receive a message (non-blocking)
                match receiver.try_recv() {
                    Ok(message) => {
                        // Handle message from component
                        debug!("Received message from component: {}", name);
                        self.queue_message(message).await?;
                    },
                    Err(mpsc::error::TryRecvError::Empty) => {
                        // No message available
                    },
                    Err(mpsc::error::TryRecvError::Disconnected) => {
                        // Channel disconnected
                        warn!("Channel disconnected for component: {}", name);
                        
                        // Update component status
                        let mut status = self.component_status.write().unwrap();
                        status.insert(name.clone(), false);
                    },
                }
            }
        }
        
        Ok(())
    }
    
    /// Broadcast a message to all transformer components
    async fn broadcast_to_transformers(&self, message: TransformerMessage) -> Result<()> {
        let channels = self.channels.read().unwrap();
        
        // Send to all transformer components
        for (name, channel) in channels.iter() {
            if name.ends_with("Transformer") {
                if let Err(e) = channel.sender.send(message.clone()).await {
                    warn!("Failed to send message to {}: {}", name, e);
                }
            }
        }
        
        Ok(())
    }
    
    /// Route a message to a specific component
    async fn route_message(
        &self,
        source: &str,
        target: &str,
        message: TransformerMessage,
    ) -> Result<()> {
        let channels = self.channels.read().unwrap();
        
        // Check if target exists
        if let Some(channel) = channels.get(target) {
            // Check access level
            if !self.check_access(source, target, channel.access_level)? {
                return Err(anyhow::anyhow!("Access denied: {} -> {}", source, target));
            }
            
            // Send message
            if let Err(e) = channel.sender.send(message).await {
                warn!("Failed to send message to {}: {}", target, e);
                return Err(anyhow::anyhow!("Failed to send message: {}", e));
            }
        } else {
            warn!("Cannot route message to unknown component: {}", target);
            return Err(anyhow::anyhow!("Unknown component: {}", target));
        }
        
        Ok(())
    }
    
    /// Handle control message
    async fn handle_control_message(&self, command: &str, parameters: &Value) -> Result<()> {
        match command {
            "status" => {
                // Get system status
                let status = self.get_system_status();
                // Update in communication center
                self.communication_center.update_system_status(status)?;
            },
            "encrypt" => {
                // Toggle encryption
                if let Some(enabled) = parameters.get("enabled").and_then(|v| v.as_bool()) {
                    self.set_encryption_enabled(enabled);
                }
            },
            "restart" => {
                // Restart component
                if let Some(component) = parameters.get("component").and_then(|v| v.as_str()) {
                    info!("Restart request for component: {}", component);
                    // In a real implementation, would have logic to restart components
                }
            },
            _ => {
                warn!("Unknown control command: {}", command);
            }
        }
        
        Ok(())
    }
    
    /// Check access level for communication between components
    fn check_access(&self, source: &str, target: &str, target_level: AccessLevel) -> Result<bool> {
        // System components have full access
        if source == "SecurityProtocol" || source == "TransactionEngine" {
            return Ok(true);
        }
        
        // Public level is accessible to all
        if target_level == AccessLevel::Public {
            return Ok(true);
        }
        
        // Protected level is accessible to most components except API
        if target_level == AccessLevel::Protected && source != "ApiServer" {
            return Ok(true);
        }
        
        // Secure level has restricted access
        if target_level == AccessLevel::Secure {
            let allowed = [
                "SecurityProtocol", 
                "TransactionEngine", 
                "TradingAgent",
                "WalletManager",
            ];
            
            if allowed.contains(&source) {
                return Ok(true);
            }
        }
        
        // System level is most restricted
        if target_level == AccessLevel::SystemOnly {
            let allowed = ["SecurityProtocol", "TransactionEngine"];
            
            if allowed.contains(&source) {
                return Ok(true);
            }
        }
        
        // Access denied
        warn!("Access denied: {} -> {} (level: {:?})", source, target, target_level);
        Ok(false)
    }
}