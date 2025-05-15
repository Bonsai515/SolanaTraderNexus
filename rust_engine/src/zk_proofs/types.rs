// Zero-Knowledge Proof Type Definitions
//
// This module defines the types used in the ZK proof system for trading signals.

use serde::{Serialize, Deserialize};
use uuid::Uuid;

/// ZK Proof Protocol Version
pub const ZK_PROOF_VERSION: u32 = 1;

/// ZK Proof Scheme types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum ZkProofScheme {
    /// Groth16 proof scheme
    Groth16,
    
    /// Bulletproofs scheme
    Bulletproofs,
    
    /// Custom scheme optimized for model verification
    QuantumResistant,
}

impl std::fmt::Display for ZkProofScheme {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ZkProofScheme::Groth16 => write!(f, "Groth16"),
            ZkProofScheme::Bulletproofs => write!(f, "Bulletproofs"),
            ZkProofScheme::QuantumResistant => write!(f, "QuantumResistant"),
        }
    }
}

/// ZK Proof containing the verification data for a signal
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ZkProof {
    /// Unique identifier for this proof
    pub id: Uuid,
    
    /// The proof scheme used
    pub scheme: ZkProofScheme,
    
    /// The proof data (base64 encoded)
    pub proof_data: String,
    
    /// Public inputs for verification (base64 encoded)
    pub public_inputs: String,
    
    /// Protocol version
    pub version: u32,
    
    /// Associated signal ID
    pub signal_id: String,
    
    /// Timestamp of proof generation
    pub timestamp: i64,
    
    /// Signature of the prover
    pub signature: String,
}

impl ZkProof {
    /// Create a new ZK proof with default protocol version
    pub fn new(scheme: ZkProofScheme, proof_data: String, public_inputs: String, signal_id: String) -> Self {
        use chrono::Utc;
        
        Self {
            id: Uuid::new_v4(),
            scheme,
            proof_data,
            public_inputs,
            version: ZK_PROOF_VERSION,
            signal_id,
            timestamp: Utc::now().timestamp(),
            signature: String::new(), // To be filled by the prover
        }
    }
    
    /// Sign this proof with the prover's key
    pub fn sign(&mut self, private_key: &[u8]) -> Result<(), Box<dyn std::error::Error>> {
        // In a real implementation, this would use actual cryptographic signatures
        // For now, we'll use a placeholder
        let signature_base = format!(
            "{}:{}:{}:{}",
            self.id,
            self.signal_id,
            self.proof_data,
            self.timestamp
        );
        
        // Simple signing simulation for now
        let mut hasher = blake3::Hasher::new();
        hasher.update(signature_base.as_bytes());
        hasher.update(private_key);
        
        self.signature = base64::encode(hasher.finalize().as_bytes());
        Ok(())
    }
    
    /// Verify the proof signature
    pub fn verify_signature(&self, public_key: &[u8]) -> bool {
        // In a real implementation, this would verify the cryptographic signature
        // For now, we'll return true for simulation
        true
    }
}

/// Public verification parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ZkVerificationParameters {
    /// Verification key (base64 encoded)
    pub verification_key: String,
    
    /// Protocol version
    pub version: u32,
    
    /// Proof scheme
    pub scheme: ZkProofScheme,
}

/// Error types for ZK operations
#[derive(Debug, thiserror::Error)]
pub enum ZkProofError {
    #[error("Invalid proof data")]
    InvalidProof,
    
    #[error("Invalid verification parameters")]
    InvalidParameters,
    
    #[error("Failed to generate proof: {0}")]
    ProofGenerationFailed(String),
    
    #[error("Failed to verify proof: {0}")]
    VerificationFailed(String),
    
    #[error("Serialization error: {0}")]
    SerializationError(String),
    
    #[error("Unsupported proof scheme: {0}")]
    UnsupportedScheme(String),
    
    #[error("Invalid signature")]
    InvalidSignature,
}

/// Trading model weights representation (opaque to preserve privacy)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelWeights {
    /// Model identifier
    pub model_id: String,
    
    /// Model version
    pub version: String,
    
    /// Opaque representation of weights (encrypted/hashed)
    pub weights_hash: String,
}

/// Result of a ZK proof verification
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ZkVerificationResult {
    /// Whether the proof was verified successfully
    pub valid: bool,
    
    /// The scheme used
    pub scheme: ZkProofScheme,
    
    /// Associated signal ID
    pub signal_id: String,
    
    /// If verification failed, the reason
    pub error_message: Option<String>,
    
    /// Verification timestamp
    pub timestamp: i64,
}

impl ZkVerificationResult {
    /// Create a new successful verification result
    pub fn success(scheme: ZkProofScheme, signal_id: String) -> Self {
        use chrono::Utc;
        
        Self {
            valid: true,
            scheme,
            signal_id,
            error_message: None,
            timestamp: Utc::now().timestamp(),
        }
    }
    
    /// Create a new failed verification result
    pub fn failure(scheme: ZkProofScheme, signal_id: String, error: &str) -> Self {
        use chrono::Utc;
        
        Self {
            valid: false,
            scheme,
            signal_id,
            error_message: Some(error.to_string()),
            timestamp: Utc::now().timestamp(),
        }
    }
}