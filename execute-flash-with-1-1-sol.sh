#!/bin/bash
# Execute Real Flash Trading with 1.1 SOL

# Display warning
echo ""
echo "⚠️  WARNING: REAL BLOCKCHAIN TRADING ⚠️"
echo "This will execute actual transactions on the Solana blockchain using real funds."
echo "Day: 1 strategy"
echo "Amount: 1.1 SOL"
echo ""
echo "Are you sure you want to proceed? (y/n)"

# Get confirmation
read -r response
if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
    echo "Proceeding with real blockchain trading..."
    npx tsx execute-real-flash-trading.ts 1 1.1
else
    echo "Operation cancelled."
    exit 0
fi