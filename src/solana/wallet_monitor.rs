//! Solana Wallet Monitoring System
//!
//! This module implements real-time wallet monitoring for the Solana Quantum Trading System,
//! allowing tracking of wallet balances, transactions, and profits across all trading agents.

use std::collections::{HashMap, VecDeque};
use std::error::Error;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, SystemTime};

use crate::utils::current_timestamp;

/// Transaction type for tracking purposes
#[derive(Debug, Clone, PartialEq)]
pub enum TransactionType {
    /// Trading transaction (buy/sell)
    Trade,
    /// Transfer between wallets
    Transfer,
    /// Flash loan
    FlashLoan,
    /// Cross-chain transaction
    CrossChain,
    /// Profit collection
    ProfitCollection,
    /// DEX interaction (add/remove liquidity)
    DexInteraction,
    /// Lending protocol interaction
    LendingInteraction,
    /// Fee payment
    Fee,
    /// Unknown transaction type
    Unknown,
}

/// Wallet transaction record
#[derive(Debug, Clone)]
pub struct WalletTransaction {
    pub id: String,
    pub wallet_address: String,
    pub signature: String,
    pub timestamp: u64,
    pub amount: f64,
    pub token: String,
    pub transaction_type: TransactionType,
    pub description: String,
    pub fee: f64,
    pub related_addresses: Vec<String>,
    pub agent_id: Option<String>,
    pub status: String,
    pub block_number: u64,
    pub is_profit: bool,
}

/// Wallet balance for a specific token
#[derive(Debug, Clone)]
pub struct TokenBalance {
    pub token: String,
    pub amount: f64,
    pub usd_value: f64,
    pub last_updated: u64,
}

/// Wallet status information
#[derive(Debug, Clone)]
pub struct WalletStatus {
    pub address: String,
    pub label: String,
    pub status: String,
    pub balances: HashMap<String, TokenBalance>,
    pub total_value_usd: f64,
    pub last_transaction: Option<WalletTransaction>,
    pub last_updated: u64,
    pub transaction_count: usize,
    pub agent_id: Option<String>,
}

/// Wallet alert level
#[derive(Debug, Clone, PartialEq, Ord, PartialOrd, Eq)]
pub enum AlertLevel {
    Info,
    Warning,
    Critical,
}

/// Wallet alert
#[derive(Debug, Clone)]
pub struct WalletAlert {
    pub id: String,
    pub wallet_address: String,
    pub timestamp: u64,
    pub level: AlertLevel,
    pub message: String,
    pub acknowledged: bool,
    pub resolved: bool,
    pub resolution_message: Option<String>,
    pub related_transaction: Option<String>,
}

/// Profit record
#[derive(Debug, Clone)]
pub struct ProfitRecord {
    pub id: String,
    pub agent_id: String,
    pub timestamp: u64,
    pub amount: f64,
    pub token: String,
    pub usd_value: f64,
    pub transaction_signature: String,
    pub strategy_name: String,
    pub execution_time: u64,
    pub gas_cost: f64,
    pub profit_percentage: f64,
}

/// System wallet configuration
#[derive(Debug, Clone)]
pub struct SystemWalletConfig {
    pub system_wallet: String,
    pub profit_collection_interval: Duration,
    pub min_profit_collection_amount: f64,
    pub low_balance_threshold: f64,
    pub critical_balance_threshold: f64,
    pub max_transaction_history: usize,
    pub polling_interval: Duration,
    pub max_alerts: usize,
    pub auto_fund_trading_wallets: bool,
    pub trading_wallet_minimum_balance: f64,
    pub token_price_update_interval: Duration,
    pub track_profit_metrics: bool,
    pub enable_alerts: bool,
    pub alert_webhook_url: Option<String>,
    pub track_historical_balances: bool,
    pub historical_balance_intervals: Vec<Duration>,
    pub trading_wallets: HashMap<String, String>,
    pub profit_wallets: HashMap<String, String>,
    pub fee_wallets: HashMap<String, String>,
}

