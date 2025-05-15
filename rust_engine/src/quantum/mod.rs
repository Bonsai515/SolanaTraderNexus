//! Quantum algorithms for accelerated trading and optimization
//! 
//! This module provides quantum-inspired algorithms for trading system acceleration:
//! - Quantum attention mechanisms for finding relationships in price data
//! - Quantum walks for volatility prediction with superior accuracy 
//! - Grover's search for finding optimal arbitrage paths in sqrt(N) time
//! - TEE protection for secure, side-channel resistant computation

pub mod attention;
pub mod tee;

pub use attention::{QWeight, QuantumAttention, SuperpositionLayer, QWalker, GroverSearch};
pub use tee::TeeMemory;