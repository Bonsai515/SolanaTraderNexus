// Quantum Engine for Strategy Registration and Execution
// Provides hooks for quantum execution within the Nexus Professional Engine

use std::sync::Arc;
use tokio::sync::Mutex;
use std::time::{Duration, SystemTime};
use std::collections::HashMap;
use log::{debug, info, warn, error};
use async_trait::async_trait;

use crate::transaction::Transaction;
use crate::timewarp::TimeWarpManager;
use crate::quantum::{
    QuantumPredictor, 
    QuantumFlashOperator, 
    QuantumMevResurrector,
    MarketSnapshot
};
use crate::hyperion_quantum::{
    NexusExecutor,
    QuantumNuclear,
    QuantumFeeStrategy,
    StrategyState
};
use crate::quantum_execution::{
    QuantumMarketState,
    QuantumCircuitBreaker,
    QuantumExecutionPipeline,
    QuantumNuclearBoxed,
    QuantumNuclearStrategy
};
use crate::quantum_integration::{
    AgentSkills,
    EnhancedQuantumFeeStrategy,
    QuantumErrorHandler
};
use crate::strategy::{
    FlashLoanArbitrageStrategy,
    MomentumSurfingStrategy
};

// Strategy Registry for managing quantum strategies
pub struct StrategyRegistry {
    strategies: Vec<QuantumNuclearBoxed>,
    active_strategy_ids: Vec<String>,
    nexus: Arc<NexusExecutor>,
    time_warp_manager: Arc<Mutex<TimeWarpManager>>,
}

impl StrategyRegistry {
    pub fn new(nexus: Arc<NexusExecutor>, time_warp_manager: Arc<Mutex<TimeWarpManager>>) -> Self {
        StrategyRegistry {
            strategies: Vec::new(),
            active_strategy_ids: Vec::new(),
            nexus,
            time_warp_manager,
        }
    }
    
    // Register a quantum strategy
    pub fn register(&mut self, strategy: QuantumNuclearBoxed, strategy_id: &str) {
        self.strategies.push(strategy);
        self.active_strategy_ids.push(strategy_id.to_string());
        info!("Registered quantum strategy: {}", strategy_id);
    }
    
    // Get all registered strategies
    pub fn get_strategies(&self) -> &Vec<QuantumNuclearBoxed> {
        &self.strategies
    }
    
    // Get mutable strategies
    pub fn get_strategies_mut(&mut self) -> &mut Vec<QuantumNuclearBoxed> {
        &mut self.strategies
    }
    
    // Get all strategy IDs
    pub fn get_strategy_ids(&self) -> &Vec<String> {
        &self.active_strategy_ids
    }
    
    // Activate a strategy by ID
    pub fn activate_strategy(&mut self, strategy_id: &str) -> bool {
        if let Some(index) = self.active_strategy_ids.iter().position(|id| id == strategy_id) {
            if index < self.strategies.len() {
                self.strategies[index].set_state(StrategyState::Active);
                info!("Activated quantum strategy: {}", strategy_id);
                return true;
            }
        }
        
        warn!("Strategy not found: {}", strategy_id);
        false
    }
    
    // Deactivate a strategy by ID
    pub fn deactivate_strategy(&mut self, strategy_id: &str) -> bool {
        if let Some(index) = self.active_strategy_ids.iter().position(|id| id == strategy_id) {
            if index < self.strategies.len() {
                self.strategies[index].set_state(StrategyState::Paused);
                info!("Deactivated quantum strategy: {}", strategy_id);
                return true;
            }
        }
        
        warn!("Strategy not found: {}", strategy_id);
        false
    }
    
    // Remove a strategy by ID
    pub fn remove_strategy(&mut self, strategy_id: &str) -> bool {
        if let Some(index) = self.active_strategy_ids.iter().position(|id| id == strategy_id) {
            self.active_strategy_ids.remove(index);
            self.strategies.remove(index);
            info!("Removed quantum strategy: {}", strategy_id);
            return true;
        }
        
        warn!("Strategy not found: {}", strategy_id);
        false
    }
}

// Execution Engine for running quantum strategies
pub struct QuantumExecutionEngine {
    registry: StrategyRegistry,
    circuit_breaker: Arc<Mutex<QuantumCircuitBreaker>>,
    capital: f64,
    profits: HashMap<String, f64>,
    execution_history: Vec<(SystemTime, String, f64)>,
    fee_strategy: EnhancedQuantumFeeStrategy,
}