impl Default for SystemWalletConfig {
    fn default() -> Self {
        let mut trading_wallets = HashMap::new();
        trading_wallets.insert("hyperion".to_string(), "8mFQbdXKNXEHDSxTgQnYJ7gJjwS7Z6TCQwP8HrbbNYQQ".to_string());
        trading_wallets.insert("quantum_omega".to_string(), "DAz8CQz4G63Wj1jCNe3HY2xQ4VSmaKmTBBVvfizRf".to_string());
        trading_wallets.insert("singularity".to_string(), "HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb".to_string());
        
        let mut profit_wallets = HashMap::new();
        profit_wallets.insert("hyperion".to_string(), "5vxoRv2P12q2YvUqnRTrLuhHft8v71dPCnmTNsAATX6s".to_string());
        profit_wallets.insert("quantum_omega".to_string(), "2fZ1XPa3kuGWPgitv3DE1awpa1FEE4JFyVLpUYCZwzDJ".to_string());
        profit_wallets.insert("singularity".to_string(), "6bLfHsp6eCFWZqGKZQaRwpVVLZRwKqcLt6QCKwLoxTqF".to_string());
        
        let mut fee_wallets = HashMap::new();
        fee_wallets.insert("singularity".to_string(), "9aBt1zPRUZmxttZ6Mk9AAU6XGS1TLQMZkpbCNBLH2Y2z".to_string());
        
        Self {
            system_wallet: "HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb".to_string(),
            profit_collection_interval: Duration::from_secs(3600), // 1 hour
            min_profit_collection_amount: 0.1, // 0.1 SOL
            low_balance_threshold: 0.5, // 0.5 SOL
            critical_balance_threshold: 0.1, // 0.1 SOL
            max_transaction_history: 1000,
            polling_interval: Duration::from_secs(60), // 1 minute
            max_alerts: 100,
            auto_fund_trading_wallets: true,
            trading_wallet_minimum_balance: 0.05, // 0.05 SOL
            token_price_update_interval: Duration::from_secs(300), // 5 minutes
            track_profit_metrics: true,
            enable_alerts: true,
            alert_webhook_url: None,
            track_historical_balances: true,
            historical_balance_intervals: vec![
                Duration::from_secs(3600),     // 1 hour
                Duration::from_secs(86400),    // 1 day
                Duration::from_secs(604800),   // 1 week
                Duration::from_secs(2592000),  // 30 days
            ],
            trading_wallets,
            profit_wallets,
            fee_wallets,
        }
    }
}

/// Wallet monitoring system
pub struct WalletMonitor {
    config: SystemWalletConfig,
    wallet_statuses: Arc<Mutex<HashMap<String, WalletStatus>>>,
    transactions: Arc<Mutex<VecDeque<WalletTransaction>>>,
    alerts: Arc<Mutex<VecDeque<WalletAlert>>>,
    profits: Arc<Mutex<Vec<ProfitRecord>>>,
    historical_balances: Arc<Mutex<HashMap<String, Vec<(u64, HashMap<String, f64>)>>>>,
    token_prices: Arc<Mutex<HashMap<String, f64>>>,
    active: bool,
    subscribers: Arc<Mutex<Vec<Box<dyn Fn(WalletStatus) + Send + Sync>>>>,
    alert_subscribers: Arc<Mutex<Vec<Box<dyn Fn(WalletAlert) + Send + Sync>>>>,
    transaction_subscribers: Arc<Mutex<Vec<Box<dyn Fn(WalletTransaction) + Send + Sync>>>>,
    profit_subscribers: Arc<Mutex<Vec<Box<dyn Fn(ProfitRecord) + Send + Sync>>>>,
    last_poll: Arc<Mutex<Option<Instant>>>,
    last_price_update: Arc<Mutex<Option<Instant>>>,
    last_profit_collection: Arc<Mutex<Option<Instant>>>,
}

impl WalletMonitor {
    /// Create a new wallet monitor
    pub fn new(config: SystemWalletConfig) -> Self {
        Self {
            config,
            wallet_statuses: Arc::new(Mutex::new(HashMap::new())),
            transactions: Arc::new(Mutex::new(VecDeque::new())),
            alerts: Arc::new(Mutex::new(VecDeque::new())),
            profits: Arc::new(Mutex::new(Vec::new())),
            historical_balances: Arc::new(Mutex::new(HashMap::new())),
            token_prices: Arc::new(Mutex::new(HashMap::new())),
            active: false,
            subscribers: Arc::new(Mutex::new(Vec::new())),
            alert_subscribers: Arc::new(Mutex::new(Vec::new())),
            transaction_subscribers: Arc::new(Mutex::new(Vec::new())),
            profit_subscribers: Arc::new(Mutex::new(Vec::new())),
            last_poll: Arc::new(Mutex::new(None)),
            last_price_update: Arc::new(Mutex::new(None)),
            last_profit_collection: Arc::new(Mutex::new(None)),
        }
    }
    
