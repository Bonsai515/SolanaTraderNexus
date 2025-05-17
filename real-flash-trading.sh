#!/bin/bash
# Execute Real Blockchain Flash Trading

# Check if we have the required arguments
if [ $# -lt 2 ]; then
    echo "Usage: ./real-flash-trading.sh <day> <amount>"
    echo "  <day>    - Day number (1-7) of the strategy"
    echo "  <amount> - Amount of SOL to trade with"
    echo ""
    echo "Example: ./real-flash-trading.sh 1 1.5"
    echo "         (Executes Day 1 strategy with 1.5 SOL)"
    exit 1
fi

DAY=$1
AMOUNT=$2

# Display warning
echo ""
echo "⚠️  WARNING: REAL BLOCKCHAIN TRADING ⚠️"
echo "This will execute actual transactions on the Solana blockchain using real funds."
echo "Day: $DAY strategy"
echo "Amount: $AMOUNT SOL"
echo ""
echo "Are you sure you want to proceed? (y/n)"

# Get confirmation
read -r response
if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
    echo "Proceeding with real blockchain trading..."
    npx tsx execute-real-flash-trading.ts "$DAY" "$AMOUNT"
else
    echo "Operation cancelled."
    exit 0
fi