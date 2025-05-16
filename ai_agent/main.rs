use std::process::Command;
use std::fs;
use std::path::Path;
use std::time::{Duration, Instant};
use notify::{Watcher, RecursiveMode, watcher};
use std::sync::mpsc::channel;
use std::env;
use serde::{Deserialize, Serialize};
use serde_json::json;
use reqwest;

// Enhanced trading system repair agent with neural capabilities
struct QuantumRepairAgent {
    git_hash: String,
    last_healthy: Instant,
    system_status: SystemHealth,
    neural_cache: NeuralCache,
    perplexity_api_key: String,
    deepseek_api_key: String,
}

struct SystemHealth {
    is_healthy: bool,
    last_check: Instant,
    connected_services: Vec<String>,
    error_count: u32,
    last_error: Option<String>,
}

struct NeuralCache {
    last_fixes: Vec<RepairAction>,
    improvement_suggestions: Vec<String>,
    trading_performance: TradingMetrics,
}

#[derive(Debug, Clone)]
struct RepairAction {
    timestamp: Instant,
    file_path: String,
    error_type: String,
    fix_applied: String,
    successful: bool,
}

#[derive(Debug, Clone)]
struct TradingMetrics {
    total_trades: u32,
    successful_trades: u32,
    profit_sol: f64,
    last_updated: Instant,
}

// Response structures for AI API calls
#[derive(Serialize, Deserialize, Debug)]
struct PerplexityResponse {
    id: String,
    model: String,
    choices: Vec<PerplexityChoice>,
    usage: PerplexityUsage,
}

#[derive(Serialize, Deserialize, Debug)]
struct PerplexityChoice {
    message: PerplexityMessage,
}

#[derive(Serialize, Deserialize, Debug)]
struct PerplexityMessage {
    role: String,
    content: String,
}

#[derive(Serialize, Deserialize, Debug)]
struct PerplexityUsage {
    prompt_tokens: u32,
    completion_tokens: u32,
    total_tokens: u32,
}

#[derive(Serialize, Deserialize, Debug)]
struct DeepSeekResponse {
    id: String,
    choices: Vec<DeepSeekChoice>,
}

#[derive(Serialize, Deserialize, Debug)]
struct DeepSeekChoice {
    message: DeepSeekMessage,
}

#[derive(Serialize, Deserialize, Debug)]
struct DeepSeekMessage {
    role: String,
    content: String,
}

impl QuantumRepairAgent {
    pub fn new() -> Self {
        // Load API keys from environment
        let perplexity_key = env::var("PERPLEXITY_API_KEY")
            .expect("PERPLEXITY_API_KEY environment variable not set");
        let deepseek_key = env::var("DEEPSEEK_API_KEY")
            .expect("DEEPSEEK_API_KEY environment variable not set");
            
        Self {
            git_hash: Self::current_commit(),
            last_healthy: Instant::now(),
            system_status: SystemHealth {
                is_healthy: true,
                last_check: Instant::now(),
                connected_services: vec![
                    "nexus_engine".to_string(),
                    "neural_network_integrator".to_string(),
                    "capital_amplifier".to_string(),
                ],
                error_count: 0,
                last_error: None,
            },
            neural_cache: NeuralCache {
                last_fixes: Vec::new(),
                improvement_suggestions: Vec::new(),
                trading_performance: TradingMetrics {
                    total_trades: 0,
                    successful_trades: 0,
                    profit_sol: 0.0,
                    last_updated: Instant::now(),
                },
            },
            perplexity_api_key: perplexity_key,
            deepseek_api_key: deepseek_key,
        }
    }

    // Get current git commit hash
    fn current_commit() -> String {
        let output = Command::new("git")
            .args(["rev-parse", "HEAD"])
            .output()
            .expect("Failed to get git hash");
        
        String::from_utf8_lossy(&output.stdout).trim().to_string()
    }
    
    // Main autonomous monitoring loop
    pub async fn watch(&mut self) {
        println!("🔵 Quantum Repair Agent activated - watching trading system");
        
        // Initialize file watcher
        let (tx, rx) = channel();
        let mut watcher = watcher(tx, Duration::from_secs(2))
            .expect("Failed to initialize file watcher");
        
        // Watch entire trading system
        watcher.watch("../trading-system", RecursiveMode::Recursive)
            .expect("Failed to watch trading-system directory");
            
        // Also watch strategic components
        watcher.watch("../server/strategies", RecursiveMode::Recursive)
            .expect("Failed to watch strategies directory");
        watcher.watch("../server/neural-network-integrator.ts", RecursiveMode::NonRecursive)
            .expect("Failed to watch neural network integrator");
        watcher.watch("../server/quantum", RecursiveMode::Recursive)
            .expect("Failed to watch quantum directory");
            
        // Main event loop
        loop {
            // Check for file system changes
            match rx.recv_timeout(Duration::from_secs(30)) {
                Ok(event) => self.handle_change(event).await,
                Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {
                    // Timeout is normal, run periodic checks
                },
                Err(e) => {
                    eprintln!("❌ Watch error: {}", e);
                    self.system_status.error_count += 1;
                    self.system_status.last_error = Some(format!("Watch error: {}", e));
                }
            }
            
            // Run periodic maintenance
            self.health_check().await;
            
            // Performance improvement analysis every hour
            if self.last_healthy.elapsed() > Duration::from_secs(3600) {
                self.self_improve().await;
                self.last_healthy = Instant::now();
            }
        }
    }