    /// Start the wallet monitor
    pub fn start(&mut self) -> Result<(), Box<dyn Error>> {
        println!("Starting wallet monitoring system...");
        
        self.active = true;
        
        // Initialize token prices
        self.update_token_prices()?;
        
        // Initialize wallet statuses
        self.initialize_wallet_statuses()?;
        
        // Set last poll time
        let mut last_poll = self.last_poll.lock().unwrap();
        *last_poll = Some(Instant::now());
        
        // Set last price update time
        let mut last_price_update = self.last_price_update.lock().unwrap();
        *last_price_update = Some(Instant::now());
        
        // Set last profit collection time
        let mut last_profit_collection = self.last_profit_collection.lock().unwrap();
        *last_profit_collection = Some(Instant::now());
        
        println!("Wallet monitoring system started successfully!");
        
        Ok(())
    }
    
    /// Stop the wallet monitor
    pub fn stop(&mut self) -> Result<(), Box<dyn Error>> {
        println!("Stopping wallet monitoring system...");
        
        self.active = false;
        
        println!("Wallet monitoring system stopped successfully!");
        
        Ok(())
    }
    
    /// Check if the wallet monitor is active
    pub fn is_active(&self) -> bool {
        self.active
    }
    
    /// Poll for updates
    pub fn poll(&self) -> Result<(), Box<dyn Error>> {
        if !self.active {
            return Err(Box::new(std::io::Error::new(
                std::io::ErrorKind::Other,
                "Wallet monitor is not active",
            )));
        }
        
        // Update last poll time
        let mut last_poll = self.last_poll.lock().unwrap();
        *last_poll = Some(Instant::now());
        
        // Check if we need to update token prices
        let update_prices = {
            let last_price_update = self.last_price_update.lock().unwrap();
            match *last_price_update {
                Some(time) => time.elapsed() >= self.config.token_price_update_interval,
                None => true,
            }
        };
        
        if update_prices {
            self.update_token_prices()?;
            
            // Update last price update time
            let mut last_price_update = self.last_price_update.lock().unwrap();
            *last_price_update = Some(Instant::now());
        }
        
        // Update wallet statuses
        self.update_wallet_statuses()?;
        
        // Check if we need to collect profits
        let collect_profits = {
            let last_profit_collection = self.last_profit_collection.lock().unwrap();
            match *last_profit_collection {
                Some(time) => time.elapsed() >= self.config.profit_collection_interval,
                None => true,
            }
        };
        
        if collect_profits {
            self.collect_profits()?;
            
            // Update last profit collection time
            let mut last_profit_collection = self.last_profit_collection.lock().unwrap();
            *last_profit_collection = Some(Instant::now());
        }
        
        // Update historical balances
        if self.config.track_historical_balances {
            self.update_historical_balances()?;
        }
        
        // Auto-fund trading wallets if needed
        if self.config.auto_fund_trading_wallets {
            self.check_and_fund_trading_wallets()?;
        }
        
        Ok(())
    }
    
    /// Initialize wallet statuses
    fn initialize_wallet_statuses(&self) -> Result<(), Box<dyn Error>> {
        println!("Initializing wallet statuses...");
        
        let mut wallet_statuses = self.wallet_statuses.lock().unwrap();
        
        // Add system wallet
        wallet_statuses.insert(
            self.config.system_wallet.clone(),
            WalletStatus {
                address: self.config.system_wallet.clone(),
                label: "System Wallet".to_string(),
                status: "active".to_string(),
                balances: HashMap::new(),
                total_value_usd: 0.0,
                last_transaction: None,
                last_updated: current_timestamp(),
                transaction_count: 0,
                agent_id: None,
            },
        );
        
        // Add trading wallets
        for (agent_id, address) in &self.config.trading_wallets {
            wallet_statuses.insert(
                address.clone(),
                WalletStatus {
                    address: address.clone(),
                    label: format!("{} Trading Wallet", agent_id),
                    status: "active".to_string(),
                    balances: HashMap::new(),
                    total_value_usd: 0.0,
                    last_transaction: None,
                    last_updated: current_timestamp(),
                    transaction_count: 0,
                    agent_id: Some(agent_id.clone()),
                },
            );
        }
        
        // Add profit wallets
        for (agent_id, address) in &self.config.profit_wallets {
            wallet_statuses.insert(
                address.clone(),
                WalletStatus {
                    address: address.clone(),
                    label: format!("{} Profit Wallet", agent_id),
                    status: "active".to_string(),
                    balances: HashMap::new(),
                    total_value_usd: 0.0,
                    last_transaction: None,
                    last_updated: current_timestamp(),
                    transaction_count: 0,
                    agent_id: Some(agent_id.clone()),
                },
            );
        }
        
        // Add fee wallets
        for (agent_id, address) in &self.config.fee_wallets {
            wallet_statuses.insert(
                address.clone(),
                WalletStatus {
                    address: address.clone(),
                    label: format!("{} Fee Wallet", agent_id),
                    status: "active".to_string(),
                    balances: HashMap::new(),
                    total_value_usd: 0.0,
                    last_transaction: None,
                    last_updated: current_timestamp(),
                    transaction_count: 0,
                    agent_id: Some(agent_id.clone()),
                },
            );
        }
        
        Ok(())
    }
    
