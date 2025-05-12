//! Solana Quantum Trading Platform - Main Library
//!
//! This library provides all the components needed for the Solana
//! Quantum Trading Platform, including agents, transformers, and utilities.

pub mod agents;
pub mod solana;
pub mod transformers;
pub mod dex;
pub mod utils;

// Re-export commonly used types and functions
pub use agents::AgentManager;
pub use transformers::TransformerManager;
pub use solana::wallet_manager::WalletManager;

/// Module for utility types and functions
pub mod utils {
    use std::time::{Duration, SystemTime, UNIX_EPOCH};
    
    /// Get the current timestamp in seconds
    pub fn current_timestamp() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or(Duration::from_secs(0))
            .as_secs()
    }
    
    /// Get the current timestamp in milliseconds
    pub fn current_timestamp_millis() -> u128 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or(Duration::from_secs(0))
            .as_millis()
    }
    
    /// Format a timestamp as an ISO 8601 string
    pub fn format_timestamp(timestamp: u64) -> String {
        let dt = chrono::DateTime::<chrono::Utc>::from_utc(
            chrono::NaiveDateTime::from_timestamp_opt(timestamp as i64, 0).unwrap(),
            chrono::Utc,
        );
        dt.to_rfc3339()
    }
    
    /// Format a duration as a human-readable string (e.g., "1h 23m 45s")
    pub fn format_duration(seconds: u64) -> String {
        let hours = seconds / 3600;
        let minutes = (seconds % 3600) / 60;
        let seconds = seconds % 60;
        
        if hours > 0 {
            format!("{}h {}m {}s", hours, minutes, seconds)
        } else if minutes > 0 {
            format!("{}m {}s", minutes, seconds)
        } else {
            format!("{}s", seconds)
        }
    }
    
    /// Generate a random ID
    pub fn generate_id() -> String {
        use rand::Rng;
        let mut rng = rand::thread_rng();
        let id: u64 = rng.gen();
        format!("{:016x}", id)
    }
}

/// Module for agent management
pub mod agents {
    use std::collections::HashMap;
    use std::sync::{Arc, Mutex, RwLock};
    
    /// Agent type
    #[derive(Debug, Clone, PartialEq)]
    pub enum AgentType {
        /// Hyperion flash arbitrage agent
        Hyperion,
        
        /// Quantum Omega memecoin sniper agent
        QuantumOmega,
        
        /// Singularity cross-chain arbitrage agent
        Singularity,
    }
    
