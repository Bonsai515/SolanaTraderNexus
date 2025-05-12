//! Transaction module for the Neural Nexus Solana Transaction Engine
//!
//! Defines the Transaction struct and related functionality

/// Transaction struct representing a Solana blockchain transaction
#[derive(Debug, Clone)]
pub struct Transaction {
    /// Unique identifier for the transaction
    pub id: String,
    /// Transaction type (e.g., "swap", "transfer", "flashloan")
    pub transaction_type: String,
    /// Transaction data as a JSON string
    pub data: String,
    /// Whether this is a simulation or real transaction
    pub is_simulation: bool,
    /// Transaction signature (if executed)
    pub signature: Option<String>,
}

impl Transaction {
    /// Create a new transaction
    pub fn new(id: String, transaction_type: String, data: String, is_simulation: bool) -> Self {
        Transaction {
            id,
            transaction_type,
            data,
            is_simulation,
            signature: None,
        }
    }
    
    /// Set the transaction signature
    pub fn set_signature(&mut self, signature: String) {
        self.signature = Some(signature);
    }
    
    /// Check if the transaction has been executed
    pub fn is_executed(&self) -> bool {
        self.signature.is_some()
    }
    
    /// Generate a simulated transaction for testing
    pub fn generate_test_transaction() -> Self {
        Transaction {
            id: uuid::Uuid::new_v4().to_string(),
            transaction_type: "swap".to_string(),
            data: r#"{"from":"SOL","to":"USDC","amount":1.0,"slippage":0.5}"#.to_string(),
            is_simulation: true,
            signature: None,
        }
    }
}