    /// Update token prices
    fn update_token_prices(&self) -> Result<(), Box<dyn Error>> {
        println!("Updating token prices...");
        
        let mut token_prices = self.token_prices.lock().unwrap();
        
        // In a real implementation, this would fetch token prices from APIs
        // For now, we'll just add some example prices
        
        token_prices.insert("SOL".to_string(), 150.0);
        token_prices.insert("USDC".to_string(), 1.0);
        token_prices.insert("USDT".to_string(), 1.0);
        token_prices.insert("ETH".to_string(), 3000.0);
        token_prices.insert("BTC".to_string(), 50000.0);
        token_prices.insert("BONK".to_string(), 0.00003);
        token_prices.insert("JUP".to_string(), 1.3);
        token_prices.insert("RAY".to_string(), 1.5);
        
        Ok(())
    }
    
    /// Update wallet statuses
    fn update_wallet_statuses(&self) -> Result<(), Box<dyn Error>> {
        println!("Updating wallet statuses...");
        
        let mut wallet_statuses = self.wallet_statuses.lock().unwrap();
        let token_prices = self.token_prices.lock().unwrap();
        
        for (address, status) in wallet_statuses.iter_mut() {
            // Fetch wallet balances (mock implementation)
            let balances = self.fetch_wallet_balances(address)?;
            
            // Calculate total USD value
            let mut total_value_usd = 0.0;
            
            for (token, balance) in &balances {
                if let Some(price) = token_prices.get(token) {
                    total_value_usd += balance.amount * price;
                }
            }
            
            // Update wallet status
            status.balances = balances;
            status.total_value_usd = total_value_usd;
            status.last_updated = current_timestamp();
            
            // Get recent transactions
            let recent_transactions = self.fetch_recent_transactions(address)?;
            
            // Update transaction count
            status.transaction_count += recent_transactions.len();
            
            // Update last transaction
            if let Some(tx) = recent_transactions.first() {
                status.last_transaction = Some(tx.clone());
            }
            
            // Check for low balance
            if let Some(sol_balance) = status.balances.get("SOL") {
                if sol_balance.amount < self.config.critical_balance_threshold {
                    // Create critical alert
                    self.create_alert(
                        address,
                        AlertLevel::Critical,
                        format!("Critical balance: {} SOL", sol_balance.amount),
                        None,
                    )?;
                } else if sol_balance.amount < self.config.low_balance_threshold {
                    // Create warning alert
                    self.create_alert(
                        address,
                        AlertLevel::Warning,
                        format!("Low balance: {} SOL", sol_balance.amount),
                        None,
                    )?;
                }
            }
            
            // Notify subscribers
            self.notify_wallet_update(status.clone());
        }
        
        Ok(())
    }
    
