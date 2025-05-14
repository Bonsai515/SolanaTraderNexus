// Parallel Processing Module for Quantum HitSquad Nexus Professional Engine
// Utilizes Rayon and Tokio for high-performance parallel execution

use rayon::prelude::*;
use tokio::sync::{mpsc, Mutex};
use tokio::task::JoinSet;
use std::sync::Arc;
use std::collections::HashMap;
use std::time::Duration;
use log::{debug, info, warn, error};

use crate::transaction::Transaction;

// Number of worker threads for CPU-bound operations
pub const RAYON_THREAD_COUNT: usize = 8;

// Number of worker threads for IO-bound operations
pub const TOKIO_THREAD_COUNT: usize = 32;

// Initialize parallel processing environment
pub fn init_parallel_processing() {
    // Configure Rayon thread pool for optimal CPU-bound operations
    rayon::ThreadPoolBuilder::new()
        .num_threads(RAYON_THREAD_COUNT)
        .thread_name(|i| format!("rayon-worker-{}", i))
        .build_global()
        .expect("Failed to initialize Rayon thread pool");
    
    debug!("Initialized Rayon thread pool with {} threads", RAYON_THREAD_COUNT);
}

// Process multiple transactions in parallel using Rayon
pub fn process_transactions_parallel(transactions: Vec<Transaction>) -> Vec<Result<String, String>> {
    info!("Processing {} transactions in parallel", transactions.len());
    
    // Use Rayon's parallel iterator to process all transactions concurrently
    let results: Vec<_> = transactions.par_iter()
        .map(|tx| {
            match tx.execute() {
                Ok(result) => Ok(result.signature),
                Err(err) => Err(format!("Transaction failed: {}", err)),
            }
        })
        .collect();
        
    info!("Completed parallel processing of {} transactions", transactions.len());
    results
}

// Execute asynchronous operations with Tokio
pub async fn execute_async_operations<T, F, Fut>(
    items: Vec<T>,
    operation: F,
    concurrency_limit: usize,
) -> Vec<Result<String, String>>
where
    T: Send + 'static,
    F: Fn(T) -> Fut + Send + Sync + 'static,
    Fut: std::future::Future<Output = Result<String, String>> + Send + 'static,
{
    let operation = Arc::new(operation);
    let (tx, mut rx) = mpsc::channel(concurrency_limit);
    let mut set = JoinSet::new();
    let results = Arc::new(Mutex::new(Vec::with_capacity(items.len())));

    // Process items with limited concurrency
    for (i, item) in items.into_iter().enumerate() {
        let op = Arc::clone(&operation);
        let results_clone = Arc::clone(&results);
        let tx_clone = tx.clone();
        
        set.spawn(async move {
            let result = op(item).await;
            
            // Store result in the shared results vector
            let mut results = results_clone.lock().await;
            results.push((i, result));
            
            // Signal completion
            let _ = tx_clone.send(()).await;
        });
        
        // Limit concurrency
        if set.len() >= concurrency_limit {
            let _ = rx.recv().await;
        }
    }
    
    // Drop sender to close channel after all tasks are spawned
    drop(tx);
    
    // Wait for all tasks to complete
    while let Some(res) = set.join_next().await {
        if let Err(e) = res {
            error!("Task join error: {}", e);
        }
    }
    
    // Sort results by their original indices
    let mut final_results = Arc::try_unwrap(results)
        .expect("Failed to unwrap Arc")
        .into_inner();
    
    final_results.sort_by_key(|(idx, _)| *idx);
    final_results.into_iter().map(|(_, result)| result).collect()
}

// Parallel price feed processing
pub fn process_price_feeds_parallel(tokens: Vec<String>) -> HashMap<String, f64> {
    let results: HashMap<String, f64> = tokens.par_iter()
        .filter_map(|token| {
            match get_token_price(token) {
                Ok(price) => Some((token.clone(), price)),
                Err(_) => None,
            }
        })
        .collect();
    
    results
}

// Simulate getting a token price - this would call the actual price API in production
fn get_token_price(token: &str) -> Result<f64, String> {
    // Simulate some work by sleeping for a short time
    std::thread::sleep(Duration::from_millis(5));
    
    // Return dummy prices for some common tokens
    match token.to_uppercase().as_str() {
        "SOL" => Ok(145.87),
        "USDC" => Ok(1.0),
        "BONK" => Ok(0.00000234),
        "WIF" => Ok(1.84),
        "JUP" => Ok(0.76),
        "GUAC" => Ok(0.001181),
        "MEME" => Ok(0.0366),
        _ => Ok(0.5) // Default price for unknown tokens
    }
}