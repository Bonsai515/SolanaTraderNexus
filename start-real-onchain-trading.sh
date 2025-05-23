#!/bin/bash

echo "=== STARTING REAL ON-CHAIN TRADING WITH ACTUAL FUNDS ==="
echo "Integrating blockchain programs into Nexus Pro Engine"

# Set real trading environment
export NEXUS_REAL_TRADING="true"
export NEXUS_USE_ONCHAIN_PROGRAMS="true"
export NEXUS_CONFIRM_TRANSACTIONS="true"
export NEXUS_LIVE_FUNDS="true"
export NEXUS_BLOCKCHAIN_INTEGRATION="true"

# Apply on-chain configuration
cp ./nexus_engine/onchain/config.json ./nexus_engine/config/onchain-config.json

echo "🔗 ON-CHAIN PROGRAMS INTEGRATED:"
echo "  ⚡ Jupiter Aggregator: Real swap execution"
echo "  💰 Solend Protocol: Flash loan integration"
echo "  🌊 Orca Whirlpools: Liquidity pool access"
echo "  📈 Raydium AMM: Automated market making"
echo "  🏦 Kamino Lending: Advanced flash loans"
echo "  🥩 Marinade Staking: Liquid staking integration"
echo ""
echo "🚀 REAL TRADING FEATURES:"
echo "  • Live blockchain transaction execution"
echo "  • On-chain program direct integration"
echo "  • Real fund management and profit tracking"
echo "  • Priority fee optimization"
echo "  • Transaction confirmation monitoring"

# Start real on-chain trading
echo "Starting Nexus Pro Engine with real on-chain trading..."
node --experimental-specifier-resolution=node --no-warnings ./nexus_engine/start.js --mode=real-onchain &

echo ""
echo "✅ REAL ON-CHAIN TRADING ACTIVATED"
echo "Your Nexus Pro Engine is now executing real blockchain transactions:"
echo "  💰 Trading Wallet: HPNd8RHNATnN4upsNmuZV73R1F5nTqaAoL12Q4uyxdqK"
echo "  📊 Profit Wallet: 31kB9NF5fTVoDAf1Tu7EcMNFx8gUHHk4cuL56bcFxk2e"
echo "  🔗 Direct program integration with Jupiter, Solend, Orca"
echo "  ⚡ Priority fees enabled for faster execution"
echo ""
echo "⚠️  LIVE TRADING: Real SOL will be used for actual blockchain transactions"
