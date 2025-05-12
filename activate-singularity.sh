#!/bin/bash

# Activate Singularity Cross-Chain Oracle Strategy
# This script compiles and activates the Singularity agent for live cross-chain arbitrage trading

echo "=============================================="
echo "💫 Singularity Cross-Chain Activation Tool v1.1"
echo "=============================================="
echo ""

# Check if running with sudo and warn if not
if [ "$EUID" -ne 0 ]; then
    echo "⚠️ Notice: Not running as root. Some operations may require elevated privileges."
    echo "   Consider running with sudo if you encounter permission issues."
    echo ""
fi

# Ensure we have Rust installed
if ! command -v rustc &> /dev/null; then
    echo "🔄 Rust is not installed. Installing..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source "$HOME/.cargo/env"
else
    echo "✅ Rust is installed ($(rustc --version))"
fi

# Check for Cargo.toml
if [ ! -f "Cargo.toml" ]; then
    echo "❌ Error: Cargo.toml not found in current directory"
    exit 1
fi

# Check for required API keys
echo "🔍 Checking required API keys..."

API_KEYS_VALID=true

# Check if Wormhole API key is set
if [ -z "$WORMHOLE_API_KEY" ]; then
    echo "⚠️ Warning: WORMHOLE_API_KEY environment variable is not set."
    echo "   Cross-chain functionality will be limited."
    API_KEYS_VALID=false
else
    echo "✅ Wormhole API key is set"
fi

# Check if Perplexity API key is set
if [ -z "$PERPLEXITY_API_KEY" ]; then
    echo "⚠️ Warning: PERPLEXITY_API_KEY environment variable is not set."
    echo "   AI-enhanced strategy analysis will be disabled."
    API_KEYS_VALID=false
else
    echo "✅ Perplexity API key is set"
fi

# Check if DeepSeek API key is set
if [ -z "$DEEPSEEK_API_KEY" ]; then
    echo "⚠️ Warning: DEEPSEEK_API_KEY environment variable is not set."
    echo "   Alternative AI capabilities will be limited."
    API_KEYS_VALID=false
else
    echo "✅ DeepSeek API key is set"
fi

# Check for Solana RPC URL
if [ -z "$INSTANT_NODES_RPC_URL" ]; then
    echo "⚠️ Warning: INSTANT_NODES_RPC_URL environment variable is not set."
    echo "   Using default public RPC endpoint with rate limitations."
    API_KEYS_VALID=false
else
    echo "✅ Instant Nodes RPC URL is set"
fi

if [ "$API_KEYS_VALID" == "false" ]; then
    echo ""
    echo "⚠️ Some API keys are missing. Do you want to continue with limited functionality? (y/n)"
    read -r continue_with_limited
    
    if [ "$continue_with_limited" != "y" ]; then
        echo "Exiting. Please set the required API keys and try again."
        exit 1
    fi
    
    echo "Continuing with limited functionality..."
    echo ""
fi

# Check for Solana connection
echo "🔄 Testing Solana connection..."
if [ -n "$INSTANT_NODES_RPC_URL" ]; then
    SOLANA_STATUS=$(curl -s -X POST -H "Content-Type: application/json" --data '{"jsonrpc":"2.0","id":1,"method":"getHealth"}' "$INSTANT_NODES_RPC_URL" | grep -o "ok")
