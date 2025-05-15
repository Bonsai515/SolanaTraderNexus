//! Quantum algorithms for accelerated trading and optimization
//! 
//! This module provides quantum-inspired algorithms for trading system acceleration:
//! - Quantum attention mechanisms for finding relationships in price data
//! - Quantum walks for volatility prediction with superior accuracy 
//! - Grover's search for finding optimal arbitrage paths in sqrt(N) time
//! - TEE protection for secure, side-channel resistant computation
//! - Quantum Fourier Transform (QFT) for detecting cyclical patterns
//! - Quantum SGD for enhanced neural network optimization with tunneling
//! - Quantum token entanglement for correlated trade execution
//! - Quantum dark pools for hidden liquidity
//! - HHL algorithm for solving market correlation matrices
//! - Quantum Phase Estimation (QPE) for market regime detection
//! - Variational Quantum Eigensolver (VQE) for portfolio optimization
//! - Quantum Approximate Optimization Algorithm (QAOA) for trading path optimization
//! - Quantum Neural Networks (QNN) for enhanced market prediction

pub mod attention;
pub mod tee;
pub mod fourier;
pub mod qsgd;
pub mod entanglement;
pub mod darkpool;
pub mod hhl;
pub mod phase_estimation;
pub mod vqe;
pub mod qaoa;
pub mod qnn;

pub use attention::{QWeight, QuantumAttention, SuperpositionLayer, QWalker, GroverSearch};
pub use tee::TeeMemory;
pub use fourier::QFT;
pub use qsgd::{QSGD, QuantumHamiltonian};
pub use entanglement::{QuantumEntanglement, EntanglementRegistry, BellState};
pub use darkpool::{DarkPool, ShadowVault, DarkPoolRegistry};
pub use hhl::{HHL, MarketPortfolioOptimizer, Matrix, Vector};
pub use phase_estimation::{QuantumPhaseEstimation, MarketRegimePredictor, Complex};
pub use vqe::{VQE, Pauli};
pub use qaoa::{QAOA, Graph};
pub use qnn::{QNN, QNNLayer, QuantumWeight, ActivationFunction, MarketPredictionQNN};