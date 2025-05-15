use rayon::prelude::*;
use std::f32::consts::PI;
use std::sync::Arc;
use std::collections::HashMap;

/// Quantum Fourier Transform implementation
pub struct QFT {
    /// Size of the transform
    size: usize,
}

impl QFT {
    /// Create a new Quantum Fourier Transform
    pub fn new(size: usize) -> Self {
        Self { size }
    }
    
    /// Apply QFT to a time series
    pub fn apply(&self, time_series: &[f32]) -> Vec<f32> {
        let n = time_series.len();
        let mut output = vec![0.0; n];
        
        // QFT leverages complex numbers for increased efficiency
        output.par_iter_mut().enumerate().for_each(|(k, out)| {
            let mut sum_real = 0.0;
            let mut sum_imag = 0.0;
            
            for j in 0..n {
                let angle = 2.0 * PI * (j as f32) * (k as f32) / (n as f32);
                sum_real += time_series[j] * angle.cos();
                sum_imag -= time_series[j] * angle.sin();
            }
            
            // Calculate magnitude using quantum-inspired probability calculation
            *out = (sum_real * sum_real + sum_imag * sum_imag).sqrt() / (n as f32).sqrt();
        });
        
        output
    }
    
    /// Apply inverse QFT to frequency domain data
    pub fn apply_inverse(&self, freq_domain: &[f32]) -> Vec<f32> {
        let n = freq_domain.len();
        let mut output = vec![0.0; n];
        
        output.par_iter_mut().enumerate().for_each(|(j, out)| {
            let mut sum_real = 0.0;
            let mut sum_imag = 0.0;
            
            for k in 0..n {
                let angle = 2.0 * PI * (j as f32) * (k as f32) / (n as f32);
                sum_real += freq_domain[k] * angle.cos();
                sum_imag += freq_domain[k] * angle.sin();
            }
            
            *out = (sum_real * sum_real + sum_imag * sum_imag).sqrt() / (n as f32).sqrt();
        });
        
        output
    }
    
    /// Find dominant frequencies in the price data
    pub fn find_dominant_frequencies(&self, time_series: &[f32], num_freqs: usize) -> Vec<(usize, f32)> {
        let spectrum = self.apply(time_series);
        
        // Create index-value pairs
        let mut indexed_spectrum: Vec<(usize, f32)> = spectrum
            .iter()
            .enumerate()
            .map(|(i, &val)| (i, val))
            .collect();
        
        // Sort by magnitude in descending order
        indexed_spectrum.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
        
        // Take top frequencies
        indexed_spectrum.truncate(num_freqs);
        
        indexed_spectrum
    }
    
    /// Calculate period from frequency index
    pub fn period_from_frequency(&self, freq_idx: usize, n: usize) -> f32 {
        if freq_idx == 0 {
            return f32::INFINITY; // DC component has infinite period
        }
        n as f32 / freq_idx as f32
    }
    
    /// Analyze price series for cyclical patterns
    pub fn analyze_cycles(&self, time_series: &[f32], min_confidence: f32) -> Vec<(f32, f32)> {
        // Get dominant frequencies
        let dominant = self.find_dominant_frequencies(time_series, 5);
        
        // Convert to periods with confidence
        dominant
            .into_iter()
            .filter(|(idx, magnitude)| *idx > 0 && *magnitude >= min_confidence) // Skip DC component
            .map(|(idx, magnitude)| {
                let period = self.period_from_frequency(idx, time_series.len());
                (period, magnitude)
            })
            .collect()
    }
}