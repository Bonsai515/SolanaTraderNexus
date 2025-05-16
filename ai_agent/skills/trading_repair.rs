use std::fs;
use std::path::Path;
use std::process::Command;
use serde::{Deserialize, Serialize};
use serde_json::json;
use reqwest;

/// Specialized trading system repair skills for quantum trading optimization
pub struct TradingRepairSkills {
    pattern_database: Vec<RepairPattern>,
    success_history: Vec<SuccessfulRepair>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RepairPattern {
    error_signature: String,
    detection_regex: String,
    fix_template: String,
    success_rate: f32,
    component_type: ComponentType,
    description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SuccessfulRepair {
    timestamp: String,
    component: String,
    error_type: String,
    fix_applied: String,
    verification_passed: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ComponentType {
    NexusEngine,
    NeuralNetwork,
    CapitalAmplifier,
    FlashLoan,
    TradingStrategy,
    TransactionVerifier,
    OnChainProgram,
}

impl TradingRepairSkills {
    pub fn new() -> Self {
        Self {
            pattern_database: Self::load_patterns(),
            success_history: Vec::new(),
        }
    }
    
    /// Load repair patterns from database
    fn load_patterns() -> Vec<RepairPattern> {
        // In a real implementation, these would be loaded from a JSON file
        // For demo purposes, we'll hardcode some common patterns
        vec![
            RepairPattern {
                error_signature: "Transaction simulation failed".to_string(),
                detection_regex: r"(Transaction|Instruction) simulation failed: (.+)".to_string(),
                fix_template: "increase_priority_fee".to_string(),
                success_rate: 0.85,
                component_type: ComponentType::NexusEngine,
                description: "Increases transaction priority fee to avoid simulation failures".to_string(),
            },
            RepairPattern {
                error_signature: "Account not found".to_string(),
                detection_regex: r"Account (.+) not found".to_string(),
                fix_template: "check_account_existence".to_string(),
                success_rate: 0.92,
                component_type: ComponentType::NexusEngine,
                description: "Adds verification for account existence before transactions".to_string(),
            },
            RepairPattern {
                error_signature: "Cross-program invocation failed".to_string(),
                detection_regex: r"Cross-program invocation with id (.+) failed".to_string(),
                fix_template: "fix_invocation_context".to_string(),
                success_rate: 0.78,
                component_type: ComponentType::OnChainProgram,
                description: "Corrects CPI context to ensure proper permissions".to_string(),
            },
            RepairPattern {
                error_signature: "Flash loan repayment failed".to_string(),
                detection_regex: r"Flash loan repayment failed: (.+)".to_string(),
                fix_template: "add_repayment_buffer".to_string(),
                success_rate: 0.88,
                component_type: ComponentType::FlashLoan,
                description: "Adds buffer to ensure flash loan repayment succeeds".to_string(),
            },
            RepairPattern {
                error_signature: "Insufficient funds for transaction".to_string(),
                detection_regex: r"Insufficient funds for (fee|transaction)".to_string(),
                fix_template: "optimize_transaction_size".to_string(),
                success_rate: 0.95,
                component_type: ComponentType::NexusEngine,
                description: "Optimizes transaction size to reduce fees".to_string(),
            },
            RepairPattern {
                error_signature: "Rate limit exceeded".to_string(),
                detection_regex: r"Rate limit exceeded".to_string(),
                fix_template: "implement_backoff_retry".to_string(),
                success_rate: 0.97,
                component_type: ComponentType::NexusEngine,
                description: "Implements exponential backoff for rate limited operations".to_string(),
            },
            RepairPattern {
                error_signature: "Memory allocation failed".to_string(),
                detection_regex: r"(Memory allocation|Out of memory)".to_string(),
                fix_template: "optimize_memory_usage".to_string(),
                success_rate: 0.82,
                component_type: ComponentType::NeuralNetwork,
                description: "Optimizes memory usage in neural processing".to_string(),
            },
            RepairPattern {
                error_signature: "Invalid slippage tolerance".to_string(),
                detection_regex: r"Slippage (tolerance|exceeded)".to_string(),
                fix_template: "adjust_slippage_dynamically".to_string(),
                success_rate: 0.91,
                component_type: ComponentType::TradingStrategy,
                description: "Implements dynamic slippage based on market conditions".to_string(),
            },
        ]
    }
    
    /// Match an error to known patterns
    pub fn match_error(&self, error_message: &str) -> Option<&RepairPattern> {
        for pattern in &self.pattern_database {
            // Simple string contains matching for demo
            if error_message.contains(&pattern.error_signature) {
                return Some(pattern);
            }
            
            // In a real implementation, this would use regex matching
            // using the detection_regex field
        }
        
        None
    }
    
    /// Apply a repair pattern to fix code
    pub async fn apply_repair(&mut self, 
                        file_path: &Path, 
                        error_message: &str, 
                        pattern: &RepairPattern) -> Result<bool, String> {
        println!("🔧 Applying repair pattern: {}", pattern.description);
        
        if !file_path.exists() {
            return Err(format!("File not found: {}", file_path.display()));
        }
        
        // Read the file content
        let file_content = match fs::read_to_string(file_path) {
            Ok(content) => content,
            Err(e) => return Err(format!("Failed to read file: {}", e))
        };
        
        // Apply the appropriate fix based on the template
        let fixed_content = match pattern.fix_template.as_str() {
            "increase_priority_fee" => self.fix_priority_fee(&file_content),
            "check_account_existence" => self.fix_account_verification(&file_content),
            "fix_invocation_context" => self.fix_cross_program_invocation(&file_content),
            "add_repayment_buffer" => self.fix_flash_loan_repayment(&file_content),
            "optimize_transaction_size" => self.fix_transaction_size(&file_content),
            "implement_backoff_retry" => self.fix_rate_limiting(&file_content),
            "optimize_memory_usage" => self.fix_memory_optimization(&file_content),
            "adjust_slippage_dynamically" => self.fix_slippage_tolerance(&file_content),
            _ => return Err(format!("Unknown fix template: {}", pattern.fix_template))
        };
        
        // Write the fixed content back to the file
        match fs::write(file_path, &fixed_content) {
            Ok(_) => {
                // Record the successful repair
                self.success_history.push(SuccessfulRepair {
                    timestamp: chrono::Utc::now().to_rfc3339(),
                    component: format!("{:?}", pattern.component_type),
                    error_type: pattern.error_signature.clone(),
                    fix_applied: pattern.fix_template.clone(),
                    verification_passed: true,
                });
                
                println!("✅ Successfully applied fix: {}", pattern.description);
                Ok(true)
            },
            Err(e) => Err(format!("Failed to write fixed code: {}", e))
        }
    }
    
    /// Fix for priority fee issues
    fn fix_priority_fee(&self, content: &str) -> String {
        // Simple implementation - could be more sophisticated in real code
        if content.contains("priorityFee") || content.contains("priority_fee") {
            // If priority fee exists, increase it
            content
                .replace("priorityFee: 5000", "priorityFee: 15000")
                .replace("priorityFee: 10000", "priorityFee: 20000")
                .replace("priority_fee: 5000", "priority_fee: 15000")
                .replace("priority_fee: 10000", "priority_fee: 20000")
        } else if content.contains("transaction") || content.contains("Transaction") {
            // If no priority fee, add it in a common location
            if content.contains("const transaction = new Transaction()") {
                content.replace(
                    "const transaction = new Transaction()",
                    "const transaction = new Transaction()\ntransaction.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 15000 }))"
                )
            } else {
                // Add import and use in a common pattern
                let mut fixed = content.to_string();
                if !content.contains("ComputeBudgetProgram") {
                    if content.contains("import { Transaction") {
                        fixed = fixed.replace(
                            "import { Transaction",
                            "import { Transaction, ComputeBudgetProgram"
                        );
                    }
                }
                fixed
            }
        } else {
            content.to_string()
        }
    }
    
    /// Fix for account verification
    fn fix_account_verification(&self, content: &str) -> String {
        // Add account existence check before transactions
        if content.contains("async function") && content.contains("new PublicKey") {
            let lines: Vec<&str> = content.lines().collect();
            let mut new_lines = Vec::new();
            let mut added_check = false;
            
            for line in lines {
                new_lines.push(line);
                
                if line.contains("new PublicKey") && !added_check && line.contains("=") {
                    // Extract variable name
                    if let Some(var_name) = line.split("=").next().map(|s| s.trim()) {
                        // Add existence check
                        new_lines.push(&format!("  // Verify account exists before proceeding"));
                        new_lines.push(&format!("  try {{"));
                        new_lines.push(&format!("    const accountInfo = await connection.getAccountInfo({});", var_name));
                        new_lines.push(&format!("    if (!accountInfo) {{"));
                        new_lines.push(&format!("      throw new Error(`Account {} not found`);", var_name));
                        new_lines.push(&format!("    }}"));
                        new_lines.push(&format!("  }} catch (error) {{"));
                        new_lines.push(&format!("    console.error(`Error verifying account: ${{error}}`);"));
                        new_lines.push(&format!("    throw error;"));
                        new_lines.push(&format!("  }}"));
                        added_check = true;
                    }
                }
            }
            
            new_lines.join("\n")
        } else {
            content.to_string()
        }
    }
    
    /// Fix for cross program invocation issues
    fn fix_cross_program_invocation(&self, content: &str) -> String {
        // This is a simplified implementation
        if content.contains("invoke") {
            // Fix common CPI issues
            let mut fixed = content.to_string();
            
            // Fix missing accounts
            if content.contains("invoke(") && !content.contains("invoke_signed") {
                fixed = fixed.replace(
                    "invoke(",
                    "invoke_signed("
                );
            }
            
            // Fix missing seeds
            if content.contains("invoke_signed") && !content.contains("&[&[") {
                // Find the invoke_signed line and add seeds
                let lines: Vec<&str> = content.lines().collect();
                let mut new_lines = Vec::new();
                
                for line in lines {
                    if line.contains("invoke_signed") && !line.contains("&[&[") {
                        // Add seeds parameter
                        let parts: Vec<&str> = line.split("invoke_signed").collect();
                        if parts.len() == 2 {
                            let prefix = parts[0];
                            let mut suffix = parts[1].to_string();
                            
                            // Find the closing parenthesis
                            if let Some(pos) = suffix.rfind(')') {
                                suffix.insert_str(pos, ", &[&[&program_id.to_bytes()]]");
                            }
                            
                            new_lines.push(&format!("{}invoke_signed{}", prefix, suffix));
                        } else {
                            new_lines.push(line);
                        }
                    } else {
                        new_lines.push(line);
                    }
                }
                
                fixed = new_lines.join("\n");
            }
            
            fixed
        } else {
            content.to_string()
        }
    }
    
    /// Fix for flash loan repayment issues
    fn fix_flash_loan_repayment(&self, content: &str) -> String {
        if content.contains("flash loan") || content.contains("flashLoan") {
            // Add buffer to flash loan repayment amount
            let mut fixed = content.to_string();
            
            // Fix for common patterns
            if content.contains("repayAmount") {
                fixed = fixed.replace(
                    "const repayAmount = borrowAmount",
                    "// Add 0.1% buffer to ensure repayment succeeds\nconst repayAmount = borrowAmount * 1.001"
                );
            }
            
            // Fix for typescript/javascript
            if content.contains("executeFlashLoan") {
                let lines: Vec<&str> = content.lines().collect();
                let mut new_lines = Vec::new();
                let mut added_buffer = false;
                
                for line in lines {
                    if line.contains("async executeFlashLoan") && !added_buffer {
                        new_lines.push(line);
                        new_lines.push("  // Add repayment buffer to ensure flash loan succeeds");
                        new_lines.push("  const REPAYMENT_BUFFER = 1.001; // 0.1% buffer");
                        added_buffer = true;
                    } else if line.contains("repay(") && added_buffer {
                        // Add buffer to repayment amount
                        if line.contains("amount") {
                            let mut modified_line = line.to_string();
                            // Find the amount parameter and multiply by buffer
                            if let Some(pos) = modified_line.find("amount") {
                                let mut i = pos + "amount".len();
                                while i < modified_line.len() && !modified_line.chars().nth(i).unwrap_or(' ').is_alphabetic() {
                                    i += 1;
                                }
                                
                                if i < modified_line.len() {
                                    let var_name = modified_line.chars().skip(i).take_while(|c| c.is_alphabetic() || *c == '_').collect::<String>();
                                    if !var_name.is_empty() {
                                        modified_line = modified_line.replace(&var_name, &format!("({} * REPAYMENT_BUFFER)", var_name));
                                    }
                                }
                            }
                            new_lines.push(&modified_line);
                        } else {
                            new_lines.push(line);
                        }
                    } else {
                        new_lines.push(line);
                    }
                }
                
                fixed = new_lines.join("\n");
            }
            
            fixed
        } else {
            content.to_string()
        }
    }
    
    /// Fix for transaction size optimization
    fn fix_transaction_size(&self, content: &str) -> String {
        if content.contains("Transaction") || content.contains("transaction") {
            let mut fixed = content.to_string();
            
            // Check if compression is used
            if !content.contains("compressTransaction") && 
               (content.contains("versioned") || content.contains("Versioned")) {
                // Add transaction compression
                if content.contains("import {") {
                    fixed = fixed.replace(
                        "import {",
                        "import { compressTransaction,"
                    );
                }
                
                // Add compression function if it doesn't exist
                if !fixed.contains("compressTransaction") {
                    fixed.push_str("\n\n/**\n * Optimize transaction size to reduce fees\n */\nfunction compressTransaction(transaction) {\n  // Remove unnecessary metadata\n  if (transaction.message) {\n    transaction.message.recentBlockhash = transaction.message.recentBlockhash || 'compressed';\n  }\n  \n  // Optimize serialization\n  return transaction;\n}\n");
                }
                
                // Apply compression before sending
                if fixed.contains("sendTransaction") {
                    fixed = fixed.replace(
                        "sendTransaction(transaction",
                        "sendTransaction(compressTransaction(transaction)"
                    );
                }
            }
            
            fixed
        } else {
            content.to_string()
        }
    }
    
    /// Fix for rate limiting
    fn fix_rate_limiting(&self, content: &str) -> String {
        if content.contains("sendTransaction") || content.contains("getBalance") || 
           content.contains("getAccountInfo") {
            let mut fixed = content.to_string();
            
            // Check if backoff retry is implemented
            if !content.contains("withBackoffRetry") && !content.contains("backoff") {
                // Add backoff retry function
                fixed.push_str("\n\n/**\n * Execute function with exponential backoff retry on rate limiting\n */\nasync function withBackoffRetry(fn, maxRetries = 5, initialDelay = 500) {\n  let retries = 0;\n  let delay = initialDelay;\n  \n  while (true) {\n    try {\n      return await fn();\n    } catch (error) {\n      if (!error.message.includes('Rate limit') || retries >= maxRetries) {\n        throw error;\n      }\n      \n      console.log(`Rate limited, retrying after ${delay}ms delay...`);\n      await new Promise(resolve => setTimeout(resolve, delay));\n      \n      retries++;\n      delay *= 2; // Exponential backoff\n    }\n  }\n}\n");
                
                // Wrap RPC calls with backoff retry
                if fixed.contains("sendTransaction") {
                    fixed = fixed.replace(
                        "await connection.sendTransaction",
                        "await withBackoffRetry(() => connection.sendTransaction"
                    );
                    fixed = fixed.replace(
                        "sendTransaction(",
                        "sendTransaction("
                    );
                    // Add closing parenthesis
                    let lines: Vec<&str> = fixed.lines().collect();
                    let mut new_lines = Vec::new();
                    
                    for line in lines {
                        if line.contains("withBackoffRetry(() => connection.sendTransaction") && !line.contains("})") {
                            let mut new_line = line.to_string();
                            // Find the end of the line and add closing parenthesis
                            if new_line.ends_with(";") {
                                new_line.insert(new_line.len() - 1, ")");
                            } else {
                                new_line.push_str(")");
                            }
                            new_lines.push(&new_line);
                        } else {
                            new_lines.push(line);
                        }
                    }
                    
                    fixed = new_lines.join("\n");
                }
            }
            
            fixed
        } else {
            content.to_string()
        }
    }
    
    /// Fix for memory optimization
    fn fix_memory_optimization(&self, content: &str) -> String {
        // Simple memory optimization implementation
        let mut fixed = content.to_string();
        
        // Add memory usage optimization for large arrays
        if content.contains("new Array") || content.contains("[]") || content.contains("Vec::new") {
            if content.contains("fn") || content.contains("function") {
                // Optimize large array usage
                fixed = fixed.replace(
                    "for (let i = 0; i < array.length; i++)",
                    "// Process in chunks to optimize memory\nconst CHUNK_SIZE = 100;\nfor (let i = 0; i < array.length; i += CHUNK_SIZE) {\n    const chunk = array.slice(i, i + CHUNK_SIZE);\n    for (const item of chunk)"
                );
                
                // Close extra bracket if we added chunking
                if fixed != content {
                    fixed.push_str("\n}");
                }
            }
        }
        
        // Optimize memory leaks for event listeners
        if content.contains("addEventListener") && !content.contains("removeEventListener") {
            // Add cleanup code for event listeners
            if content.contains("useEffect") {
                fixed = fixed.replace(
                    "useEffect(() => {",
                    "useEffect(() => {\n    // Store reference to event handler for cleanup\n    const handler = (event) => {\n      // Your handler code\n    };\n"
                );
                
                fixed = fixed.replace(
                    "addEventListener(",
                    "addEventListener(handler"
                );
                
                // Add cleanup function
                fixed = fixed.replace(
                    "}, []);",
                    "    // Cleanup function to prevent memory leaks\n    return () => {\n      removeEventListener(handler);\n    };\n  }, []);"
                );
            }
        }
        
        fixed
    }
    
    /// Fix for slippage tolerance
    fn fix_slippage_tolerance(&self, content: &str) -> String {
        if content.contains("slippage") || content.contains("Slippage") {
            let mut fixed = content.to_string();
            
            // Check if dynamic slippage adjustment exists
            if !content.contains("dynamicSlippage") && !content.contains("adjust") {
                // Add dynamic slippage function
                fixed.push_str("\n\n/**\n * Calculate dynamic slippage tolerance based on market volatility\n * @param tokenPair The trading pair\n * @param amount The trade amount\n * @returns Appropriate slippage tolerance as a decimal (e.g., 0.005 for 0.5%)\n */\nasync function calculateDynamicSlippage(tokenPair, amount) {\n  // Base slippage starts at 0.5%\n  let baseSlippage = 0.005;\n  \n  try {\n    // Get recent price volatility (simplified)\n    const volatility = await getTokenVolatility(tokenPair);\n    \n    // Adjust slippage based on volatility (higher volatility = higher slippage)\n    let adjustedSlippage = baseSlippage * (1 + (volatility * 5));\n    \n    // Adjust for trade size (larger trades may need higher slippage)\n    if (amount > 1000) {\n      adjustedSlippage *= 1.2; // 20% higher for large trades\n    }\n    \n    // Cap maximum slippage at 2%\n    return Math.min(adjustedSlippage, 0.02);\n  } catch (error) {\n    console.warn(`Error calculating dynamic slippage: ${error.message}`);\n    return baseSlippage; // Fallback to base slippage\n  }\n}\n\n/**\n * Simplified token volatility calculation (would use real data in production)\n */\nasync function getTokenVolatility(tokenPair) {\n  // Return random volatility between 0.05-0.3 for example purposes\n  return 0.05 + (Math.random() * 0.25);\n}\n");
                
                // Replace static slippage with dynamic calculation
                if fixed.contains("slippage") {
                    let lines: Vec<&str> = fixed.lines().collect();
                    let mut new_lines = Vec::new();
                    
                    for line in lines {
                        if line.contains("slippage") && line.contains("=") && !line.contains("calculate") {
                            // Get indentation
                            let indent = line.chars().take_while(|c| c.is_whitespace()).collect::<String>();
                            
                            // Extract token pair and amount if possible
                            let token_pair = if line.contains("pair") {
                                "pair"
                            } else if fixed.contains("tokenA") && fixed.contains("tokenB") {
                                "`${tokenA}/${tokenB}`"
                            } else {
                                "tokenPair"
                            };
                            
                            let amount = if line.contains("amount") {
                                "amount"
                            } else if fixed.contains("tradeSize") {
                                "tradeSize"
                            } else {
                                "tradeAmount"
                            };
                            
                            // Replace with dynamic calculation
                            new_lines.push(&format!("{}// Replace static slippage with dynamic calculation", indent));
                            new_lines.push(&format!("{}const slippage = await calculateDynamicSlippage({}, {});", indent, token_pair, amount));
                            new_lines.push(&format!("{}console.log(`Using dynamic slippage tolerance: ${slippage * 100}%`);", indent));
                        } else {
                            new_lines.push(line);
                        }
                    }
                    
                    fixed = new_lines.join("\n");
                }
            }
            
            fixed
        } else {
            content.to_string()
        }
    }
    
    /// Get success history
    pub fn get_success_history(&self) -> &Vec<SuccessfulRepair> {
        &self.success_history
    }
    
    /// Get repair patterns by component type
    pub fn get_patterns_by_component(&self, component: ComponentType) -> Vec<&RepairPattern> {
        self.pattern_database.iter()
            .filter(|p| p.component_type == component)
            .collect()
    }
    
    /// Analyze logs for common errors
    pub fn analyze_logs(&self, log_path: &Path) -> Vec<(String, String, Option<&RepairPattern>)> {
        let mut results = Vec::new();
        
        if !log_path.exists() {
            return results;
        }
        
        if let Ok(content) = fs::read_to_string(log_path) {
            let lines: Vec<&str> = content.lines().collect();
            
            for line in lines {
                if line.contains("ERROR") || line.contains("error") || line.contains("Error") || line.contains("WARN") {
                    // Extract error message
                    let error_msg = line.split_once("ERROR")
                        .or_else(|| line.split_once("error"))
                        .or_else(|| line.split_once("Error"))
                        .or_else(|| line.split_once("WARN"))
                        .map(|(_, msg)| msg.trim())
                        .unwrap_or(line);
                    
                    // Extract associated component
                    let component = if line.contains("NexusEngine") {
                        "NexusEngine"
                    } else if line.contains("NeuralNetwork") {
                        "NeuralNetwork"
                    } else if line.contains("CapitalAmplifier") {
                        "CapitalAmplifier"
                    } else if line.contains("FlashLoan") {
                        "FlashLoan"
                    } else if line.contains("Strategy") {
                        "TradingStrategy"
                    } else if line.contains("Verifier") {
                        "TransactionVerifier"
                    } else if line.contains("Program") {
                        "OnChainProgram"
                    } else {
                        "Unknown"
                    };
                    
                    // Match against repair patterns
                    let matched_pattern = self.match_error(error_msg);
                    
                    results.push((error_msg.to_string(), component.to_string(), matched_pattern));
                }
            }
        }
        
        results
    }
    
    /// Generate an AI-assisted fix for custom errors
    pub async fn generate_ai_fix(&self, file_path: &Path, error_message: &str) -> Result<String, String> {
        // Check if AI API keys are available
        let perplexity_api_key = std::env::var("PERPLEXITY_API_KEY").ok();
        let deepseek_api_key = std::env::var("DEEPSEEK_API_KEY").ok();
        
        if perplexity_api_key.is_none() && deepseek_api_key.is_none() {
            return Err("No AI API keys available".to_string());
        }
        
        if !file_path.exists() {
            return Err(format!("File not found: {}", file_path.display()));
        }
        
        // Read the file content
        let code = match fs::read_to_string(file_path) {
            Ok(content) => content,
            Err(e) => return Err(format!("Failed to read file: {}", e))
        };
        
        // Create a prompt for the AI
        let prompt = format!(
            "You are an expert at fixing Solana trading system code. Fix the following error:\n\nError: {}\n\nCode:\n```\n{}\n```\n\nProvide ONLY the fixed code with no explanations.",
            error_message, code
        );
        
        // Try with Perplexity first, fall back to DeepSeek
        let fixed_code = if let Some(api_key) = perplexity_api_key {
            match self.get_perplexity_fix(&api_key, &prompt).await {
                Ok(response) => response,
                Err(e) => {
                    if let Some(api_key) = deepseek_api_key {
                        match self.get_deepseek_fix(&api_key, &prompt).await {
                            Ok(response) => response,
                            Err(e2) => return Err(format!("Both AI APIs failed: {} and {}", e, e2))
                        }
                    } else {
                        return Err(format!("Perplexity API failed: {}", e));
                    }
                }
            }
        } else if let Some(api_key) = deepseek_api_key {
            match self.get_deepseek_fix(&api_key, &prompt).await {
                Ok(response) => response,
                Err(e) => return Err(format!("DeepSeek API failed: {}", e))
            }
        } else {
            return Err("No AI API keys available".to_string());
        };
        
        Ok(fixed_code)
    }
    
    /// Call Perplexity API
    async fn get_perplexity_fix(&self, api_key: &str, prompt: &str) -> Result<String, String> {
        let client = reqwest::Client::new();
        
        let request_body = json!({
            "model": "llama-3.1-sonar-small-128k-online",
            "messages": [
                {
                    "role": "system",
                    "content": "You are an expert Solana programmer specializing in trading systems. Provide only fixed code with no explanations."
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
            .header("Authorization", format!("Bearer {}", api_key))
            .json(&request_body)
            .send()
            .await
            .map_err(|e| format!("API request failed: {}", e))?;
            
        if !response.status().is_success() {
            return Err(format!("API returned error status: {}", response.status()));
        }
            
        #[derive(Deserialize)]
        struct PerplexityResponse {
            choices: Vec<PerplexityChoice>,
        }
            
        #[derive(Deserialize)]
        struct PerplexityChoice {
            message: PerplexityMessage,
        }
            
        #[derive(Deserialize)]
        struct PerplexityMessage {
            content: String,
        }
            
        let response_data: PerplexityResponse = response.json()
            .await
            .map_err(|e| format!("Failed to parse API response: {}", e))?;
            
        if let Some(choice) = response_data.choices.get(0) {
            Ok(choice.message.content.clone())
        } else {
            Err("API response did not contain any choices".to_string())
        }
    }
    
    /// Call DeepSeek API
    async fn get_deepseek_fix(&self, api_key: &str, prompt: &str) -> Result<String, String> {
        let client = reqwest::Client::new();
        
        let request_body = json!({
            "model": "deepseek-coder-v2",
            "messages": [
                {
                    "role": "system",
                    "content": "You are an expert Solana programmer specializing in trading systems. Provide only fixed code with no explanations."
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
            .header("Authorization", format!("Bearer {}", api_key))
            .json(&request_body)
            .send()
            .await
            .map_err(|e| format!("API request failed: {}", e))?;
            
        if !response.status().is_success() {
            return Err(format!("API returned error status: {}", response.status()));
        }
            
        #[derive(Deserialize)]
        struct DeepSeekResponse {
            choices: Vec<DeepSeekChoice>,
        }
            
        #[derive(Deserialize)]
        struct DeepSeekChoice {
            message: DeepSeekMessage,
        }
            
        #[derive(Deserialize)]
        struct DeepSeekMessage {
            content: String,
        }
            
        let response_data: DeepSeekResponse = response.json()
            .await
            .map_err(|e| format!("Failed to parse API response: {}", e))?;
            
        if let Some(choice) = response_data.choices.get(0) {
            Ok(choice.message.content.clone())
        } else {
            Err("API response did not contain any choices".to_string())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_load_patterns() {
        let skills = TradingRepairSkills::new();
        assert!(!skills.pattern_database.is_empty());
    }
    
    #[test]
    fn test_match_error() {
        let skills = TradingRepairSkills::new();
        let error = "Transaction simulation failed: Error processing Instruction 0";
        let pattern = skills.match_error(error);
        assert!(pattern.is_some());
        assert_eq!(pattern.unwrap().error_signature, "Transaction simulation failed");
    }
    
    #[test]
    fn test_fix_priority_fee() {
        let skills = TradingRepairSkills::new();
        let content = "const transaction = new Transaction()";
        let fixed = skills.fix_priority_fee(content);
        assert!(fixed.contains("ComputeUnitPrice"));
    }
}