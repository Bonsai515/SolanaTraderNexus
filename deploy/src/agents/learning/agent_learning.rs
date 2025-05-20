use std::sync::{Arc, Mutex, RwLock};
use std::collections::{HashMap, VecDeque};
use std::time::{Duration, Instant};
use log::{info, warn, error, debug};
use anyhow::{Result, anyhow};
use serde::{Serialize, Deserialize};
use uuid::Uuid;

use crate::agents::agent_manager::{AgentType, AgentState, ExecutionResult};

/// Maximum size of execution history to store for learning
const MAX_HISTORY_SIZE: usize = 1000;

/// Learning factor - how quickly we adapt to new data (0-1)
/// Lower values are more conservative, higher values adapt more quickly
const LEARNING_FACTOR: f64 = 0.2;

/// Confidence threshold for learning
const MIN_CONFIDENCE_THRESHOLD: f64 = 0.6;

/// Strategy metrics for performance analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StrategyMetrics {
    pub strategy_id: String,
    pub pair: Option<String>,
    pub executions: u32,
    pub success_rate: f64,
    pub avg_profit: f64,
    pub avg_execution_time: u64,
    pub last_updated: chrono::DateTime<chrono::Utc>,
    pub success_by_time: HashMap<String, f64>,  // hour -> success_rate
    pub profit_by_time: HashMap<String, f64>,   // hour -> avg_profit
    pub performance_by_dex: HashMap<String, f64>, // dex -> success_rate
}

/// Learning insight from execution history
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LearningInsight {
    pub id: String,
    pub agent_type: AgentType,
    pub strategy_id: String,
    pub pair: Option<String>, 
    pub insight_type: InsightType,
    pub confidence: f64,
    pub description: String,
    pub recommendation: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub applied: bool,
    pub result: Option<InsightResult>,
}

/// Type of learning insight
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum InsightType {
    TimeBasedExecution,
    PairPerformance,
    DexPreference,
    FailurePattern,
    ProfitOptimization,
    RiskManagement,
}

/// Result of applying an insight
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InsightResult {
    pub applied_at: chrono::DateTime<chrono::Utc>,
    pub success: bool,
    pub performance_delta: f64,
    pub notes: String,
}

/// Agent learning system that analyzes performance and generates insights
pub struct AgentLearningSystem {
    execution_history: RwLock<VecDeque<ExecutionResult>>,
    strategy_metrics: RwLock<HashMap<String, StrategyMetrics>>,
    insights: RwLock<Vec<LearningInsight>>,
    last_analysis: Mutex<Instant>,
    analysis_interval: Duration,
}

impl AgentLearningSystem {
    /// Create a new agent learning system
    pub fn new() -> Self {
        Self {
            execution_history: RwLock::new(VecDeque::with_capacity(MAX_HISTORY_SIZE)),
            strategy_metrics: RwLock::new(HashMap::new()),
            insights: RwLock::new(Vec::new()),
            last_analysis: Mutex::new(Instant::now()),
            analysis_interval: Duration::from_secs(300), // Analyze every 5 minutes
        }
    }
    
    /// Add an execution result to the learning system
    pub fn add_execution_result(&self, result: ExecutionResult) {
        // Add to history
        let mut history = self.execution_history.write().unwrap();
        
        // If we're at capacity, remove the oldest item
        if history.len() >= MAX_HISTORY_SIZE {
            history.pop_front();
        }
        
        // Add new result
        history.push_back(result.clone());
        
        // Update metrics for the strategy
        self.update_strategy_metrics(&result);
        
        // Check if we should run analysis
        let mut last_analysis = self.last_analysis.lock().unwrap();
        if last_analysis.elapsed() >= self.analysis_interval {
            // Reset timer
            *last_analysis = Instant::now();
            
            // Run analysis in background
            let learning_system = self.clone();
            tokio::spawn(async move {
                if let Err(e) = learning_system.analyze_and_generate_insights() {
                    error!("Failed to analyze and generate insights: {}", e);
                }
            });
        }
    }
    