    // Handle file system changes
    async fn handle_change(&mut self, event: notify::Event) {
        for path in event.paths {
            if let Some(ext) = path.extension() {
                if ext == "rs" || ext == "ts" || ext == "js" {
                    println!("🔍 Analyzing code change in: {}", path.display());
                    self.analyze_code(&path).await;
                }
            }
        }
    }

    // Analyze code for issues
    async fn analyze_code(&mut self, path: &Path) {
        // Different analysis based on file type
        if let Some(ext) = path.extension() {
            match ext.to_str().unwrap_or("") {
                "rs" => self.analyze_rust_code(path).await,
                "ts" | "js" => self.analyze_ts_code(path).await,
                _ => {}
            }
        }
    }

    // Analyze Rust code
    async fn analyze_rust_code(&mut self, path: &Path) {
        // Run Rust static analysis
        let output = Command::new("cargo")
            .args(["clippy", "--fix", "--allow-dirty"])
            .current_dir(path.parent().unwrap_or(Path::new(".")))
            .output();
            
        match output {
            Ok(output) => {
                if !output.status.success() {
                    let error = String::from_utf8_lossy(&output.stderr).to_string();
                    println!("⚠️ Detected Rust issue in {}: {}", path.display(), error);
                    self.generate_fix(path, &error).await;
                }
            },
            Err(e) => {
                eprintln!("❌ Failed to run Clippy: {}", e);
            }
        }
    }
    
    // Analyze TypeScript/JavaScript code
    async fn analyze_ts_code(&mut self, path: &Path) {
        // Run ESLint
        let output = Command::new("npx")
            .args(["eslint", "--fix", path.to_str().unwrap_or("")])
            .current_dir(path.parent().unwrap_or(Path::new(".")))
            .output();
            
        match output {
            Ok(output) => {
                if !output.status.success() {
                    let error = String::from_utf8_lossy(&output.stderr).to_string();
                    println!("⚠️ Detected TS/JS issue in {}: {}", path.display(), error);
                    self.generate_fix(path, &error).await;
                }
            },
            Err(e) => {
                eprintln!("❌ Failed to run ESLint: {}", e);
            }
        }
    }

    // Generate fix using AI
    async fn generate_fix(&mut self, path: &Path, error: &str) {
        println!("🔧 Generating fix for {}...", path.display());
        
        // Read the file content
        let file_content = match fs::read_to_string(path) {
            Ok(content) => content,
            Err(e) => {
                eprintln!("❌ Failed to read file: {}", e);
                return;
            }
        };
        
        // Prepare the prompt
        let file_extension = path.extension().unwrap_or_default().to_str().unwrap_or("");
        let prompt = format!(
            "You are an expert in fixing {0} code for a Solana trading system. \
            Fix the following error without changing functionality: \n\nError: {1}\n\nCode:\n```{0}\n{2}\n```\n\n\
            Provide ONLY the corrected code with no explanations. Use the same architecture and maintain all imports.",
            file_extension, error, file_content
        );
        
        // Try with Perplexity first (better with Solana code), fallback to DeepSeek
        let fixed_code = match self.perplexity_code_fix(&prompt).await {
            Ok(fix) => fix,
            Err(e) => {
                println!("⚠️ Perplexity API failed, trying DeepSeek: {}", e);
                match self.deepseek_code_fix(&prompt).await {
                    Ok(fix) => fix,
                    Err(e) => {
                        eprintln!("❌ DeepSeek API also failed: {}", e);
                        return;
                    }
                }
            }
        };
        
        // Extract just the code part (remove markdown code blocks if present)
        let clean_code = if fixed_code.contains("```") {
            let parts: Vec<&str> = fixed_code.split("```").collect();
            if parts.len() >= 3 {
                parts[1].trim().to_string()
            } else {
                fixed_code
            }
        } else {
            fixed_code
        };
        
        // Write the fixed code back to the file
        match fs::write(path, &clean_code) {
            Ok(_) => {
                println!("✅ Successfully fixed {}", path.display());
                
                // Record the fix
                self.neural_cache.last_fixes.push(RepairAction {
                    timestamp: Instant::now(),
                    file_path: path.to_str().unwrap_or("unknown").to_string(),
                    error_type: error.lines().next().unwrap_or("unknown").to_string(),
                    fix_applied: clean_code.lines().take(1).collect::<Vec<_>>().join(" "),
                    successful: true,
                });
                
                // Commit the change
                self.commit_change(&format!("Auto-fix for {}", path.display()));
            },
            Err(e) => {
                eprintln!("❌ Failed to write fixed code: {}", e);
            }
        }
    }
    