impl QuantumExecutionEngine {
    pub fn new(
        nexus: Arc<NexusExecutor>, 
        time_warp_manager: Arc<Mutex<TimeWarpManager>>,
        initial_capital: f64
    ) -> Self {
        // Create strategy registry
        let registry = StrategyRegistry::new(nexus.clone(), time_warp_manager.clone());
        
        // Create circuit breaker
        let circuit_breaker = Arc::new(Mutex::new(QuantumCircuitBreaker::new()));
        
        // Create fee strategy with default quantum predictor
        let predictor = Arc::new(crate::quantum::HyperionQuantumPredictor::new(time_warp_manager));
        let fee_strategy = EnhancedQuantumFeeStrategy::new(nexus.clone(), predictor);
        
        QuantumExecutionEngine {
            registry,
            circuit_breaker,
            capital: initial_capital,
            profits: HashMap::new(),
            execution_history: Vec::new(),
            fee_strategy,
        }
    }
    
    // Get strategy registry
    pub fn get_registry(&self) -> &StrategyRegistry {
        &self.registry
    }
    
    // Get mutable strategy registry
    pub fn get_registry_mut(&mut self) -> &mut StrategyRegistry {
        &mut self.registry
    }
    
    // Set capital amount
    pub fn set_capital(&mut self, amount: f64) {
        self.capital = amount;
    }
    
    // Get current capital
    pub fn get_capital(&self) -> f64 {
        self.capital
    }
    
    // Execute quantum strategies
    pub async fn quantum_hook(&mut self) -> Result<f64, String> {
        info!("Running quantum execution hook with capital: ${:.2}", self.capital);
        
        // Create execution pipeline
        let pipeline = QuantumExecutionPipeline {
            strategies: self.registry.strategies.clone(),
            nexus: self.registry.nexus.clone(),
            circuit_breaker: self.circuit_breaker.clone(),
            peak_capital: self.capital,
            nexus_fee_rate: 0.001, // 0.1% fee
            profit_history: Vec::new(),
        };
        
        // Run pipeline
        match pipeline.run(self.capital).await {
            Ok(result) => {
                let profit = result - self.capital;
                
                // Update capital
                self.capital = result;
                
                // Record execution history
                self.execution_history.push((SystemTime::now(), "quantum_hook".to_string(), profit));
                
                // Limit history to 1000 entries
                if self.execution_history.len() > 1000 {
                    self.execution_history.remove(0);
                }
                
                info!("Quantum execution hook completed with profit: ${:.2}", profit);
                Ok(profit)
            },
            Err(e) => {
                error!("Quantum execution hook failed: {}", e);
                Err(e)
            }
        }
    }
    
    // Register a quantum nuclear strategy from agent skills
    pub fn register_nuclear_strategy<A: AgentSkillsProvider>(
        &mut self,
        agent: &A,
        strategy_id: &str
    ) -> Result<(), String> {
        let skills = agent.get_skills();
        
        // Get quantum components from skills
        let predictor = match skills.get_quantum_predictor() {
            Some(p) => p,
            None => return Err("Agent does not have quantum predictor skill".to_string()),
        };
        
        let flash = match skills.get_quantum_flash() {
            Some(f) => f,
            None => return Err("Agent does not have quantum flash skill".to_string()),
        };
        
        let mev = match skills.get_mev_resurrector() {
            Some(m) => m,
            None => return Err("Agent does not have MEV resurrector skill".to_string()),
        };
        
        // Create Quantum Nuclear strategy
        let nuclear_strat = QuantumNuclear::new(
            predictor,
            flash,
            mev,
            self.registry.nexus.clone()
        );
        
        // Create boxed strategy adapter
        let boxed_strategy = create_nuclear_adapter(nuclear_strat);
        
        // Register strategy
        self.registry.register(boxed_strategy, strategy_id);
        
        Ok(())
    }
    
    // Get profits by strategy
    pub fn get_profits(&self) -> &HashMap<String, f64> {
        &self.profits
    }
    
    // Get execution history
    pub fn get_execution_history(&self) -> &Vec<(SystemTime, String, f64)> {
        &self.execution_history
    }
    
    // Reset circuit breaker
    pub async fn reset_circuit_breaker(&self) {
        let mut circuit_breaker = self.circuit_breaker.lock().await;
        circuit_breaker.reset();
    }
}

// Agent Skills Provider trait
pub trait AgentSkillsProvider {
    fn get_skills(&self) -> &AgentSkills;
}

