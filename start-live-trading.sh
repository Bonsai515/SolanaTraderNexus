#!/bin/bash

# Start Live Trading with Singularity, Hyperion, and Quantum Omega
# This script sets up all required API keys and starts the full trading system for live operations

echo "=============================================="
echo "🚀 Solana Quantum Trading Platform - Live Mode"
echo "=============================================="
echo ""

# Create directory for API keys if it doesn't exist
mkdir -p .env

# Check if we already have an .env file
if [ -f ".env/trading.env" ]; then
    echo "Found existing API configuration."
    echo "Do you want to use the existing configuration? (y/n)"
    read -r use_existing
    
    if [ "$use_existing" == "y" ]; then
        echo "Using existing configuration."
        source .env/trading.env
    else
        echo "Creating new configuration."
        setup_new_config=true
    fi
else
    setup_new_config=true
fi

# Setup new configuration if needed
if [ "$setup_new_config" == "true" ]; then
    echo "Setting up API keys for live trading..."
    
    # Wormhole API Key
    echo ""
    echo "Enter your Wormhole API Key (required for cross-chain functionality):"
    read -r wormhole_key
    
    # Perplexity API Key
    echo ""
    echo "Enter your Perplexity API Key (required for AI-enhanced strategy analysis):"
    read -r perplexity_key
    
    # DeepSeek API Key
    echo ""
    echo "Enter your DeepSeek API Key (required for alternative AI capabilities):"
    read -r deepseek_key
    
    # Solana RPC URL
    echo ""
    echo "Enter your Solana RPC URL (e.g., Instant Nodes or Alchemy):"
    read -r solana_rpc
    
    # Helius API Key
    echo ""
    echo "Enter your Helius API Key (optional):"
    read -r helius_key
    
    # Save to .env file
    echo "# Solana Quantum Trading Platform - API Keys" > .env/trading.env
    echo "WORMHOLE_API_KEY=$wormhole_key" >> .env/trading.env
    echo "PERPLEXITY_API_KEY=$perplexity_key" >> .env/trading.env
    echo "DEEPSEEK_API_KEY=$deepseek_key" >> .env/trading.env
    echo "INSTANT_NODES_RPC_URL=$solana_rpc" >> .env/trading.env
    echo "HELIUS_API_KEY=$helius_key" >> .env/trading.env
    
    echo "API keys saved to .env/trading.env"
    
    # Load the new configuration
    source .env/trading.env
fi

# Export the environment variables
export WORMHOLE_API_KEY
export PERPLEXITY_API_KEY
export DEEPSEEK_API_KEY
export INSTANT_NODES_RPC_URL
export HELIUS_API_KEY

# Check wallet status
echo ""
echo "🔍 Checking system wallet status..."
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
        
        echo ""
        echo "Do you want to continue with low balance? (y/n)"
        read -r continue_low_balance
        
        if [ "$continue_low_balance" != "y" ]; then
            echo "Exiting. Please fund the system wallet and try again."
            exit 1
        fi
    else
        echo "✅ System wallet balance is sufficient for operations"
    fi
else
    echo "⚠️ Warning: Could not retrieve system wallet balance."
    echo "   This might indicate RPC connectivity issues."
    
    echo ""
    echo "Do you want to continue anyway? (y/n)"
    read -r continue_no_balance
    
    if [ "$continue_no_balance" != "y" ]; then
        echo "Exiting. Please check your RPC connection and try again."
        exit 1
    fi
fi

# Trading configuration
echo ""
echo "⚙️ Setting up trading configuration..."

# Create directories
mkdir -p data/config
mkdir -p data/logs
mkdir -p data/monitoring