    /// Update metrics for a specific strategy
    fn update_strategy_metrics(&self, result: &ExecutionResult) {
        let mut metrics = self.strategy_metrics.write().unwrap();
        
        // Create a unique key for this strategy
        let strategy_key = if let Some(pair) = &result.pair {
            format!("{}_{}", result.strategy, pair)
        } else {
            result.strategy.clone()
        };
        
        // Get or create metrics for this strategy
        let strategy_metrics = metrics.entry(strategy_key.clone()).or_insert_with(|| {
            StrategyMetrics {
                strategy_id: result.strategy.clone(),
                pair: result.pair.clone(),
                executions: 0,
                success_rate: 0.0,
                avg_profit: 0.0,
                avg_execution_time: 0,
                last_updated: chrono::Utc::now(),
                success_by_time: HashMap::new(),
                profit_by_time: HashMap::new(),
                performance_by_dex: HashMap::new(),
            }
        });
        
        // Update basic metrics
        strategy_metrics.executions += 1;
        
        // Update success rate with learning factor
        let new_success_rate = if result.success { 1.0 } else { 0.0 };
        strategy_metrics.success_rate = (1.0 - LEARNING_FACTOR) * strategy_metrics.success_rate + 
                                       LEARNING_FACTOR * new_success_rate;
        
        // Update average profit with learning factor
        strategy_metrics.avg_profit = (1.0 - LEARNING_FACTOR) * strategy_metrics.avg_profit + 
                                     LEARNING_FACTOR * result.profit;
        
        // Update average execution time with learning factor
        strategy_metrics.avg_execution_time = ((1.0 - LEARNING_FACTOR) * strategy_metrics.avg_execution_time as f64 + 
                                             LEARNING_FACTOR * result.execution_time_ms as f64) as u64;
        
        // Update time-based metrics
        let hour = result.timestamp.format("%H").to_string();
        
        let hour_success = strategy_metrics.success_by_time.entry(hour.clone()).or_insert(0.5);
        *hour_success = (1.0 - LEARNING_FACTOR) * *hour_success + 
                       LEARNING_FACTOR * if result.success { 1.0 } else { 0.0 };
        
        let hour_profit = strategy_metrics.profit_by_time.entry(hour).or_insert(0.0);
        *hour_profit = (1.0 - LEARNING_FACTOR) * *hour_profit + 
                      LEARNING_FACTOR * result.profit;
        
        // Update DEX performance if available
        if let Some(dex) = result.metrics.get("dex_used") {
            let dex_name = dex.to_string();
            let dex_perf = strategy_metrics.performance_by_dex.entry(dex_name).or_insert(0.5);
            *dex_perf = (1.0 - LEARNING_FACTOR) * *dex_perf + 
                       LEARNING_FACTOR * if result.success { 1.0 } else { 0.0 };
        }
        
        // Update timestamp
        strategy_metrics.last_updated = chrono::Utc::now();
    }
    
    /// Analyze execution data and generate insights
    pub fn analyze_and_generate_insights(&self) -> Result<Vec<LearningInsight>> {
        debug!("Analyzing execution history and generating insights");
        
        let mut new_insights = Vec::new();
        
        // Time-based execution insights
        if let Some(insight) = self.analyze_time_based_execution() {
            new_insights.push(insight);
        }
        
        // Pair performance insights
        if let Some(insight) = self.analyze_pair_performance() {
            new_insights.push(insight);
        }
        
        // DEX preference insights
        if let Some(insight) = self.analyze_dex_preference() {
            new_insights.push(insight);
        }
        
        // Failure pattern insights
        if let Some(insight) = self.analyze_failure_patterns() {
            new_insights.push(insight);
        }
        
        // Profit optimization insights
        if let Some(insight) = self.analyze_profit_optimization() {
            new_insights.push(insight);
        }
        
        // Store new insights
        if !new_insights.is_empty() {
            let mut insights = self.insights.write().unwrap();
            insights.extend(new_insights.clone());
            
            info!("Generated {} new insights from execution history", new_insights.len());
        }
        
        Ok(new_insights)
    }
    
    /// Get all generated insights
    pub fn get_insights(&self) -> Vec<LearningInsight> {
        self.insights.read().unwrap().clone()
    }
    
    /// Get insights for a specific agent
    pub fn get_insights_for_agent(&self, agent_type: AgentType) -> Vec<LearningInsight> {
        self.insights.read().unwrap().iter()
            .filter(|insight| insight.agent_type == agent_type)
            .cloned()
            .collect()
    }
    
    /// Mark an insight as applied
    pub fn apply_insight(&self, insight_id: &str, result: InsightResult) -> Result<()> {
        let mut insights = self.insights.write().unwrap();
        
        if let Some(insight) = insights.iter_mut().find(|i| i.id == insight_id) {
            insight.applied = true;
            insight.result = Some(result);
            Ok(())
        } else {
            Err(anyhow!("Insight with ID {} not found", insight_id))
        }
    }
    