    impl std::fmt::Display for AgentType {
        fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
            match self {
                AgentType::Hyperion => write!(f, "hyperion"),
                AgentType::QuantumOmega => write!(f, "quantum_omega"),
                AgentType::Singularity => write!(f, "singularity"),
            }
        }
    }
    
    /// Agent state
    #[derive(Debug, Clone, PartialEq)]
    pub enum AgentState {
        /// Agent is idle (not running)
        Idle,
        
        /// Agent is initializing
        Initializing,
        
        /// Agent is running
        Running,
        
        /// Agent is stopped
        Stopped,
        
        /// Agent has an error
        Error(String),
    }
    
    impl std::fmt::Display for AgentState {
        fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
            match self {
                AgentState::Idle => write!(f, "idle"),
                AgentState::Initializing => write!(f, "initializing"),
                AgentState::Running => write!(f, "running"),
                AgentState::Stopped => write!(f, "stopped"),
                AgentState::Error(e) => write!(f, "error: {}", e),
            }
        }
    }
    
    /// Agent information
    #[derive(Debug, Clone)]
    pub struct AgentInfo {
        /// Agent ID
        pub id: String,
        
        /// Agent name
        pub name: String,
        
        /// Agent type
        pub agent_type: AgentType,
        
        /// Agent state
        pub state: AgentState,
        
        /// Is the agent active?
        pub active: bool,
        
        /// Last error
        pub last_error: Option<String>,
        
        /// Metrics
        pub metrics: HashMap<String, f64>,
    }
    
    /// Agent manager
    pub struct AgentManager {
        /// Agents
        agents: RwLock<HashMap<String, Arc<Mutex<AgentInfo>>>>,
    }
    
    impl AgentManager {
        /// Create a new AgentManager
        pub fn new() -> Self {
            Self {
                agents: RwLock::new(HashMap::new()),
            }
        }
        
        /// Register an agent
        pub fn register_agent(&self, agent: AgentInfo) -> String {
            let id = agent.id.clone();
            let agent = Arc::new(Mutex::new(agent));
            self.agents.write().unwrap().insert(id.clone(), agent);
            id
        }
        
        /// Get an agent by ID
        pub fn get_agent(&self, id: &str) -> Option<Arc<Mutex<AgentInfo>>> {
            self.agents.read().unwrap().get(id).cloned()
        }
        
        /// Get all agents
        pub fn get_agents(&self) -> Vec<AgentInfo> {
            self.agents
                .read()
                .unwrap()
                .values()
                .map(|agent| agent.lock().unwrap().clone())
                .collect()
        }
        
        /// Update agent state
        pub fn update_agent_state(&self, id: &str, state: AgentState) -> bool {
            if let Some(agent) = self.get_agent(id) {
                let mut agent = agent.lock().unwrap();
                agent.state = state;
                true
            } else {
                false
            }
        }
        
        /// Update agent metrics
        pub fn update_agent_metrics(&self, id: &str, metrics: HashMap<String, f64>) -> bool {
            if let Some(agent) = self.get_agent(id) {
                let mut agent = agent.lock().unwrap();
                agent.metrics = metrics;
                true
            } else {
                false
            }
        }
        
        /// Set agent active state
        pub fn set_agent_active(&self, id: &str, active: bool) -> bool {
            if let Some(agent) = self.get_agent(id) {
                let mut agent = agent.lock().unwrap();
                agent.active = active;
                true
            } else {
                false
            }
        }
        
        /// Set agent error
        pub fn set_agent_error(&self, id: &str, error: Option<String>) -> bool {
            if let Some(agent) = self.get_agent(id) {
                let mut agent = agent.lock().unwrap();
                agent.last_error = error;
                true
            } else {
                false
            }
        }
    }
}

/// Module for transformer management
pub mod transformers {
    use std::collections::HashMap;
    use std::sync::{Arc, Mutex, RwLock};
    
    /// Transformer type
    #[derive(Debug, Clone, PartialEq)]
    pub enum TransformerType {
        /// MicroQHC transformer
        MicroQHC,
        
        /// MemeCortex transformer
        MemeCortex,
        
        /// CommunicationTransformer
        CommunicationTransformer,
    }
    
