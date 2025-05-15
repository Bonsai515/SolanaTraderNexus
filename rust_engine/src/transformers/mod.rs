pub mod parallel;

// Re-export the parallel processing functions for easy access
pub use parallel::parallel_process;
pub use parallel::parallel_process_f32;
pub use parallel::parallel_process_prices;
pub use parallel::parallel_process_tokens;
pub use parallel::parallel_matrix_multiply;

/// Transformer module initialization
pub fn init() {
    // Initialize any transformer subsystems here
    println!("Initializing transformer module with parallel processing capabilities");
}