    /// Analyze time-based execution patterns
    fn analyze_time_based_execution(&self) -> Option<LearningInsight> {
        let metrics = self.strategy_metrics.read().unwrap();
        
        // Find the strategy with enough executions
        let strategy_metrics = metrics.values()
            .filter(|m| m.executions >= 10)
            .max_by_key(|m| m.executions)?;
        
        // Find the best and worst hours
        let success_by_time = &strategy_metrics.success_by_time;
        
        if success_by_time.len() < 2 {
            return None;
        }
        
        let best_hour = success_by_time.iter()
            .max_by(|a, b| a.1.partial_cmp(b.1).unwrap_or(std::cmp::Ordering::Equal))?;
        
        let worst_hour = success_by_time.iter()
            .min_by(|a, b| a.1.partial_cmp(b.1).unwrap_or(std::cmp::Ordering::Equal))?;
        
        // Only generate insight if there's a significant difference
        if best_hour.1 - worst_hour.1 > 0.3 && *best_hour.1 > 0.6 {
            let confidence = (*best_hour.1 - *worst_hour.1) / 2.0 + 0.5;
            
            if confidence < MIN_CONFIDENCE_THRESHOLD {
                return None;
            }
            
            let strategy_name = &strategy_metrics.strategy_id;
            let pair_info = strategy_metrics.pair.as_ref()
                .map(|p| format!(" for {}", p))
                .unwrap_or_else(|| "".to_string());
            
            let description = format!(
                "Strategy '{}'{} performs best during hour {} ({}% success rate) and worst during hour {} ({}% success rate)",
                strategy_name, pair_info, best_hour.0, (*best_hour.1 * 100.0) as u32, 
                worst_hour.0, (*worst_hour.1 * 100.0) as u32
            );
            
            let recommendation = format!(
                "Consider scheduling {} executions to prioritize the {}:00 hour timeframe and reduce activity during {}:00",
                strategy_name, best_hour.0, worst_hour.0
            );
            
            Some(LearningInsight {
                id: Uuid::new_v4().to_string(),
                agent_type: AgentType::Hyperion, // Assuming Hyperion for now
                strategy_id: strategy_name.clone(),
                pair: strategy_metrics.pair.clone(),
                insight_type: InsightType::TimeBasedExecution,
                confidence,
                description,
                recommendation,
                created_at: chrono::Utc::now(),
                applied: false,
                result: None,
            })
        } else {
            None
        }
    }
    
    /// Analyze pair performance
    fn analyze_pair_performance(&self) -> Option<LearningInsight> {
        let metrics = self.strategy_metrics.read().unwrap();
        
        // Group metrics by strategy and find performance by pair
        let mut strategy_pairs: HashMap<String, Vec<(&StrategyMetrics, f64)>> = HashMap::new();
        
        for metric in metrics.values() {
            if let Some(pair) = &metric.pair {
                if metric.executions >= 5 {
                    let entry = strategy_pairs.entry(metric.strategy_id.clone()).or_insert_with(Vec::new);
                    entry.push((metric, metric.success_rate * metric.avg_profit));
                }
            }
        }
        
        // Find strategy with most pairs
        let (strategy, pairs) = strategy_pairs.iter()
            .filter(|(_, pairs)| pairs.len() >= 2)
            .max_by_key(|(_, pairs)| pairs.len())?;
        
        // Sort pairs by performance
        let mut sorted_pairs = pairs.clone();
        sorted_pairs.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
        
        // If we have a clear best performer
        if sorted_pairs.len() >= 2 && sorted_pairs[0].1 > sorted_pairs[1].1 * 1.5 {
            let best_pair = sorted_pairs[0].0.pair.as_ref()?;
            let confidence = (sorted_pairs[0].1 / sorted_pairs[1].1 - 1.0).min(0.95);
            
            if confidence < MIN_CONFIDENCE_THRESHOLD {
                return None;
            }
            
            let description = format!(
                "Strategy '{}' performs significantly better with {} pair ({}% better than next best pair)",
                strategy, best_pair, ((confidence) * 100.0) as u32
            );
            
            let recommendation = format!(
                "Prioritize the {} pair for '{}' strategy executions to maximize returns",
                best_pair, strategy
            );
            
            Some(LearningInsight {
                id: Uuid::new_v4().to_string(),
                agent_type: AgentType::Hyperion, // Assuming Hyperion for now
                strategy_id: strategy.clone(),
                pair: Some(best_pair.clone()),
                insight_type: InsightType::PairPerformance,
                confidence,
                description,
                recommendation,
                created_at: chrono::Utc::now(),
                applied: false,
                result: None,
            })
        } else {
            None
        }
    }
    