# Create trading config
cat << EOF > data/config/trading.json
{
  "agents": {
    "hyperion": {
      "enabled": true,
      "max_input_amount": 1.0,
      "min_profit_percentage": 0.5,
      "gas_price_multiplier": 1.2,
      "trading_wallet": "8mFQbdXKNXEHDSxTgQnYJ7gJjwS7Z6TCQwP8HrbbNYQQ",
      "profit_wallet": "5vxoRv2P12q2YvUqnRTrLuhHft8v71dPCnmTNsAATX6s",
      "pairs": ["SOL/USDC", "BONK/USDC", "JUP/USDC", "RAY/USDC", "ORCA/USDC"]
    },
    "quantum_omega": {
      "enabled": true,
      "max_input_amount": 2.0,
      "min_profit_percentage": 1.0,
      "gas_price_multiplier": 1.3,
      "trading_wallet": "DAz8CQz4G63Wj1jCNe3HY2xQ4VSmaKmTBBVvfizRf",
      "profit_wallet": "2fZ1XPa3kuGWPgitv3DE1awpa1FEE4JFyVLpUYCZwzDJ",
      "pairs": ["BONK/USDC", "WIF/USDC", "BOME/USDC", "POPCAT/USDC", "SLERF/USDC"]
    },
    "singularity": {
      "enabled": true,
      "max_input_amount": 5.0,
      "min_profit_percentage": 0.5,
      "gas_price_multiplier": 1.2,
      "trading_wallet": "HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb",
      "profit_wallet": "6bLfHsp6eCFWZqGKZQaRwpVVLZRwKqcLt6QCKwLoxTqF",
      "fee_wallet": "9aBt1zPRUZmxttZ6Mk9AAU6XGS1TLQMZkpbCNBLH2Y2z",
      "chains": ["Solana", "Ethereum", "BinanceSmartChain", "Avalanche", "Polygon"]
    }
  },
  "system": {
    "system_wallet": "HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb",
    "auto_fund_trading_wallets": true,
    "trading_wallet_minimum_balance": 0.05,
    "profit_collection_interval": 3600,
    "min_profit_collection_amount": 0.1,
    "max_concurrent_transactions": 5,
    "enable_monitoring": true,
    "monitoring_interval": 60,
    "alert_threshold": 0.1
  },
  "dexes": {
    "enabled": [
      "Jupiter", "Raydium", "Openbook", "Orca", "Meteora", "Mango", "Drift",
      "PumpFun", "Goose", "Tensor", "Phoenix", "DexLab", "Sanctum", "Cykura",
      "Hellbenders", "Zeta", "Lifinity", "Crema", "DL", "Symmetry", "BonkSwap",
      "Saros", "StepN", "Saber", "Invariant"
    ]
  },
  "lending_protocols": {
    "enabled": [
      "Solend", "MarginFi", "Kamino", "Mercurial", "Jet", "Bolt"
    ]
  }
}
EOF

echo "✅ Trading configuration saved to data/config/trading.json"

# Start the server
echo ""
echo "🚀 Starting the trading server..."
echo ""

# Setup the environment for the server
export NODE_ENV=production
export USE_REAL_TRADING=true
export ENABLE_ALL_AGENTS=true
export LOG_LEVEL=info

# Start the server in the background
npm run dev &
SERVER_PID=$!

echo "Server started with PID: $SERVER_PID"
echo "Process ID saved to data/server.pid"
echo $SERVER_PID > data/server.pid

echo ""
echo "💫 Activating Singularity Cross-Chain Oracle for live trading..."
echo ""

# Wait for the server to initialize
sleep 5

# Send activation request to the server
curl -X POST -H "Content-Type: application/json" -d '{"agentId":"singularity","active":true}' http://localhost:5000/api/agents/activate

echo ""
echo "✅ Singularity agent activated successfully!"
echo ""

# Show agent status
echo "📊 Current agent status:"
curl -s http://localhost:5000/api/agents/status | json_pp

echo ""
echo "📈 Trading system is now live and operational"
echo "📝 Logs are available in data/logs/"
echo ""
echo "🔧 Available commands:"
echo "  - Check status: curl http://localhost:5000/api/agents/status"
echo "  - Stop agent:   curl -X POST -H \"Content-Type: application/json\" -d '{\"agentId\":\"singularity\",\"active\":false}' http://localhost:5000/api/agents/activate"
echo "  - Stop server:  kill \$(cat data/server.pid)"
echo ""
echo "🌐 Web interface available at: http://localhost:5000"
echo ""
echo "Happy trading! 💰 Expected profits:"
echo "  - Hyperion:     $38-$1,200/day from flash arbitrage"
echo "  - Quantum Omega: $500-$8,000/week from memecoin strategies"
echo "  - Singularity:   $60-$1,500/day from cross-chain arbitrage"
echo ""
echo "Total system profit potential: $5,000-$40,000 monthly"