    /// Fetch wallet balances
    fn fetch_wallet_balances(&self, address: &str) -> Result<HashMap<String, TokenBalance>, Box<dyn Error>> {
        println!("Fetching balances for wallet: {}", address);
        
        // In a real implementation, this would fetch balances from the blockchain
        // For now, we'll just add some example balances
        
        let mut balances = HashMap::new();
        
        if address == &self.config.system_wallet {
            // System wallet has SOL and USDC
            balances.insert(
                "SOL".to_string(),
                TokenBalance {
                    token: "SOL".to_string(),
                    amount: 10.5,
                    usd_value: 10.5 * 150.0,
                    last_updated: current_timestamp(),
                },
            );
            
            balances.insert(
                "USDC".to_string(),
                TokenBalance {
                    token: "USDC".to_string(),
                    amount: 5000.0,
                    usd_value: 5000.0,
                    last_updated: current_timestamp(),
                },
            );
        } else if self.config.trading_wallets.values().any(|a| a == address) {
            // Trading wallets have SOL
            balances.insert(
                "SOL".to_string(),
                TokenBalance {
                    token: "SOL".to_string(),
                    amount: 1.5,
                    usd_value: 1.5 * 150.0,
                    last_updated: current_timestamp(),
                },
            );
        } else if self.config.profit_wallets.values().any(|a| a == address) {
            // Profit wallets have SOL and USDC
            balances.insert(
                "SOL".to_string(),
                TokenBalance {
                    token: "SOL".to_string(),
                    amount: 0.5,
                    usd_value: 0.5 * 150.0,
                    last_updated: current_timestamp(),
                },
            );
            
            balances.insert(
                "USDC".to_string(),
                TokenBalance {
                    token: "USDC".to_string(),
                    amount: 200.0,
                    usd_value: 200.0,
                    last_updated: current_timestamp(),
                },
            );
        } else if self.config.fee_wallets.values().any(|a| a == address) {
            // Fee wallets have SOL
            balances.insert(
                "SOL".to_string(),
                TokenBalance {
                    token: "SOL".to_string(),
                    amount: 0.2,
                    usd_value: 0.2 * 150.0,
                    last_updated: current_timestamp(),
                },
            );
        }
        
        Ok(balances)
    }
    
    /// Fetch recent transactions
    fn fetch_recent_transactions(&self, address: &str) -> Result<Vec<WalletTransaction>, Box<dyn Error>> {
        println!("Fetching recent transactions for wallet: {}", address);
        
        // In a real implementation, this would fetch transactions from the blockchain
        // For now, we'll just add some example transactions
        
        let mut transactions = Vec::new();
        
        if address == &self.config.system_wallet {
            // System wallet has a profit collection transaction
            transactions.push(WalletTransaction {
                id: format!("tx-{}", current_timestamp()),
                wallet_address: address.to_string(),
                signature: format!("sig-{:x}", rand::random::<u64>()),
                timestamp: current_timestamp() - 3600,
                amount: 0.5,
                token: "SOL".to_string(),
                transaction_type: TransactionType::ProfitCollection,
                description: "Collected profits from trading wallets".to_string(),
                fee: 0.000005,
                related_addresses: vec![
                    self.config.profit_wallets.get("hyperion").unwrap().clone(),
                    self.config.profit_wallets.get("quantum_omega").unwrap().clone(),
                ],
                agent_id: None,
                status: "confirmed".to_string(),
                block_number: 123456789,
                is_profit: true,
            });
        } else if self.config.trading_wallets.values().any(|a| a == address) {
            // Trading wallets have trade transactions
            transactions.push(WalletTransaction {
                id: format!("tx-{}", current_timestamp()),
                wallet_address: address.to_string(),
                signature: format!("sig-{:x}", rand::random::<u64>()),
                timestamp: current_timestamp() - 1800,
                amount: 0.1,
                token: "SOL".to_string(),
                transaction_type: TransactionType::Trade,
                description: "Executed trade on Jupiter".to_string(),
                fee: 0.000005,
                related_addresses: vec![
                    "Jupiter DEX".to_string(),
                ],
                agent_id: self.config.trading_wallets.iter()
                    .find(|(_, a)| a == &address)
                    .map(|(id, _)| id.clone()),
                status: "confirmed".to_string(),
                block_number: 123456790,
                is_profit: false,
            });
        }
        
        Ok(transactions)
    }
    
    /// Create an alert
    fn create_alert(
        &self,
        wallet_address: &str,
        level: AlertLevel,
        message: String,
        related_transaction: Option<String>,
    ) -> Result<(), Box<dyn Error>> {
        if !self.config.enable_alerts {
            return Ok(());
        }
        
        println!("Creating alert for wallet {}: {:?} - {}", wallet_address, level, message);
        
        let alert = WalletAlert {
            id: format!("alert-{}", current_timestamp()),
            wallet_address: wallet_address.to_string(),
            timestamp: current_timestamp(),
            level,
            message,
            acknowledged: false,
            resolved: false,
            resolution_message: None,
            related_transaction,
        };
        
        let mut alerts = self.alerts.lock().unwrap();
        
        // Add alert
        alerts.push_back(alert.clone());
        
        // Limit alerts
        while alerts.len() > self.config.max_alerts {
            alerts.pop_front();
        }
        
        // Notify subscribers
        self.notify_alert(alert);
        
        Ok(())
    }
    
