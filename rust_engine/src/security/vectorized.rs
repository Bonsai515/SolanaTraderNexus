use rayon::prelude::*;
use serde::{Serialize, Deserialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityCheck {
    score: f32,
    details: String
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityCheckResult {
    token: String,
    timestamp: u64,
    security_score: f32,
    checks: HashMap<String, SecurityCheck>,
    warnings: Vec<String>
}

/// Perform vectorized security checks on multiple tokens in parallel
///
/// # Arguments
/// * `tokens` - A vector of token symbols to check
///
/// # Returns
/// A vector of security check results
pub fn vectorized_security_checks(tokens: Vec<String>) -> Vec<SecurityCheckResult> {
    // Process all tokens in parallel using Rayon
    tokens.par_iter()
        .map(|token| perform_security_check(token))
        .collect()
}

/// Perform a security check for a single token
///
/// # Arguments
/// * `token` - Token symbol to check
///
/// # Returns
/// Security check result
fn perform_security_check(token: &str) -> SecurityCheckResult {
    // Get current timestamp in milliseconds
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;
    
    // Perform different security checks in parallel
    let (liquidity, contract, volatility, front_running) = rayon::join(
        || check_liquidity(token),
        || check_contract(token),
        || check_volatility(token),
        || check_front_running(token)
    );
    
    // Create checks map
    let mut checks = HashMap::new();
    checks.insert("liquidity".to_string(), liquidity);
    checks.insert("contract".to_string(), contract);
    checks.insert("volatility".to_string(), volatility);
    checks.insert("frontRunning".to_string(), front_running);
    
    // Calculate security score
    let security_score = calculate_security_score(&[
        liquidity.score,
        contract.score,
        volatility.score,
        front_running.score
    ]);
    
    // Generate warnings
    let warnings = generate_warnings(&checks);
    
    SecurityCheckResult {
        token: token.to_string(),
        timestamp,
        security_score,
        checks,
        warnings
    }
}

/// Check liquidity for a token
fn check_liquidity(token: &str) -> SecurityCheck {
    // Simulate liquidity check
    // In a real system, this would query actual liquidity data
    let score = match token {
        "SOL" => 0.95,
        "USDC" => 0.99,
        "ETH" => 0.98,
        "BNB" => 0.92,
        _ => 0.7 // Default for other tokens
    };
    
    SecurityCheck {
        score,
        details: format!("{} liquidity level", if score > 0.9 { "High" } else { "Medium" })
    }
}

/// Check contract security for a token
fn check_contract(token: &str) -> SecurityCheck {
    // Simulate contract security check
    // In a real system, this would analyze the token's contract
    let score = match token {
        "SOL" => 0.9,
        "USDC" => 0.95,
        "ETH" => 0.93,
        "BNB" => 0.89,
        _ => 0.6 // Default for other tokens
    };
    
    SecurityCheck {
        score,
        details: format!("{} contract security", if score > 0.9 { "High" } else { "Medium" })
    }
}

/// Check volatility for a token
fn check_volatility(token: &str) -> SecurityCheck {
    // Simulate volatility check
    // In a real system, this would compute actual volatility metrics
    let score = match token {
        "SOL" => 0.7,
        "USDC" => 0.99,
        "ETH" => 0.8,
        "BNB" => 0.75,
        _ => 0.5 // Default for other tokens
    };
    
    SecurityCheck {
        score,
        details: format!("{} volatility", 
            if score > 0.9 { "Very low" } 
            else if score > 0.7 { "Low" } 
            else if score > 0.5 { "Medium" }
            else { "High" }
        )
    }
}

/// Check front-running vulnerability for a token
fn check_front_running(token: &str) -> SecurityCheck {
    // Simulate front-running vulnerability check
    // In a real system, this would analyze transaction patterns
    let score = match token {
        "SOL" => 0.85,
        "USDC" => 0.98,
        "ETH" => 0.87,
        "BNB" => 0.84,
        _ => 0.7 // Default for other tokens
    };
    
    SecurityCheck {
        score,
        details: format!("{} front-running risk", 
            if score > 0.9 { "Very low" } 
            else if score > 0.8 { "Low" } 
            else if score > 0.6 { "Medium" }
            else { "High" }
        )
    }
}

/// Calculate overall security score based on individual check scores
fn calculate_security_score(scores: &[f32]) -> f32 {
    if scores.is_empty() {
        return 0.0;
    }
    
    let sum: f32 = scores.iter().sum();
    sum / scores.len() as f32
}

/// Generate warning messages based on security checks
fn generate_warnings(checks: &HashMap<String, SecurityCheck>) -> Vec<String> {
    let mut warnings = Vec::new();
    
    if let Some(check) = checks.get("liquidity") {
        if check.score < 0.5 {
            warnings.push(format!("Low liquidity detected ({})", check.score));
        }
    }
    
    if let Some(check) = checks.get("contract") {
        if check.score < 0.6 {
            warnings.push(format!("Contract security concerns detected ({})", check.score));
        }
    }
    
    if let Some(check) = checks.get("volatility") {
        if check.score < 0.4 {
            warnings.push(format!("High volatility detected ({})", check.score));
        }
    }
    
    if let Some(check) = checks.get("frontRunning") {
        if check.score < 0.7 {
            warnings.push(format!("Front-running vulnerability detected ({})", check.score));
        }
    }
    
    warnings
}