// Implementation for FlashLoanArbitrageStrategy
impl AgentSkillsProvider for FlashLoanArbitrageStrategy {
    fn get_skills(&self) -> &AgentSkills {
        &self.skills
    }
}

// Extended AgentSkills functionality
impl AgentSkills {
    // Get quantum predictor
    pub fn get_quantum_predictor(&self) -> Option<Arc<dyn QuantumPredictor + Send + Sync>> {
        if let Some(adapter) = &self.quantum_adapter {
            Some(Arc::new(adapter.clone()))
        } else {
            None
        }
    }
    
    // Get quantum flash operator
    pub fn get_quantum_flash(&self) -> Option<Arc<dyn QuantumFlashOperator + Send + Sync>> {
        if let Some(adapter) = &self.quantum_adapter {
            Some(Arc::new(adapter.clone()))
        } else {
            None
        }
    }
    
    // Get MEV resurrector
    pub fn get_mev_resurrector(&self) -> Option<Arc<dyn QuantumMevResurrector + Send + Sync>> {
        self.mev_resurrector.clone()
    }
}

// Helper function to create a nuclear strategy adapter
fn create_nuclear_adapter<P, F, M>(
    nuclear: QuantumNuclear<P, F, M>
) -> QuantumNuclearBoxed 
where
    P: QuantumPredictor + Send + Sync + 'static,
    F: QuantumFlashOperator + Send + Sync + 'static,
    M: QuantumMevResurrector + Send + Sync + 'static
{
    Box::new(NuclearStrategyAdapter::new(nuclear))
}

// Adapter for QuantumNuclear to QuantumNuclearStrategy
pub struct NuclearStrategyAdapter<P, F, M> 
where
    P: QuantumPredictor + Send + Sync,
    F: QuantumFlashOperator + Send + Sync,
    M: QuantumMevResurrector + Send + Sync
{
    nuclear: QuantumNuclear<P, F, M>,
}

impl<P, F, M> NuclearStrategyAdapter<P, F, M> 
where
    P: QuantumPredictor + Send + Sync,
    F: QuantumFlashOperator + Send + Sync,
    M: QuantumMevResurrector + Send + Sync
{
    pub fn new(nuclear: QuantumNuclear<P, F, M>) -> Self {
        NuclearStrategyAdapter {
            nuclear,
        }
    }
}

#[async_trait]
impl<P, F, M> QuantumNuclearStrategy for NuclearStrategyAdapter<P, F, M> 
where
    P: QuantumPredictor + Send + Sync,
    F: QuantumFlashOperator + Send + Sync,
    M: QuantumMevResurrector + Send + Sync
{
    async fn execute_cycle(&mut self, capital: f64) -> Result<f64, String> {
        self.nuclear.execute_cycle(capital).await
    }
    
    fn risk_factor(&self) -> f64 {
        0.8 // High risk factor for nuclear strategies
    }
    
    fn get_state(&self) -> StrategyState {
        *self.nuclear.get_state()
    }
    
    fn set_state(&mut self, state: StrategyState) {
        match state {
            StrategyState::Active => self.nuclear.start(),
            StrategyState::Paused => self.nuclear.pause(),
            StrategyState::Terminated => self.nuclear.terminate(),
            _ => {} // No action for Initialized state
        }
    }
}

// Helper function to register strategies and create execution hook
pub async fn setup_quantum_execution_system(
    time_warp_manager: Arc<Mutex<TimeWarpManager>>,
    nexus_url: &str,
    agents: &mut [&mut FlashLoanArbitrageStrategy],
    initial_capital: f64
) -> QuantumExecutionEngine {
    // Create quantum execution engine
    let mut engine = QuantumExecutionEngine::new(
        Arc::new(NexusExecutor::new(nexus_url)),
        time_warp_manager.clone(),
        initial_capital
    );
    
    // Register strategies from agents
    for (i, agent) in agents.iter_mut().enumerate() {
        // Ensure agent has quantum skills
        if agent.get_skills().has_skill("quantum_prediction") {
            match engine.register_nuclear_strategy(*agent, &format!("agent_{}_nuclear", i)) {
                Ok(_) => info!("Registered nuclear strategy for agent {}", i),
                Err(e) => warn!("Failed to register nuclear strategy for agent {}: {}", i, e),
            }
        } else {
            warn!("Agent {} does not have quantum skills, skipping", i);
        }
    }
    
    // Activate all registered strategies
    for id in engine.get_registry().get_strategy_ids().clone() {
        engine.get_registry_mut().activate_strategy(&id);
    }
    
    engine
}