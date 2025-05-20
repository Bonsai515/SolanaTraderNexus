// Solana integration module

mod connection;
mod wallet_manager;
mod transaction_manager;

pub use connection::SolanaConnection;
pub use wallet_manager::{WalletManager, WalletError};
pub use transaction_manager::{TransactionManager, TransactionError};
pub use crate::models::Wallet;