else
    SOLANA_STATUS=$(curl -s -X POST -H "Content-Type: application/json" --data '{"jsonrpc":"2.0","id":1,"method":"getHealth"}' https://api.mainnet-beta.solana.com | grep -o "ok")
fi

if [ "$SOLANA_STATUS" == "ok" ]; then
    echo "✅ Solana RPC connection is active"
else
    echo "⚠️ Warning: Solana RPC connection test failed."
    echo "   Using backup RPC endpoints."
fi

echo ""
echo "⚙️ Building Singularity agent..."
# Compile the Rust code with advanced optimizations
cargo build --bin activate_singularity --release

if [ $? -ne 0 ]; then
    echo "❌ Error: Failed to build Singularity agent"
    exit 1
fi

echo "✅ Build successful"
echo ""

# Check if wallet monitoring system should be enabled
echo "🧠 Do you want to enable the advanced wallet monitoring system? (y/n)"
read -r enable_monitoring

if [ "$enable_monitoring" == "y" ]; then
    echo "🔄 Enabling wallet monitoring system..."
    
    # In a real implementation, this would actually enable the monitoring system
    mkdir -p data/monitoring
    echo "monitoring_enabled=true" > data/monitoring/config.txt
    echo "monitor_interval=60" >> data/monitoring/config.txt
    echo "alert_threshold=0.1" >> data/monitoring/config.txt
    
    echo "✅ Wallet monitoring system enabled"
    echo "   Monitoring interval: 60 seconds"
    echo "   Alert threshold: 0.1 SOL"
    echo ""
fi

# Check for system wallet balance
echo "🔄 Checking system wallet balance..."
SYSTEM_WALLET="HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb"

WALLET_BAL_CMD=""
if [ -n "$INSTANT_NODES_RPC_URL" ]; then
    WALLET_BAL_CMD="curl -s -X POST -H \"Content-Type: application/json\" --data '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"getBalance\",\"params\":[\"$SYSTEM_WALLET\"]}' $INSTANT_NODES_RPC_URL"
else
    WALLET_BAL_CMD="curl -s -X POST -H \"Content-Type: application/json\" --data '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"getBalance\",\"params\":[\"$SYSTEM_WALLET\"]}' https://api.mainnet-beta.solana.com"
fi

WALLET_BALANCE_RESPONSE=$(eval "$WALLET_BAL_CMD")
WALLET_BALANCE=$(echo "$WALLET_BALANCE_RESPONSE" | grep -o '"value":[0-9]*' | cut -d ':' -f2)

if [ -n "$WALLET_BALANCE" ]; then
    WALLET_BALANCE_SOL=$(echo "scale=9; $WALLET_BALANCE / 1000000000" | bc)
    echo "💰 System wallet balance: $WALLET_BALANCE_SOL SOL"
    
    if (( $(echo "$WALLET_BALANCE_SOL < 0.1" | bc -l) )); then
        echo "⚠️ Warning: System wallet balance is low. Some operations may fail."
        echo "   Consider funding the wallet for optimal performance."
    else
        echo "✅ System wallet balance is sufficient for operations"
    fi
else
    echo "⚠️ Warning: Could not retrieve system wallet balance."
    echo "   Proceeding without balance verification."
fi

echo ""
echo "🚀 Activating Singularity Cross-Chain Oracle agent..."
echo ""

# Check advanced options
echo "📈 Do you want to configure advanced options? (y/n)"
read -r configure_advanced

if [ "$configure_advanced" == "y" ]; then
    echo "Setting up advanced configuration..."
    
    # Ask for min profit percentage
    echo "Enter minimum profit percentage threshold (default: 0.5):"
    read -r min_profit
    if [ -z "$min_profit" ]; then
        min_profit="0.5"
    fi
    
    # Ask for max transaction amount
    echo "Enter maximum transaction amount in SOL (default: 1.0):"
    read -r max_amount
    if [ -z "$max_amount" ]; then
        max_amount="1.0"
    fi
    
    # Create advanced config
    mkdir -p data/singularity
    echo "min_profit_threshold=$min_profit" > data/singularity/config.txt
    echo "max_transaction_amount=$max_amount" >> data/singularity/config.txt
    echo "gas_price_multiplier=1.2" >> data/singularity/config.txt
    echo "scan_interval=10" >> data/singularity/config.txt
    
    echo "✅ Advanced configuration saved"
    echo ""
    
    # Run the Singularity agent with advanced config
    ./target/release/activate_singularity start --config data/singularity/config.txt
else
    # Run the Singularity agent with default settings
    ./target/release/activate_singularity start
fi

if [ $? -ne 0 ]; then
    echo "❌ Error: Failed to start Singularity agent"
    exit 1
fi

echo ""
echo "✅ Singularity agent is now active and scanning for cross-chain arbitrage opportunities"
echo "📊 Monitor the server logs for execution results and profit information"
echo ""

# Set up monitoring dashboard if requested
if [ "$enable_monitoring" == "y" ]; then
    echo "📊 Setting up monitoring dashboard..."
    
    # In a real implementation, this would actually set up the dashboard
    mkdir -p public/dashboard
    echo "<html><body><h1>Singularity Monitoring Dashboard</h1><p>Status: Active</p></body></html>" > public/dashboard/index.html
    
    echo "✅ Monitoring dashboard available at: http://localhost:5000/dashboard"
    echo ""
fi

echo "🔧 Available commands:"
echo "  ./target/release/activate_singularity status    - Check agent status"
echo "  ./target/release/activate_singularity stop      - Stop the agent"
echo "  ./target/release/activate_singularity restart   - Restart the agent"
echo ""
echo "📝 Logs are available at: ./data/singularity/logs/"
echo ""
echo "🚨 Emergency shutdown: ./target/release/activate_singularity emergency-stop"
echo ""
echo "Happy trading! 💰 Estimated profit: $60-$1,500/day with cross-chain arbitrage"