    impl std::fmt::Display for TransformerType {
        fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
            match self {
                TransformerType::MicroQHC => write!(f, "microqhc"),
                TransformerType::MemeCortex => write!(f, "memecortex"),
                TransformerType::CommunicationTransformer => write!(f, "communication"),
            }
        }
    }
    
    /// Transformer state
    #[derive(Debug, Clone, PartialEq)]
    pub enum TransformerState {
        /// Transformer is idle (not running)
        Idle,
        
        /// Transformer is initializing
        Initializing,
        
        /// Transformer is running
        Running,
        
        /// Transformer is stopped
        Stopped,
        
        /// Transformer has an error
        Error(String),
    }
    
    impl std::fmt::Display for TransformerState {
        fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
            match self {
                TransformerState::Idle => write!(f, "idle"),
                TransformerState::Initializing => write!(f, "initializing"),
                TransformerState::Running => write!(f, "running"),
                TransformerState::Stopped => write!(f, "stopped"),
                TransformerState::Error(e) => write!(f, "error: {}", e),
            }
        }
    }
    
    /// Transformer information
    #[derive(Debug, Clone)]
    pub struct TransformerInfo {
        /// Transformer ID
        pub id: String,
        
        /// Transformer name
        pub name: String,
        
        /// Transformer type
        pub transformer_type: TransformerType,
        
        /// Transformer state
        pub state: TransformerState,
        
        /// Is the transformer active?
        pub active: bool,
        
        /// Last error
        pub last_error: Option<String>,
        
        /// Metrics
        pub metrics: HashMap<String, f64>,
    }
    
    /// Transformer manager
    pub struct TransformerManager {
        /// Transformers
        transformers: RwLock<HashMap<String, Arc<Mutex<TransformerInfo>>>>,
    }
    
    impl TransformerManager {
        /// Create a new TransformerManager
        pub fn new() -> Self {
            Self {
                transformers: RwLock::new(HashMap::new()),
            }
        }
        
        /// Register a transformer
        pub fn register_transformer(&self, transformer: TransformerInfo) -> String {
            let id = transformer.id.clone();
            let transformer = Arc::new(Mutex::new(transformer));
            self.transformers.write().unwrap().insert(id.clone(), transformer);
            id
        }
        
        /// Get a transformer by ID
        pub fn get_transformer(&self, id: &str) -> Option<Arc<Mutex<TransformerInfo>>> {
            self.transformers.read().unwrap().get(id).cloned()
        }
        
        /// Get all transformers
        pub fn get_transformers(&self) -> Vec<TransformerInfo> {
            self.transformers
                .read()
                .unwrap()
                .values()
                .map(|transformer| transformer.lock().unwrap().clone())
                .collect()
        }
        
        /// Update transformer state
        pub fn update_transformer_state(&self, id: &str, state: TransformerState) -> bool {
            if let Some(transformer) = self.get_transformer(id) {
                let mut transformer = transformer.lock().unwrap();
                transformer.state = state;
                true
            } else {
                false
            }
        }
        
        /// Update transformer metrics
        pub fn update_transformer_metrics(&self, id: &str, metrics: HashMap<String, f64>) -> bool {
            if let Some(transformer) = self.get_transformer(id) {
                let mut transformer = transformer.lock().unwrap();
                transformer.metrics = metrics;
                true
            } else {
                false
            }
        }
        
        /// Set transformer active state
        pub fn set_transformer_active(&self, id: &str, active: bool) -> bool {
            if let Some(transformer) = self.get_transformer(id) {
                let mut transformer = transformer.lock().unwrap();
                transformer.active = active;
                true
            } else {
                false
            }
        }
        
        /// Set transformer error
        pub fn set_transformer_error(&self, id: &str, error: Option<String>) -> bool {
            if let Some(transformer) = self.get_transformer(id) {
                let mut transformer = transformer.lock().unwrap();
                transformer.last_error = error;
                true
            } else {
                false
            }
        }
    }
}

/// Solana module for wallet management and blockchain interactions
pub mod solana {
    /// Wallet manager module
    pub mod wallet_manager {
        use std::collections::HashMap;
        use std::sync::{Arc, Mutex, RwLock};
        
        /// Wallet type
        #[derive(Debug, Clone, PartialEq)]
        pub enum WalletType {
            /// System wallet
            System,
            
            /// Trading wallet
            Trading,
            
            /// Profit wallet
            Profit,
            
            /// Fee wallet
            Fee,
            
            /// Stealth wallet
            Stealth,
        }
        
        impl std::fmt::Display for WalletType {
            fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                match self {
                    WalletType::System => write!(f, "system"),
                    WalletType::Trading => write!(f, "trading"),
                    WalletType::Profit => write!(f, "profit"),
                    WalletType::Fee => write!(f, "fee"),
                    WalletType::Stealth => write!(f, "stealth"),
                }
            }
        }
        
        /// Wallet information
        #[derive(Debug, Clone)]
        pub struct WalletInfo {
            /// Wallet address
            pub address: String,
            
            /// Wallet type
            pub wallet_type: WalletType,
            
            /// Wallet balance
            pub balance: f64,
            
            /// Last updated timestamp
            pub last_updated: u64,
            
            /// Is the wallet active?
            pub active: bool,
            
            /// Associated agent ID
            pub agent_id: Option<String>,
            
            /// Last error
            pub last_error: Option<String>,
        }
        
        /// Wallet manager
        pub struct WalletManager {
            /// Wallets
            wallets: RwLock<HashMap<String, Arc<Mutex<WalletInfo>>>>,
        }
        
        impl WalletManager {
            /// Create a new WalletManager
            pub fn new() -> Self {
                Self {
                    wallets: RwLock::new(HashMap::new()),
                }
            }
            
            /// Register a wallet
            pub fn register_wallet(&self, wallet: WalletInfo) -> String {
                let address = wallet.address.clone();
                let wallet = Arc::new(Mutex::new(wallet));
                self.wallets.write().unwrap().insert(address.clone(), wallet);
                address
            }
            