    // Use Perplexity API for code repair
    async fn perplexity_code_fix(&self, prompt: &str) -> Result<String, Box<dyn std::error::Error>> {
        let client = reqwest::Client::new();
        
        let request_body = json!({
            "model": "llama-3.1-sonar-small-128k-online",
            "messages": [
                {
                    "role": "system",
                    "content": "You are an AI assistant specialized in fixing Solana trading system code. Provide only the fixed code with no explanations or markdown."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "temperature": 0.1,
            "max_tokens": 4000
        });
        
        let response = client
            .post("https://api.perplexity.ai/chat/completions")
            .header("Authorization", format!("Bearer {}", self.perplexity_api_key))
            .json(&request_body)
            .send()
            .await?;
            
        if response.status().is_success() {
            let perplexity_response: PerplexityResponse = response.json().await?;
            if let Some(choice) = perplexity_response.choices.get(0) {
                return Ok(choice.message.content.clone());
            }
        }
        
        Err("Failed to get valid response from Perplexity API".into())
    }
    
    // Use DeepSeek API for code repair
    async fn deepseek_code_fix(&self, prompt: &str) -> Result<String, Box<dyn std::error::Error>> {
        let client = reqwest::Client::new();
        
        let request_body = json!({
            "model": "deepseek-coder-v2",
            "messages": [
                {
                    "role": "system",
                    "content": "You are an AI assistant specialized in fixing Solana trading system code. Provide only the fixed code with no explanations or markdown."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "temperature": 0.1,
            "max_tokens": 4000
        });
        
        let response = client
            .post("https://api.deepseek.com/v1/chat/completions")
            .header("Authorization", format!("Bearer {}", self.deepseek_api_key))
            .json(&request_body)
            .send()
            .await?;
            
        if response.status().is_success() {
            let deepseek_response: DeepSeekResponse = response.json().await?;
            if let Some(choice) = deepseek_response.choices.get(0) {
                return Ok(choice.message.content.clone());
            }
        }
        
        Err("Failed to get valid response from DeepSeek API".into())
    }
    
    // Commit a change to git
    fn commit_change(&self, message: &str) {
        // Stage the changes
        let stage = Command::new("git")
            .args(["add", "."])
            .output();
            
        match stage {
            Ok(_) => {
                // Commit the changes
                let commit = Command::new("git")
                    .args(["commit", "-m", message])
                    .output();
                    
                match commit {
                    Ok(output) => {
                        if !output.status.success() {
                            let error = String::from_utf8_lossy(&output.stderr);
                            if !error.contains("nothing to commit") {
                                eprintln!("❌ Git commit failed: {}", error);
                            }
                        } else {
                            println!("📝 Committed changes: {}", message);
                        }
                    },
                    Err(e) => {
                        eprintln!("❌ Failed to commit: {}", e);
                    }
                }
            },
            Err(e) => {
                eprintln!("❌ Failed to stage changes: {}", e);
            }
        }
    }
    
    // Check system health
    async fn health_check(&mut self) {
        println!("🔄 Running health check...");
        self.system_status.last_check = Instant::now();
        
        // Check critical components
        let components = [
            ("nexus_engine", "../server/nexus-transaction-engine.ts"),
            ("neural_network", "../server/neural-network-integrator.ts"),
            ("capital_amplifier", "../server/strategies/capital-amplifier.ts"),
            ("hyper_acceleration", "../server/strategies/hyper-acceleration.ts")
        ];
        
        let mut all_healthy = true;
        
        for (name, path) in components.iter() {
            if !Path::new(path).exists() {
                println!("⚠️ Critical component missing: {}", name);
                all_healthy = false;
            }
        }
        
        // Check trading performance
        self.update_trading_metrics().await;
        
        // Update health status
        self.system_status.is_healthy = all_healthy;
        if all_healthy {
            self.last_healthy = Instant::now();
            println!("✅ System health check passed");
        } else {
            self.system_status.error_count += 1;
            println!("⚠️ System health check failed - will attempt repairs");
        }
    }
    
    // Update trading performance metrics
    async fn update_trading_metrics(&mut self) {
        // In a real implementation, this would query the transaction engine
        // to get real metrics. For demonstration, we'll use placeholder logic.
        
        // Check if metrics file exists
        let metrics_path = Path::new("../logs/trading_metrics.json");
        if metrics_path.exists() {
            match fs::read_to_string(metrics_path) {
                Ok(content) => {
                    match serde_json::from_str::<serde_json::Value>(&content) {
                        Ok(metrics) => {
                            // Parse values with fallbacks
                            let total = metrics["total_trades"].as_u64().unwrap_or(0) as u32;
                            let successful = metrics["successful_trades"].as_u64().unwrap_or(0) as u32;
                            let profit = metrics["profit_sol"].as_f64().unwrap_or(0.0);
                            
                            self.neural_cache.trading_performance = TradingMetrics {
                                total_trades: total,
                                successful_trades: successful,
                                profit_sol: profit,
                                last_updated: Instant::now(),
                            };
                            
                            println!("📊 Trading metrics updated: {} trades, {} SOL profit", 
                                total, profit);
                        },
                        Err(e) => {
                            eprintln!("❌ Failed to parse metrics: {}", e);
                        }
                    }
                },
                Err(e) => {
                    eprintln!("❌ Failed to read metrics file: {}", e);
                }
            }
        }
    }
    
    // Self-improve the system
    async fn self_improve(&mut self) {
        println!("🧠 Running system self-improvement analysis...");
        
        // First, check trading performance
        let metrics = &self.neural_cache.trading_performance;
        let success_rate = if metrics.total_trades > 0 {
            (metrics.successful_trades as f64) / (metrics.total_trades as f64)
        } else {
            0.0
        };
        
        // Identify areas for improvement
        let mut improvement_areas = Vec::new();
        
        if success_rate < 0.8 && metrics.total_trades > 10 {
            improvement_areas.push("trade_execution");
        }
        
        if metrics.profit_sol < 0.1 && metrics.total_trades > 5 {
            improvement_areas.push("profit_optimization");
        }
        
        if self.system_status.error_count > 3 {
            improvement_areas.push("error_handling");
        }
        
        // Generate improvements for each area
        for area in improvement_areas {
            self.generate_improvement(area).await;
        }
    }
    
    // Generate system improvements
    async fn generate_improvement(&mut self, area: &str) {
        println!("🔧 Generating improvements for area: {}", area);
        
        // Construct appropriate prompt based on area
        let prompt = match area {
            "trade_execution" => {
                format!(
                    "Analyze ways to improve trade execution success rate for a Solana trading system.\
                    Current success rate: {:.1}%, Total trades: {}.\
                    Provide 3 specific code-level improvements to increase execution reliability.",
                    (self.neural_cache.trading_performance.successful_trades as f64) / 
                    (self.neural_cache.trading_performance.total_trades as f64) * 100.0,
                    self.neural_cache.trading_performance.total_trades
                )
            },
            "profit_optimization" => {
                format!(
                    "Suggest ways to optimize profit in a Solana trading system.\
                    Current profit: {} SOL across {} trades.\
                    Provide 3 specific algorithmic improvements to increase profit margins.",
                    self.neural_cache.trading_performance.profit_sol,
                    self.neural_cache.trading_performance.total_trades
                )
            },
            "error_handling" => {
                format!(
                    "Improve error handling and resilience in a Solana trading system.\
                    System has encountered {} errors.\
                    Provide 3 specific error handling patterns to improve system stability.",
                    self.system_status.error_count
                )
            },
            _ => "Provide general improvements for a Solana trading system.".to_string()
        };
        
        // Use AI to generate improvements
        let improvements = match self.perplexity_code_fix(&prompt).await {
            Ok(response) => response,
            Err(_) => {
                match self.deepseek_code_fix(&prompt).await {
                    Ok(response) => response,
                    Err(_) => {
                        println!("❌ Failed to generate improvements");
                        return;
                    }
                }
            }
        };
        
        // Save improvements
        self.neural_cache.improvement_suggestions.push(format!(
            "Area: {}\nTimestamp: {:?}\nSuggestions:\n{}",
            area, Instant::now(), improvements
        ));
        
        // Write to improvement log
        let log_path = Path::new("../logs/improvement_suggestions.txt");
        let log_content = format!(
            "===== {} Improvement Suggestions =====\nGenerated: {:?}\n\n{}\n\n",
            area, Instant::now(), improvements
        );
        
        // Append to log file
        if let Err(e) = fs::write(log_path, log_content) {
            eprintln!("❌ Failed to write improvement log: {}", e);
            // Attempt to create the file if it doesn't exist
            if !log_path.parent().unwrap().exists() {
                let _ = fs::create_dir_all(log_path.parent().unwrap());
            }
            let _ = fs::write(log_path, log_content);
        }
        
        println!("💡 Generated improvements for {}", area);
    }
}

#[tokio::main]
async fn main() {
    println!("🚀 Starting QuantumRepairAgent for Hyperion Trading System");
    
    // Create and start the repair agent
    let mut agent = QuantumRepairAgent::new();
    agent.watch().await;
}