    /// Collect profits
    fn collect_profits(&self) -> Result<(), Box<dyn Error>> {
        println!("Collecting profits...");
        
        let wallet_statuses = self.wallet_statuses.lock().unwrap();
        
        for (agent_id, profit_address) in &self.config.profit_wallets {
            if let Some(status) = wallet_statuses.get(profit_address) {
                // Check if profit wallet has enough SOL
                if let Some(sol_balance) = status.balances.get("SOL") {
                    if sol_balance.amount >= self.config.min_profit_collection_amount {
                        // Collect profits
                        println!("Collecting {} SOL profit from {} agent", sol_balance.amount, agent_id);
                        
                        // In a real implementation, this would actually transfer the SOL
                        // For now, we'll just create a profit record
                        
                        let profit_record = ProfitRecord {
                            id: format!("profit-{}", current_timestamp()),
                            agent_id: agent_id.clone(),
                            timestamp: current_timestamp(),
                            amount: sol_balance.amount,
                            token: "SOL".to_string(),
                            usd_value: sol_balance.amount * 150.0, // Assuming SOL price is $150
                            transaction_signature: format!("sig-{:x}", rand::random::<u64>()),
                            strategy_name: format!("{} Strategy", agent_id),
                            execution_time: 5000, // 5 seconds
                            gas_cost: 0.000005,
                            profit_percentage: 2.5,
                        };
                        
                        let mut profits = self.profits.lock().unwrap();
                        profits.push(profit_record.clone());
                        
                        // Create transaction record
                        let transaction = WalletTransaction {
                            id: format!("tx-{}", current_timestamp()),
                            wallet_address: profit_address.clone(),
                            signature: profit_record.transaction_signature.clone(),
                            timestamp: current_timestamp(),
                            amount: sol_balance.amount,
                            token: "SOL".to_string(),
                            transaction_type: TransactionType::ProfitCollection,
                            description: format!("Collected profits from {} agent", agent_id),
                            fee: profit_record.gas_cost,
                            related_addresses: vec![
                                self.config.system_wallet.clone(),
                            ],
                            agent_id: Some(agent_id.clone()),
                            status: "confirmed".to_string(),
                            block_number: 123456791,
                            is_profit: true,
                        };
                        
                        let mut transactions = self.transactions.lock().unwrap();
                        transactions.push_back(transaction.clone());
                        
                        // Limit transactions
                        while transactions.len() > self.config.max_transaction_history {
                            transactions.pop_front();
                        }
                        
                        // Notify subscribers
                        self.notify_transaction(transaction);
                        self.notify_profit(profit_record);
                    }
                }
            }
        }
        
        Ok(())
    }
    
    /// Update historical balances
    fn update_historical_balances(&self) -> Result<(), Box<dyn Error>> {
        println!("Updating historical balances...");
        
        let wallet_statuses = self.wallet_statuses.lock().unwrap();
        let mut historical_balances = self.historical_balances.lock().unwrap();
        
        for (address, status) in wallet_statuses.iter() {
            if !historical_balances.contains_key(address) {
                historical_balances.insert(address.clone(), Vec::new());
            }
            
            let wallet_history = historical_balances.get_mut(address).unwrap();
            
            // Create balance snapshot
            let current_time = current_timestamp();
            let mut balance_snapshot = HashMap::new();
            
            for (token, balance) in &status.balances {
                balance_snapshot.insert(token.clone(), balance.amount);
            }
            
            // Add snapshot to history
            wallet_history.push((current_time, balance_snapshot));
            
            // Check if we need to keep history
            let now = Instant::now();
            let mut to_keep = Vec::new();
            
            for interval in &self.config.historical_balance_intervals {
                let interval_secs = interval.as_secs();
                let mut latest_in_interval = None;
                
                for (i, (timestamp, _)) in wallet_history.iter().enumerate().rev() {
                    let age = current_time - timestamp;
                    if age < interval_secs {
                        latest_in_interval = Some(i);
                        break;
                    }
                }
                
                if let Some(index) = latest_in_interval {
                    to_keep.push(index);
                }
            }
            
            // Keep only snapshots we need
            to_keep.sort();
            to_keep.dedup();
            
            let mut new_history = Vec::new();
            for i in to_keep {
                new_history.push(wallet_history[i].clone());
            }
            
            *wallet_history = new_history;
        }
        
        Ok(())
    }
    
