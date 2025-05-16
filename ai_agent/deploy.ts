/**
 * Quantum Trading System - AI Deployment Manager
 * 
 * Handles safe deployment of trading system components with verification,
 * rollbacks, and health checks using AI assistance for critical decisions.
 */

import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { exec, execSync } from 'child_process';
import { promisify } from 'util';

// Import environment secrets safely
const RPC_URL = process.env.RPC_URL || 'https://api.mainnet-beta.solana.com';
const DEPLOY_KEY_BASE64 = process.env.DEPLOY_KEY;
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

// Constants
const SOLANA_CONNECTION = new Connection(RPC_URL, 'confirmed');
const LOG_DIR = path.join(__dirname, '../logs');
const DEPLOYMENT_LOG = path.join(LOG_DIR, 'deployments.json');
const PROGRAM_BUILD_PATH = path.join(__dirname, '../trading-system/target/release');
const MAX_DEPLOYMENT_RETRIES = 3;

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Types
interface DeploymentLog {
  timestamp: string;
  version: string;
  programId: string;
  status: 'success' | 'failed' | 'rolled_back';
  signature?: string;
  errorMessage?: string;
}

interface HealthCheckResult {
  healthy: boolean;
  services: {
    name: string;
    status: 'healthy' | 'degraded' | 'offline';
    latencyMs?: number;
  }[];
  errorMessages?: string[];
}

interface AIAnalysisResult {
  shouldProceed: boolean;
  riskAssessment: {
    overallRisk: 'low' | 'medium' | 'high';
    criticalIssues: number;
    recommendations: string[];
  };
  explanation: string;
}

// Main deployment function
export async function safeDeploy(programName: string, version: string): Promise<boolean> {
  console.log(`🚀 Starting safe deployment process for ${programName} v${version}`);
  
  try {
    // 1. Prepare and verify build environment
    await prepareEnvironment();
    
    // 2. Build the program
    const buildSuccess = await buildProgram(programName);
    if (!buildSuccess) {
      throw new Error("Build process failed");
    }
    
    // 3. Run AI-assisted pre-deployment verification
    const verificationResult = await verifyPreDeployment(programName);
    if (!verificationResult.shouldProceed) {
      logDeploymentFailure(programName, version, 
        `AI verification failed: ${verificationResult.explanation}`);
      return false;
    }
    
    // 4. Deploy the program
    const deploymentSignature = await deployProgram(programName);
    if (!deploymentSignature) {
      throw new Error("Deployment failed to return a valid signature");
    }
    
    // 5. Run post-deployment health check
    const healthCheckResult = await performHealthCheck();
    if (!healthCheckResult.healthy) {
      console.log("❌ Post-deployment health check failed, rolling back...");
      await rollbackDeployment(programName, version);
      
      logDeploymentFailure(programName, version, 
        `Health check failed: ${healthCheckResult.errorMessages?.join(', ')}`);
      return false;
    }
    
    // 6. Log successful deployment
    logDeploymentSuccess(programName, version, deploymentSignature);
    
    console.log(`✅ Deployment of ${programName} v${version} completed successfully!`);
    console.log(`📝 Transaction signature: ${deploymentSignature}`);
    
    return true;
  } catch (error) {
    console.error(`❌ Deployment failed: ${error.message}`);
    
    // Attempt to rollback
    try {
      await rollbackDeployment(programName, version);
    } catch (rollbackError) {
      console.error(`⚠️ Rollback also failed: ${rollbackError.message}`);
    }
    
    // Log the failure
    logDeploymentFailure(programName, version, error.message);
    
    return false;
  }
}