    /// Analyze DEX preferences
    fn analyze_dex_preference(&self) -> Option<LearningInsight> {
        let metrics = self.strategy_metrics.read().unwrap();
        
        // Find strategy with DEX performance data
        let strategy_with_dex = metrics.values()
            .filter(|m| !m.performance_by_dex.is_empty() && m.executions >= 10)
            .max_by_key(|m| m.performance_by_dex.len())?;
        
        let dex_perf = &strategy_with_dex.performance_by_dex;
        
        if dex_perf.len() < 2 {
            return None;
        }
        
        // Find best and worst DEX
        let best_dex = dex_perf.iter()
            .max_by(|a, b| a.1.partial_cmp(b.1).unwrap_or(std::cmp::Ordering::Equal))?;
        
        let worst_dex = dex_perf.iter()
            .min_by(|a, b| a.1.partial_cmp(b.1).unwrap_or(std::cmp::Ordering::Equal))?;
        
        // Only generate insight if there's a significant difference
        if best_dex.1 - worst_dex.1 > 0.2 && *best_dex.1 > 0.6 {
            let confidence = (*best_dex.1 - *worst_dex.1) / 2.0 + 0.5;
            
            if confidence < MIN_CONFIDENCE_THRESHOLD {
                return None;
            }
            
            let strategy_name = &strategy_with_dex.strategy_id;
            let pair_info = strategy_with_dex.pair.as_ref()
                .map(|p| format!(" for {}", p))
                .unwrap_or_else(|| "".to_string());
            
            let description = format!(
                "{} strategy{} has higher success rate with {} DEX ({}%) compared to {} DEX ({}%)",
                strategy_name, pair_info, best_dex.0, (*best_dex.1 * 100.0) as u32,
                worst_dex.0, (*worst_dex.1 * 100.0) as u32
            );
            
            let recommendation = format!(
                "Prioritize {} DEX for executions of {} strategy{}",
                best_dex.0, strategy_name, pair_info
            );
            
            Some(LearningInsight {
                id: Uuid::new_v4().to_string(),
                agent_type: AgentType::Hyperion, // Assuming Hyperion for now
                strategy_id: strategy_name.clone(),
                pair: strategy_with_dex.pair.clone(),
                insight_type: InsightType::DexPreference,
                confidence,
                description,
                recommendation,
                created_at: chrono::Utc::now(),
                applied: false,
                result: None,
            })
        } else {
            None
        }
    }
    
    /// Analyze failure patterns
    fn analyze_failure_patterns(&self) -> Option<LearningInsight> {
        let history = self.execution_history.read().unwrap();
        
        // Analyze the most recent failed executions
        let recent_failures: Vec<&ExecutionResult> = history.iter()
            .filter(|r| !r.success)
            .rev() // Most recent first
            .take(10)
            .collect();
        
        if recent_failures.len() < 3 {
            return None;
        }
        
        // Check for common error messages
        let mut error_counts: HashMap<String, u32> = HashMap::new();
        
        for result in &recent_failures {
            if let Some(error) = &result.error {
                // Extract the main error message (truncate after first period or at 50 chars)
                let main_error = if let Some(pos) = error.find('.') {
                    error[..pos].to_string()
                } else if error.len() > 50 {
                    error[..50].to_string()
                } else {
                    error.clone()
                };
                
                *error_counts.entry(main_error).or_insert(0) += 1;
            }
        }
        
        // Find most common error
        if let Some((common_error, count)) = error_counts.iter()
            .max_by_key(|(_, count)| **count) {
            
            // Only report if it represents a significant portion of failures
            if *count >= 3 && *count as f64 / recent_failures.len() as f64 >= 0.5 {
                let confidence = *count as f64 / recent_failures.len() as f64;
                
                if confidence < MIN_CONFIDENCE_THRESHOLD {
                    return None;
                }
                
                // Find the most affected strategy
                let strategy_failures: HashMap<String, u32> = recent_failures.iter()
                    .filter(|r| r.error.as_ref().map_or(false, |e| e.contains(common_error)))
                    .fold(HashMap::new(), |mut map, r| {
                        *map.entry(r.strategy.clone()).or_insert(0) += 1;
                        map
                    });
                
                let most_affected_strategy = strategy_failures.iter()
                    .max_by_key(|(_, count)| **count)?
                    .0;
                
                let description = format!(
                    "Identified recurring failure pattern: '{}' occurring in {}% of recent failed executions",
                    common_error, (confidence * 100.0) as u32
                );
                
                let recommendation = format!(
                    "Investigate and address the '{}' error in {} strategy to improve overall success rate",
                    common_error, most_affected_strategy
                );
                
                Some(LearningInsight {
                    id: Uuid::new_v4().to_string(),
                    agent_type: AgentType::Hyperion, // Assuming Hyperion for now
                    strategy_id: most_affected_strategy.clone(),
                    pair: None,
                    insight_type: InsightType::FailurePattern,
                    confidence,
                    description,
                    recommendation,
                    created_at: chrono::Utc::now(),
                    applied: false,
                    result: None,
                })
            } else {
                None
            }
        } else {
            None
        }
    }
    
