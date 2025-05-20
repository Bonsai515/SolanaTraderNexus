use crate::models::{Strategy, StrategyType, FormattedStrategy, PerformanceInfo};
use crate::storage::Storage;
use anyhow::{Result, Context};
use log::{info, error, warn};
use std::sync::Arc;
use uuid::Uuid;
use rand::{Rng, seq::SliceRandom};

/// Strategy manager for creating and managing trading strategies
pub struct StrategyManager {
    storage: Arc<Storage>,
}

impl StrategyManager {
    /// Create a new strategy manager
    pub fn new(storage: Arc<Storage>) -> Self {
        Self { storage }
    }
    
    /// Get all strategies for a user
    pub async fn get_strategies_for_user(&self, user_id: Uuid) -> Result<Vec<Strategy>> {
        self.storage.get_strategies_by_user_id(user_id).await
    }
    
    /// Get all active strategies
    pub async fn get_active_strategies(&self) -> Result<Vec<Strategy>> {
        self.storage.get_active_strategies().await
    }
    
    /// Get a specific strategy
    pub async fn get_strategy(&self, id: Uuid) -> Result<Option<Strategy>> {
        self.storage.get_strategy(id).await
    }
    
    /// Create a new strategy
    pub async fn create_strategy(
        &self,
        user_id: Uuid,
        strategy_type: StrategyType,
    ) -> Result<Strategy> {
        // Get count of existing strategies of this type
        let strategies = self.storage.get_strategies_by_user_id(user_id).await?;
        let type_count = strategies.iter()
            .filter(|s| s.strategy_type == strategy_type)
            .count();
            
        // Generate name and description
        let name = generate_strategy_name(strategy_type, type_count);
        let description = generate_strategy_description(strategy_type);
        
        // Create the strategy with initial performance
        let strategy = self.storage.create_strategy(
            user_id,
            &name,
            Some(description),
            strategy_type,
            0.0, // Initial performance
            true, // Active by default
        ).await?;
        
        info!("Created new strategy: {} of type {:?}", name, strategy_type);
        Ok(strategy)
    }
    
    /// Toggle a strategy's active status
    pub async fn toggle_strategy(&self, id: Uuid) -> Result<Strategy> {
        // Get current strategy
        let strategy = self.storage.get_strategy(id).await?
            .ok_or_else(|| anyhow::anyhow!("Strategy not found: {}", id))?;
            
        // Toggle status
        let updated = self.storage.update_strategy_status(id, !strategy.is_active).await?
            .ok_or_else(|| anyhow::anyhow!("Strategy not found after update: {}", id))?;
            
        info!("Toggled strategy {}: active = {}", updated.name, updated.is_active);
        Ok(updated)
    }
    
    /// Format strategies for frontend display
    pub fn format_strategies(&self, strategies: Vec<Strategy>) -> Vec<FormattedStrategy> {
        strategies.into_iter().map(|strategy| {
            FormattedStrategy {
                id: strategy.id.to_string(),
                name: strategy.name,
                description: strategy.description.unwrap_or_default(),
                icon: get_strategy_icon(strategy.strategy_type),
                icon_color: get_strategy_color(strategy.strategy_type),
                performance: PerformanceInfo {
                    value: format!("{:.1}%", strategy.performance),
                    is_positive: strategy.performance >= 0.0,
                },
                is_active: strategy.is_active,
            }
        }).collect()
    }
}

/// Generate a strategy name based on type and count
fn generate_strategy_name(strategy_type: StrategyType, count: usize) -> String {
    let prefix = match strategy_type {
        StrategyType::Arbitrage => "Alpha",
        StrategyType::Momentum => "Beta",
        StrategyType::Liquidity => "Gamma",
    };
    
    format!("{}-{}", prefix, count + 1)
}

/// Generate a strategy description based on type
fn generate_strategy_description(strategy_type: StrategyType) -> String {
    match strategy_type {
        StrategyType::Arbitrage => 
            "Cross-DEX arbitrage opportunities using quantum-inspired price analysis".to_string(),
        StrategyType::Momentum => 
            "Momentum trading with advanced pattern recognition and trend analysis".to_string(),
        StrategyType::Liquidity => 
            "Liquidity provision and yield optimization with risk-adjusted returns".to_string(),
    }
}

/// Get strategy icon based on type
fn get_strategy_icon(strategy_type: StrategyType) -> String {
    match strategy_type {
        StrategyType::Arbitrage => "sync_alt".to_string(),
        StrategyType::Momentum => "trending_up".to_string(),
        StrategyType::Liquidity => "water_drop".to_string(),
    }
}

/// Get strategy color based on type
fn get_strategy_color(strategy_type: StrategyType) -> String {
    match strategy_type {
        StrategyType::Arbitrage => "info".to_string(),
        StrategyType::Momentum => "warning".to_string(),
        StrategyType::Liquidity => "success".to_string(),
    }
}