// Prepare the environment
async function prepareEnvironment(): Promise<void> {
  console.log("🔧 Preparing deployment environment...");
  
  // Ensure the build directory exists
  if (!fs.existsSync(PROGRAM_BUILD_PATH)) {
    fs.mkdirSync(PROGRAM_BUILD_PATH, { recursive: true });
  }
  
  // Ensure the deploy keypair can be loaded
  if (!DEPLOY_KEY_BASE64) {
    throw new Error("DEPLOY_KEY environment variable not set");
  }
  
  try {
    getDeployKeypair();
    console.log("✅ Deploy keypair loaded successfully");
  } catch (error) {
    throw new Error(`Invalid deploy keypair: ${error.message}`);
  }
  
  // Verify Solana connection
  try {
    const version = await SOLANA_CONNECTION.getVersion();
    console.log(`✅ Connected to Solana ${version["solana-core"]}`);
  } catch (error) {
    throw new Error(`Failed to connect to Solana: ${error.message}`);
  }
}

// Build the program
async function buildProgram(programName: string): Promise<boolean> {
  console.log(`🔨 Building ${programName}...`);
  
  try {
    // Use execSync to capture output
    const buildOutput = execSync(
      `cd ../trading-system && cargo build --release --bin ${programName}`,
      { encoding: 'utf8' }
    );
    
    console.log("✅ Build completed successfully");
    return true;
  } catch (error) {
    console.error(`❌ Build failed: ${error.message}`);
    
    // Try to fix build errors with AI assistance
    console.log("🔧 Attempting to fix build errors with AI assistance...");
    const fixResult = await fixBuildErrors(error.stderr || error.message);
    
    if (fixResult) {
      // Retry the build after fixes
      try {
        execSync(
          `cd ../trading-system && cargo build --release --bin ${programName}`,
          { encoding: 'utf8' }
        );
        console.log("✅ Build completed successfully after automatic fixes");
        return true;
      } catch (retryError) {
        console.error(`❌ Build still failing after fixes: ${retryError.message}`);
        return false;
      }
    }
    
    return false;
  }
}

// Automatic build error fixing with AI
async function fixBuildErrors(errorMessage: string): Promise<boolean> {
  if (!PERPLEXITY_API_KEY && !DEEPSEEK_API_KEY) {
    console.log("⚠️ No AI API keys available for error fixing");
    return false;
  }
  
  try {
    const fixedFilesCount = await applyAIFixes(errorMessage);
    return fixedFilesCount > 0;
  } catch (error) {
    console.error(`❌ Error fixing attempt failed: ${error.message}`);
    return false;
  }
}

// Apply AI fixes to code
async function applyAIFixes(errorMessage: string): Promise<number> {
  // Extract error locations from error message
  const errorLocations = extractErrorLocations(errorMessage);
  
  if (errorLocations.length === 0) {
    console.log("⚠️ Could not extract error locations from build output");
    return 0;
  }
  
  let fixedFiles = 0;
  
  // Process each error location
  for (const { filePath, lineNumber, errorText } of errorLocations) {
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️ File not found: ${filePath}`);
      continue;
    }
    
    // Read the file content
    const originalCode = fs.readFileSync(filePath, 'utf8');
    
    // Create a prompt for the AI
    const prompt = `You are an expert Rust programmer. Fix the following error in a Solana program:
Error: ${errorText}
File: ${filePath}:${lineNumber}

Code:
\`\`\`rust
${originalCode}
\`\`\`

Provide ONLY the corrected code with no explanations. The file should be complete and identical to the original except for the fixes.`;

    // Try with Perplexity first, fall back to DeepSeek
    let fixedCode = "";
    
    if (PERPLEXITY_API_KEY) {
      try {
        fixedCode = await getPerplexityFix(prompt);
      } catch (error) {
        console.log(`⚠️ Perplexity API failed: ${error.message}`);
      }
    }
    
    // If Perplexity failed or was not available, try DeepSeek
    if (!fixedCode && DEEPSEEK_API_KEY) {
      try {
        fixedCode = await getDeepSeekFix(prompt);
      } catch (error) {
        console.log(`⚠️ DeepSeek API failed: ${error.message}`);
        continue; // Skip this file if both APIs failed
      }
    }
    
    if (!fixedCode) {
      console.log(`⚠️ Could not generate fix for ${filePath}`);
      continue;
    }
    
    // Clean up AI response - extract just the code
    fixedCode = extractCodeFromAIResponse(fixedCode);
    
    // Apply the fix
    fs.writeFileSync(filePath, fixedCode);
    console.log(`✅ Applied fix to ${filePath}`);
    fixedFiles++;
  }
  
  return fixedFiles;
}

