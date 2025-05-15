use rayon::prelude::*;

/// Process data in parallel using Rayon's multi-threading capabilities
/// 
/// This function provides high-performance parallel processing for transformer data
/// by utilizing all available CPU cores simultaneously.
/// 
/// # Arguments
/// * `data` - A slice of i32 values to be processed
/// 
/// # Returns
/// * A Vec<i32> containing the processed results
pub fn parallel_process(data: &[i32]) -> Vec<i32> {
    data.par_iter().map(|x| x * 2).collect()
}

/// Process floating point data in parallel
/// 
/// Variant of parallel_process that works with f32 values, commonly used
/// for neural network activations and transformations.
/// 
/// # Arguments
/// * `data` - A slice of f32 values to be processed
/// * `transform_fn` - A function to apply to each element
/// 
/// # Returns
/// * A Vec<f32> containing the processed results
pub fn parallel_process_f32<F>(data: &[f32], transform_fn: F) -> Vec<f32> 
where 
    F: Fn(f32) -> f32 + Send + Sync,
{
    data.par_iter().map(|&x| transform_fn(x)).collect()
}

/// Process token price data in parallel
/// 
/// Specialized function for processing token price data with multi-threading.
/// 
/// # Arguments
/// * `prices` - A slice of price data points
/// * `weights` - Weighting factors for each price point
/// 
/// # Returns
/// * A Vec<f32> containing weighted price indicators
pub fn parallel_process_prices(prices: &[f32], weights: &[f32]) -> Vec<f32> {
    assert_eq!(prices.len(), weights.len(), "Price and weight arrays must have the same length");
    
    (0..prices.len())
        .into_par_iter()
        .map(|i| prices[i] * weights[i])
        .collect()
}

/// Process multiple token datasets simultaneously
/// 
/// Processes multiple token datasets in parallel, allowing for cross-token analysis
/// and high-throughput data processing.
/// 
/// # Arguments
/// * `token_datasets` - A vector of token data vectors
/// 
/// # Returns
/// * A vector of processed results for each token
pub fn parallel_process_tokens(token_datasets: Vec<Vec<f32>>) -> Vec<Vec<f32>> {
    token_datasets
        .par_iter()
        .map(|dataset| {
            // Process each dataset with its own parallel mapping
            dataset.par_iter().map(|&x| x * 1.5).collect()
        })
        .collect()
}

/// Neural network matrix multiplication in parallel
/// 
/// Performs matrix multiplication in parallel, optimized for neural network
/// forward passes in transformers.
/// 
/// # Arguments
/// * `input` - Input matrix as flattened vector with shape info
/// * `weights` - Weight matrix as flattened vector
/// * `input_size` - Size of input dimension
/// * `output_size` - Size of output dimension
/// 
/// # Returns
/// * Output activations as vector
pub fn parallel_matrix_multiply(
    input: &[f32], 
    weights: &[f32], 
    input_size: usize, 
    output_size: usize
) -> Vec<f32> {
    (0..output_size)
        .into_par_iter()
        .map(|o| {
            let offset = o * input_size;
            (0..input_size)
                .map(|i| input[i] * weights[offset + i])
                .sum()
        })
        .collect()
}