            /// Get a wallet by address
            pub fn get_wallet(&self, address: &str) -> Option<Arc<Mutex<WalletInfo>>> {
                self.wallets.read().unwrap().get(address).cloned()
            }
            
            /// Get all wallets
            pub fn get_wallets(&self) -> Vec<WalletInfo> {
                self.wallets
                    .read()
                    .unwrap()
                    .values()
                    .map(|wallet| wallet.lock().unwrap().clone())
                    .collect()
            }
            
            /// Update wallet balance
            pub fn update_wallet_balance(&self, address: &str, balance: f64) -> bool {
                if let Some(wallet) = self.get_wallet(address) {
                    let mut wallet = wallet.lock().unwrap();
                    wallet.balance = balance;
                    wallet.last_updated = crate::utils::current_timestamp();
                    true
                } else {
                    false
                }
            }
            
            /// Set wallet active state
            pub fn set_wallet_active(&self, address: &str, active: bool) -> bool {
                if let Some(wallet) = self.get_wallet(address) {
                    let mut wallet = wallet.lock().unwrap();
                    wallet.active = active;
                    true
                } else {
                    false
                }
            }
            
            /// Set wallet error
            pub fn set_wallet_error(&self, address: &str, error: Option<String>) -> bool {
                if let Some(wallet) = self.get_wallet(address) {
                    let mut wallet = wallet.lock().unwrap();
                    wallet.last_error = error;
                    true
                } else {
                    false
                }
            }
            
            /// Get system wallet
            pub fn get_system_wallet(&self) -> Option<WalletInfo> {
                self.wallets
                    .read()
                    .unwrap()
                    .values()
                    .filter_map(|wallet| {
                        let wallet = wallet.lock().unwrap();
                        if wallet.wallet_type == WalletType::System {
                            Some(wallet.clone())
                        } else {
                            None
                        }
                    })
                    .next()
            }
            
            /// Get agent wallets
            pub fn get_agent_wallets(&self, agent_id: &str) -> Vec<WalletInfo> {
                self.wallets
                    .read()
                    .unwrap()
                    .values()
                    .filter_map(|wallet| {
                        let wallet = wallet.lock().unwrap();
                        if wallet.agent_id.as_deref() == Some(agent_id) {
                            Some(wallet.clone())
                        } else {
                            None
                        }
                    })
                    .collect()
            }
        }
    }
}

/// DEX interaction module
pub mod dex {
    /// DEX types
    #[derive(Debug, Clone, PartialEq)]
    pub enum DexType {
        /// Jupiter aggregator
        Jupiter,
        
        /// Raydium
        Raydium,
        
        /// OpenBook (formerly Serum)
        OpenBook,
        
        /// Orca
        Orca,
        
        /// Meteora
        Meteora,
    }
    
    impl std::fmt::Display for DexType {
        fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
            match self {
                DexType::Jupiter => write!(f, "jupiter"),
                DexType::Raydium => write!(f, "raydium"),
                DexType::OpenBook => write!(f, "openbook"),
                DexType::Orca => write!(f, "orca"),
                DexType::Meteora => write!(f, "meteora"),
            }
        }
    }
    
    /// Price information
    #[derive(Debug, Clone)]
    pub struct Price {
        /// Token pair
        pub pair: String,
        
        /// Price value
        pub value: f64,
        
        /// Volume
        pub volume: f64,
        
        /// Source
        pub source: DexType,
        
        /// Timestamp
        pub timestamp: u64,
    }
    
    /// Order information
    #[derive(Debug, Clone)]
    pub struct Order {
        /// Order ID
        pub id: String,
        
        /// Token pair
        pub pair: String,
        
        /// Order type
        pub order_type: OrderType,
        
        /// Price
        pub price: f64,
        
        /// Amount
        pub amount: f64,
        
        /// Timestamp
        pub timestamp: u64,
    }
    
    /// Order type
    #[derive(Debug, Clone, PartialEq)]
    pub enum OrderType {
        /// Buy order
        Buy,
        
        /// Sell order
        Sell,
    }
    
    impl std::fmt::Display for OrderType {
        fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
            match self {
                OrderType::Buy => write!(f, "buy"),
                OrderType::Sell => write!(f, "sell"),
            }
        }
    }
}