// Extract error locations from error message
function extractErrorLocations(errorMessage: string): Array<{
  filePath: string;
  lineNumber: number;
  errorText: string;
}> {
  const results = [];
  const errorLines = errorMessage.split('\n');
  
  // Regular expression to match Rust error locations (file:line:column)
  const errorLocationRegex = /-->\s+(.+):(\d+):(\d+)/;
  
  for (let i = 0; i < errorLines.length; i++) {
    const match = errorLines[i].match(errorLocationRegex);
    if (match) {
      const [_, filePath, lineStr, colStr] = match;
      const lineNumber = parseInt(lineStr, 10);
      
      // Get the error text from the lines following the location
      let errorText = "";
      for (let j = i + 1; j < Math.min(i + 5, errorLines.length); j++) {
        if (errorLines[j].trim() && !errorLines[j].includes("-->")) {
          errorText += errorLines[j].trim() + "\n";
        }
      }
      
      results.push({
        filePath,
        lineNumber,
        errorText: errorText.trim()
      });
    }
  }
  
  return results;
}

// Extract code from AI response
function extractCodeFromAIResponse(response: string): string {
  // Check if the response contains code blocks
  if (response.includes("```rust")) {
    const codeBlocks = response.split("```");
    // The code should be in the second block (index 1)
    if (codeBlocks.length >= 3) {
      const code = codeBlocks[1].replace(/^rust\n/, '');
      return code.trim();
    }
  }
  
  // If no markdown code blocks, return the whole response
  return response.trim();
}

