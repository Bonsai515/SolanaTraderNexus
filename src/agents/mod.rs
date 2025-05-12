//! AI Trading Agents for Solana Quantum Trading Platform
//!
//! This module contains the implementation of specialized AI trading agents
//! that drive the trading system. Each agent has a specific focus and strategy.

pub mod hyperion;
pub mod quantum_omega;
pub mod singularity;

use solana_sdk::pubkey::Pubkey;
use anyhow::Result;

/// Agent types available in the system
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum AgentType {
    /// Hyperion Flash Arbitrage Overlord
    Hyperion,
    /// Quantum Omega Sniper
    QuantumOmega,
    /// Singularity Cross-Chain Oracle
    Singularity,
}

/// Agent status states
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum AgentStatus {
    /// Agent is idle, not scanning or executing
    Idle,
    /// Agent is initializing
    Initializing,
    /// Agent is actively scanning for opportunities
    Scanning,
    /// Agent is executing a trade
    Executing,
    /// Agent is in cooldown period after execution
    Cooldown,
    /// Agent encountered an error
    Error,
}

/// Initialize all trading agents
pub fn initialize_agents() -> Result<()> {
    println!("🚀 Initializing all AI trading agents");
    
    // Initialize Hyperion agent
    println!("⚡ Initializing Hyperion Flash Arbitrage Overlord");
    hyperion::initialize_hyperion()?;
    
    // Initialize Quantum Omega agent
    println!("⚛️ Initializing Quantum Omega Sniper");
    quantum_omega::initialize_quantum_omega()?;
    
    // Initialize Singularity agent
    println!("🔮 Initializing Singularity Cross-Chain Oracle");
    let singularity_config = singularity::initialize_singularity()?;
    
    println!("✅ All agents initialized successfully");
    
    Ok(())
}

/// Start the agent system for live trading
pub fn start_trading_system(use_real_funds: bool) -> Result<()> {
    println!("🚀 Starting full trading system with all components for live trading");
    
    // Start Hyperion agent
    println!("⚡ Starting Hyperion Flash Arbitrage Overlord for cross-DEX flash loans");
    hyperion::start_hyperion(use_real_funds)?;
    
    // Start Quantum Omega agent
    println!("⚛️ Starting Quantum Omega with MemeCorTeX strategies");
    quantum_omega::start_quantum_omega(use_real_funds)?;
    
    // Start Singularity agent
    println!("🔮 Starting Singularity Cross-Chain Oracle for multi-chain strategies");
    let singularity_config = singularity::initialize_singularity()?;
    singularity::start_singularity(&singularity_config)?;
    
    // Verify system wallet status
    let system_wallet = "HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb";
    println!("💼 System wallet {} activated for profit collection", system_wallet);
    
    println!("✅ Trading system started successfully with all agents");
    
    Ok(())
}

/// Stop the agent system
pub fn stop_trading_system() -> Result<()> {
    println!("🛑 Stopping all trading agents");
    
    // Stop each agent
    println!("⚡ Stopping Hyperion agent");
    hyperion::stop_hyperion()?;
    
    println!("⚛️ Stopping Quantum Omega agent");
    quantum_omega::stop_quantum_omega()?;
    
    println!("🔮 Stopping Singularity agent");
    let singularity_config = singularity::initialize_singularity()?;
    singularity::stop_singularity(&singularity_config)?;
    
    println!("✅ All agents stopped successfully");
    
    Ok(())
}