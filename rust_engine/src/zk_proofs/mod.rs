// Zero-Knowledge Proof Module for Signal Verification
//
// This module implements zero-knowledge proofs for verifying trading signal validity
// without revealing the underlying model weights, parameters, or proprietary algorithms.

mod prover;
mod verifier;
mod types;

pub use prover::*;
pub use verifier::*;
pub use types::*;

// Re-export the main functions for easier access
pub use prover::generate_zk_proof;
pub use verifier::verify_zk_proof;