use uuid::Uuid;
use chrono::{DateTime, Utc};
use rand::{thread_rng, Rng};
use log::debug;

/// Generate a random UUID
pub fn generate_id() -> Uuid {
    Uuid::new_v4()
}

/// Format a Solana balance in SOL
pub fn format_sol_amount(amount: f64) -> String {
    format!("{:.2} SOL", amount)
}

/// Shorten an address for display
pub fn shorten_address(address: &str, chars: usize) -> String {
    if address.len() <= chars * 2 {
        return address.to_string();
    }
    
    let start = &address[..chars];
    let end = &address[address.len() - chars..];
    format!("{}...{}", start, end)
}

/// Generate a fancier random seed with some quantum-inspired noise
pub fn quantum_inspired_random_seed() -> u64 {
    let mut rng = thread_rng();
    
    // Basic random seed
    let seed: u64 = rng.gen();
    
    // Add some "quantum noise" (simulated, of course)
    let mut quantum_noise = 0u64;
    for _ in 0..8 {
        let bit = rng.gen_bool(0.5) as u64;
        quantum_noise = (quantum_noise << 1) | bit;
    }
    
    // Combine seed with quantum noise
    let enhanced_seed = seed ^ quantum_noise;
    debug!("Generated quantum-inspired random seed: {}", enhanced_seed);
    
    enhanced_seed
}

/// Apply quantum-inspired noise reduction to data
/// This is just a simulation of the concept
pub fn apply_quantum_noise_reduction<T: Into<f64> + From<f64>>(value: T, intensity: f64) -> T {
    let float_value: f64 = value.into();
    let mut rng = thread_rng();
    
    // Apply tiny random adjustments to simulate "quantum" precision
    let noise = rng.gen_range(-0.001..0.001) * intensity;
    let adjusted = float_value * (1.0 + noise);
    
    T::from(adjusted)
}