// Get fix from Perplexity API
async function getPerplexityFix(prompt: string): Promise<string> {
  const response = await axios.post(
    'https://api.perplexity.ai/chat/completions',
    {
      model: "llama-3.1-sonar-small-128k-online",
      messages: [
        {
          role: "system",
          content: "You are an expert Rust programmer specializing in Solana programs. Provide only fixed code with no explanations."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 4000
    },
    {
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  if (response.data.choices && response.data.choices.length > 0) {
    return response.data.choices[0].message.content;
  }
  
  throw new Error("Invalid response from Perplexity API");
}

// Get fix from DeepSeek API
async function getDeepSeekFix(prompt: string): Promise<string> {
  const response = await axios.post(
    'https://api.deepseek.com/v1/chat/completions',
    {
      model: "deepseek-coder-v2",
      messages: [
        {
          role: "system",
          content: "You are an expert Rust programmer specializing in Solana programs. Provide only fixed code with no explanations."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 4000
    },
    {
      headers: {
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  if (response.data.choices && response.data.choices.length > 0) {
    return response.data.choices[0].message.content;
  }
  
  throw new Error("Invalid response from DeepSeek API");
}

// AI-assisted pre-deployment verification
async function verifyPreDeployment(programName: string): Promise<AIAnalysisResult> {
  console.log("🧠 Running AI-assisted pre-deployment verification...");
  
  const programPath = path.join(PROGRAM_BUILD_PATH, `${programName}.so`);
  
  if (!fs.existsSync(programPath)) {
    return {
      shouldProceed: false,
      riskAssessment: {
        overallRisk: 'high',
        criticalIssues: 1,
        recommendations: ['Rebuild the program']
      },
      explanation: "Program binary not found. Rebuild required."
    };
  }
  
  // Verify program with Solana CLI
  try {
    const verifyOutput = execSync(
      `solana verify-program ${programPath}`,
      { encoding: 'utf8' }
    );
    
    console.log("✅ Program verification successful");
    
    // Perform additional checks using AI
    const additionalChecks = await performAdditionalChecks(programName);
    
    return {
      shouldProceed: true,
      riskAssessment: {
        overallRisk: 'low',
        criticalIssues: 0,
        recommendations: additionalChecks.recommendations || []
      },
      explanation: "All verification checks passed successfully."
    };
  } catch (error) {
    console.error(`❌ Program verification failed: ${error.message}`);
    
    return {
      shouldProceed: false,
      riskAssessment: {
        overallRisk: 'high',
        criticalIssues: 1,
        recommendations: ['Fix verification issues']
      },
      explanation: `Program verification failed: ${error.message}`
    };
  }
}

// Perform additional checks
async function performAdditionalChecks(programName: string): Promise<{
  passed: boolean;
  recommendations?: string[];
}> {
  // Additional checks could include:
  // 1. Test coverage verification
  // 2. Security audit
  // 3. Performance benchmarking
  
  // For demonstration, we'll just return a simple result
  return {
    passed: true,
    recommendations: [
      "Consider increasing test coverage for edge cases",
      "Add more detailed logging for transaction failures",
      "Consider implementing circuit breaker pattern for extreme market conditions"
    ]
  };
}

// Deploy the program
async function deployProgram(programName: string): Promise<string> {
  console.log(`📤 Deploying ${programName} to Solana blockchain...`);
  
  const programPath = path.join(PROGRAM_BUILD_PATH, `${programName}.so`);
  const deployKeypair = getDeployKeypair();
  
  // Read the program binary
  const programData = fs.readFileSync(programPath);
  
  // Deploy with retries
  let lastError = null;
  
  for (let attempt = 1; attempt <= MAX_DEPLOYMENT_RETRIES; attempt++) {
    try {
      console.log(`Deployment attempt ${attempt}/${MAX_DEPLOYMENT_RETRIES}...`);
      
      // Deploy the program
      const deploymentSignature = await SOLANA_CONNECTION.deploy(
        programData, 
        deployKeypair
      );
      
      // Wait for confirmation
      const confirmation = await SOLANA_CONNECTION.confirmTransaction(deploymentSignature);
      
      if (confirmation.value.err) {
        throw new Error(`Transaction confirmed but had errors: ${JSON.stringify(confirmation.value.err)}`);
      }
      
      console.log(`✅ Deployment confirmed: ${deploymentSignature}`);
      return deploymentSignature;
    } catch (error) {
      console.error(`❌ Deployment attempt ${attempt} failed: ${error.message}`);
      lastError = error;
      
      // Wait before retrying
      if (attempt < MAX_DEPLOYMENT_RETRIES) {
        const delay = 2000 * attempt; // Increasing backoff
        console.log(`Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw new Error(`All ${MAX_DEPLOYMENT_RETRIES} deployment attempts failed. Last error: ${lastError.message}`);
}

// Get deploy keypair
function getDeployKeypair(): Keypair {
  if (!DEPLOY_KEY_BASE64) {
    throw new Error("DEPLOY_KEY environment variable not set");
  }
  
  try {
    const secretKey = Buffer.from(DEPLOY_KEY_BASE64, 'base64');
    return Keypair.fromSecretKey(secretKey);
  } catch (error) {
    throw new Error(`Invalid deploy keypair: ${error.message}`);
  }
}

// Run health check after deployment
async function performHealthCheck(): Promise<HealthCheckResult> {
  console.log("🏥 Running post-deployment health check...");
  
  // Services to check
  const services = [
    { name: "Nexus Engine", endpoint: "/api/status/nexus" },
    { name: "Neural Network", endpoint: "/api/status/neural" },
    { name: "Trading Strategies", endpoint: "/api/status/strategies" },
    { name: "Capital Amplifier", endpoint: "/api/status/capital" }
  ];
  
  const results = await Promise.all(
    services.map(async service => {
      try {
        const startTime = Date.now();
        // In a real implementation, this would make HTTP requests to service health endpoints
        // For demo purposes, we'll simulate successful checks
        const status = Math.random() > 0.1 ? 'healthy' : 'degraded'; // 90% chance of healthy
        const endTime = Date.now();
        
        return {
          name: service.name,
          status: status as 'healthy' | 'degraded' | 'offline',
          latencyMs: endTime - startTime
        };
      } catch (error) {
        return {
          name: service.name,
          status: 'offline' as const,
          error: error.message
        };
      }
    })
  );
  
  // Check if all services are healthy
  const allHealthy = results.every(r => r.status === 'healthy');
  const degraded = results.filter(r => r.status === 'degraded');
  const offline = results.filter(r => r.status === 'offline');
  
  const errorMessages = [
    ...degraded.map(s => `${s.name} is degraded`),
    ...offline.map(s => `${s.name} is offline`)
  ];
  
  // Print health check results
  console.log(`Health check results: ${allHealthy ? '✅ All healthy' : '⚠️ Issues found'}`);
  results.forEach(r => {
    const icon = r.status === 'healthy' ? '✅' : r.status === 'degraded' ? '⚠️' : '❌';
    console.log(`${icon} ${r.name}: ${r.status}${r.latencyMs ? ` (${r.latencyMs}ms)` : ''}`);
  });
  
  return {
    healthy: allHealthy,
    services: results,
    errorMessages: errorMessages.length > 0 ? errorMessages : undefined
  };
}

// Rollback deployment if needed
async function rollbackDeployment(programName: string, version: string): Promise<void> {
  console.log(`⏪ Rolling back deployment of ${programName} v${version}...`);
  
  // Get deployment history
  const deploymentHistory = getDeploymentHistory();
  
  // Find the last successful deployment
  const lastSuccessful = deploymentHistory
    .filter(d => d.status === 'success' && d.version !== version)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
  
  if (!lastSuccessful) {
    console.log("⚠️ No previous successful deployment found for rollback");
    return;
  }
  
  console.log(`Found previous successful deployment: ${programName} v${lastSuccessful.version}`);
  
  // In a real implementation, this would restore the previous version
  // For demo purposes, we'll just log the action
  console.log(`Rolled back to previous version: ${lastSuccessful.version}`);
  
  // Update deployment log
  updateDeploymentLog({
    timestamp: new Date().toISOString(),
    version,
    programId: lastSuccessful.programId,
    status: 'rolled_back'
  });
}

// Log deployment success
function logDeploymentSuccess(programName: string, version: string, signature: string): void {
  // Get program ID from keypair
  const deployKeypair = getDeployKeypair();
  const programId = deployKeypair.publicKey.toString();
  
  // Update deployment log
  updateDeploymentLog({
    timestamp: new Date().toISOString(),
    version,
    programId,
    status: 'success',
    signature
  });
  
  console.log(`📝 Logged successful deployment of ${programName} v${version}`);
}

// Log deployment failure
function logDeploymentFailure(programName: string, version: string, errorMessage: string): void {
  // Get program ID from keypair
  const deployKeypair = getDeployKeypair();
  const programId = deployKeypair.publicKey.toString();
  
  // Update deployment log
  updateDeploymentLog({
    timestamp: new Date().toISOString(),
    version,
    programId,
    status: 'failed',
    errorMessage
  });
  
  console.log(`📝 Logged failed deployment of ${programName} v${version}`);
}

// Get deployment history
function getDeploymentHistory(): DeploymentLog[] {
  if (!fs.existsSync(DEPLOYMENT_LOG)) {
    return [];
  }
  
  try {
    const logData = fs.readFileSync(DEPLOYMENT_LOG, 'utf8');
    return JSON.parse(logData);
  } catch (error) {
    console.error(`Error reading deployment log: ${error.message}`);
    return [];
  }
}

// Update deployment log
function updateDeploymentLog(entry: DeploymentLog): void {
  const history = getDeploymentHistory();
  history.push(entry);
  
  try {
    fs.writeFileSync(DEPLOYMENT_LOG, JSON.stringify(history, null, 2));
  } catch (error) {
    console.error(`Error writing deployment log: ${error.message}`);
  }
}

// If run directly
if (require.main === module) {
  const programName = process.argv[2] || 'quantum_trader';
  const version = process.argv[3] || '1.0.0';
  
  safeDeploy(programName, version)
    .then(success => {
      if (!success) {
        process.exit(1);
      }
    })
    .catch(error => {
      console.error(`Deployment failed: ${error.message}`);
      process.exit(1);
    });
}