    /// Check and fund trading wallets
    fn check_and_fund_trading_wallets(&self) -> Result<(), Box<dyn Error>> {
        println!("Checking and funding trading wallets...");
        
        let wallet_statuses = self.wallet_statuses.lock().unwrap();
        
        // Check system wallet balance
        let system_status = wallet_statuses.get(&self.config.system_wallet).unwrap();
        
        if let Some(system_sol) = system_status.balances.get("SOL") {
            // Iterate through trading wallets
            for (agent_id, address) in &self.config.trading_wallets {
                if let Some(status) = wallet_statuses.get(address) {
                    // Check if trading wallet needs funding
                    if let Some(sol_balance) = status.balances.get("SOL") {
                        if sol_balance.amount < self.config.trading_wallet_minimum_balance {
                            let funding_amount = self.config.trading_wallet_minimum_balance - sol_balance.amount;
                            
                            // Check if system wallet has enough SOL
                            if system_sol.amount >= funding_amount + 0.1 { // Keep 0.1 SOL in system wallet
                                // Fund trading wallet
                                println!("Funding {} trading wallet with {} SOL", agent_id, funding_amount);
                                
                                // In a real implementation, this would actually transfer the SOL
                                // For now, we'll just create a transaction record
                                
                                let transaction = WalletTransaction {
                                    id: format!("tx-{}", current_timestamp()),
                                    wallet_address: self.config.system_wallet.clone(),
                                    signature: format!("sig-{:x}", rand::random::<u64>()),
                                    timestamp: current_timestamp(),
                                    amount: funding_amount,
                                    token: "SOL".to_string(),
                                    transaction_type: TransactionType::Transfer,
                                    description: format!("Funded {} trading wallet", agent_id),
                                    fee: 0.000005,
                                    related_addresses: vec![
                                        address.clone(),
                                    ],
                                    agent_id: Some(agent_id.clone()),
                                    status: "confirmed".to_string(),
                                    block_number: 123456792,
                                    is_profit: false,
                                };
                                
                                let mut transactions = self.transactions.lock().unwrap();
                                transactions.push_back(transaction.clone());
                                
                                // Limit transactions
                                while transactions.len() > self.config.max_transaction_history {
                                    transactions.pop_front();
                                }
                                
                                // Notify subscribers
                                self.notify_transaction(transaction);
                            } else {
                                // Create alert
                                self.create_alert(
                                    &self.config.system_wallet,
                                    AlertLevel::Warning,
                                    format!("Insufficient balance to fund {} trading wallet", agent_id),
                                    None,
                                )?;
                            }
                        }
                    }
                }
            }
        }
        
        Ok(())
    }
    
    /// Subscribe to wallet updates
    pub fn subscribe_wallet_updates<F>(&self, callback: F)
    where
        F: Fn(WalletStatus) + Send + Sync + 'static,
    {
        let mut subscribers = self.subscribers.lock().unwrap();
        subscribers.push(Box::new(callback));
    }
    
    /// Subscribe to alerts
    pub fn subscribe_alerts<F>(&self, callback: F)
    where
        F: Fn(WalletAlert) + Send + Sync + 'static,
    {
        let mut subscribers = self.alert_subscribers.lock().unwrap();
        subscribers.push(Box::new(callback));
    }
    
    /// Subscribe to transactions
    pub fn subscribe_transactions<F>(&self, callback: F)
    where
        F: Fn(WalletTransaction) + Send + Sync + 'static,
    {
        let mut subscribers = self.transaction_subscribers.lock().unwrap();
        subscribers.push(Box::new(callback));
    }
    
    /// Subscribe to profits
    pub fn subscribe_profits<F>(&self, callback: F)
    where
        F: Fn(ProfitRecord) + Send + Sync + 'static,
    {
        let mut subscribers = self.profit_subscribers.lock().unwrap();
        subscribers.push(Box::new(callback));
    }
    
    /// Notify wallet update
    fn notify_wallet_update(&self, status: WalletStatus) {
        let subscribers = self.subscribers.lock().unwrap();
        for subscriber in subscribers.iter() {
            subscriber(status.clone());
        }
    }
    
