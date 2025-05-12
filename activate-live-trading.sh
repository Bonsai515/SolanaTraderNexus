#!/bin/bash

# Make the script executable
chmod +x "$0"

echo "========================================================"
echo "       SOLANA QUANTUM TRADING - LIVE ACTIVATION         "
echo "========================================================"
echo ""
echo "This script will activate live trading with real funds."
echo "All agents will execute real transactions on the Solana blockchain."
echo ""
echo "WARNING: This will use REAL FUNDS for trading!"
echo ""
read -p "Are you sure you want to proceed with LIVE TRADING? (y/n): " confirm

if [ "$confirm" != "y" ]; then
    echo "Live trading activation cancelled."
    exit 1
fi

echo ""
echo "Checking wallet for funds..."

# Run the activation binary
cd "$(dirname "$0")"
cargo run --bin activate_live_trading

# Check if the activation was successful
if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 LIVE TRADING IS NOW ACTIVE!"
    echo "Profit capture is enabled"
    echo ""
    echo "To monitor trades, start the web server:"
    echo "   npm run dev"
    echo ""
else
    echo ""
    echo "❌ Failed to activate live trading."
    echo "Please check the logs for more information."
    exit 1
fi