    /// Analyze profit optimization opportunities
    fn analyze_profit_optimization(&self) -> Option<LearningInsight> {
        let metrics = self.strategy_metrics.read().unwrap();
        
        // Find the most profitable strategy
        let most_profitable = metrics.values()
            .filter(|m| m.executions >= 10 && m.success_rate > 0.6)
            .max_by(|a, b| a.avg_profit.partial_cmp(&b.avg_profit).unwrap_or(std::cmp::Ordering::Equal))?;
        
        // Is the profit significantly higher than others?
        let avg_profit = metrics.values()
            .filter(|m| m.executions >= 10 && m.strategy_id != most_profitable.strategy_id)
            .map(|m| m.avg_profit)
            .sum::<f64>() / metrics.values().filter(|m| m.executions >= 10 && m.strategy_id != most_profitable.strategy_id).count().max(1) as f64;
        
        if most_profitable.avg_profit > avg_profit * 1.5 && most_profitable.avg_profit > 0.0 {
            let profit_ratio = most_profitable.avg_profit / avg_profit;
            let confidence = (profit_ratio - 1.0).min(0.95);
            
            if confidence < MIN_CONFIDENCE_THRESHOLD {
                return None;
            }
            
            let strategy_name = &most_profitable.strategy_id;
            let pair_info = most_profitable.pair.as_ref()
                .map(|p| format!(" for {}", p))
                .unwrap_or_else(|| "".to_string());
            
            let description = format!(
                "{} strategy{} is {}% more profitable than other strategies with {:.2}% success rate",
                strategy_name, pair_info, 
                ((profit_ratio - 1.0) * 100.0) as u32,
                most_profitable.success_rate * 100.0
            );
            
            let recommendation = format!(
                "Allocate more resources to {} strategy{} and increase trade sizes to maximize overall profit",
                strategy_name, pair_info
            );
            
            Some(LearningInsight {
                id: Uuid::new_v4().to_string(),
                agent_type: AgentType::Hyperion, // Assuming Hyperion for now
                strategy_id: strategy_name.clone(),
                pair: most_profitable.pair.clone(),
                insight_type: InsightType::ProfitOptimization,
                confidence,
                description,
                recommendation,
                created_at: chrono::Utc::now(),
                applied: false,
                result: None,
            })
        } else {
            None
        }
    }
}

impl Clone for AgentLearningSystem {
    fn clone(&self) -> Self {
        // Create a new instance with empty collections
        let mut new_system = Self::new();
        
        // Clone execution history
        {
            let history = self.execution_history.read().unwrap();
            let mut new_history = new_system.execution_history.write().unwrap();
            *new_history = history.clone();
        }
        
        // Clone strategy metrics
        {
            let metrics = self.strategy_metrics.read().unwrap();
            let mut new_metrics = new_system.strategy_metrics.write().unwrap();
            *new_metrics = metrics.clone();
        }
        
        // Clone insights
        {
            let insights = self.insights.read().unwrap();
            let mut new_insights = new_system.insights.write().unwrap();
            *new_insights = insights.clone();
        }
        
        // Clone last analysis timestamp
        {
            let last_analysis = self.last_analysis.lock().unwrap();
            let mut new_last_analysis = new_system.last_analysis.lock().unwrap();
            *new_last_analysis = *last_analysis;
        }
        
        // Clone analysis interval
        new_system.analysis_interval = self.analysis_interval;
        
        new_system
    }
}