    /// Notify alert
    fn notify_alert(&self, alert: WalletAlert) {
        let subscribers = self.alert_subscribers.lock().unwrap();
        for subscriber in subscribers.iter() {
            subscriber(alert.clone());
        }
    }
    
    /// Notify transaction
    fn notify_transaction(&self, transaction: WalletTransaction) {
        let subscribers = self.transaction_subscribers.lock().unwrap();
        for subscriber in subscribers.iter() {
            subscriber(transaction.clone());
        }
    }
    
    /// Notify profit
    fn notify_profit(&self, profit: ProfitRecord) {
        let subscribers = self.profit_subscribers.lock().unwrap();
        for subscriber in subscribers.iter() {
            subscriber(profit.clone());
        }
    }
    
    /// Get all wallet statuses
    pub fn get_wallet_statuses(&self) -> HashMap<String, WalletStatus> {
        self.wallet_statuses.lock().unwrap().clone()
    }
    
    /// Get a specific wallet status
    pub fn get_wallet_status(&self, address: &str) -> Option<WalletStatus> {
        let wallet_statuses = self.wallet_statuses.lock().unwrap();
        wallet_statuses.get(address).cloned()
    }
    
    /// Get all transactions
    pub fn get_transactions(&self) -> VecDeque<WalletTransaction> {
        self.transactions.lock().unwrap().clone()
    }
    
    /// Get all alerts
    pub fn get_alerts(&self) -> VecDeque<WalletAlert> {
        self.alerts.lock().unwrap().clone()
    }
    
    /// Get all profits
    pub fn get_profits(&self) -> Vec<ProfitRecord> {
        self.profits.lock().unwrap().clone()
    }
    
    /// Get profit metrics
    pub fn get_profit_metrics(&self) -> HashMap<String, HashMap<String, f64>> {
        let profits = self.profits.lock().unwrap();
        
        let mut metrics = HashMap::new();
        
        // Calculate metrics per agent
        for (agent_id, _) in &self.config.trading_wallets {
            let mut agent_metrics = HashMap::new();
            
            let agent_profits: Vec<_> = profits.iter()
                .filter(|p| p.agent_id == *agent_id)
                .collect();
            
            // Total profit
            let total_profit_usd = agent_profits.iter()
                .map(|p| p.usd_value)
                .sum();
            
            agent_metrics.insert("total_profit_usd".to_string(), total_profit_usd);
            
            // Average profit
            let avg_profit_usd = if !agent_profits.is_empty() {
                total_profit_usd / agent_profits.len() as f64
            } else {
                0.0
            };
            
            agent_metrics.insert("avg_profit_usd".to_string(), avg_profit_usd);
            
            // Total gas cost
            let total_gas_cost = agent_profits.iter()
                .map(|p| p.gas_cost)
                .sum();
            
            agent_metrics.insert("total_gas_cost".to_string(), total_gas_cost);
            
            // Profit percentage
            let avg_profit_percentage = if !agent_profits.is_empty() {
                agent_profits.iter()
                    .map(|p| p.profit_percentage)
                    .sum::<f64>() / agent_profits.len() as f64
            } else {
                0.0
            };
            
            agent_metrics.insert("avg_profit_percentage".to_string(), avg_profit_percentage);
            
            // Add to metrics
            metrics.insert(agent_id.clone(), agent_metrics);
        }
        
        metrics
    }
    
    /// Acknowledge an alert
    pub fn acknowledge_alert(&self, alert_id: &str) -> Result<(), Box<dyn Error>> {
        let mut alerts = self.alerts.lock().unwrap();
        
        for alert in alerts.iter_mut() {
            if alert.id == alert_id {
                alert.acknowledged = true;
                return Ok(());
            }
        }
        
        Err(Box::new(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            format!("Alert {} not found", alert_id),
        )))
    }
    
    /// Resolve an alert
    pub fn resolve_alert(&self, alert_id: &str, resolution_message: String) -> Result<(), Box<dyn Error>> {
        let mut alerts = self.alerts.lock().unwrap();
        
        for alert in alerts.iter_mut() {
            if alert.id == alert_id {
                alert.resolved = true;
                alert.resolution_message = Some(resolution_message);
                return Ok(());
            }
        }
        
        Err(Box::new(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            format!("Alert {} not found", alert_id),
        )))
    }
}

/// Create a new wallet monitor
pub fn create_wallet_monitor() -> WalletMonitor {
    WalletMonitor::new(SystemWalletConfig::default())
}