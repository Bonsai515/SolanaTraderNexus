#!/bin/bash
# Flash Strategy Launcher
# A script to easily launch the Quantum Flash Strategy

echo "====================================="
echo "Quantum Flash Strategy Launcher v1.0"
echo "====================================="
echo ""

# Check if npx is available
if ! command -v npx &> /dev/null; then
    echo "Error: npx command not found. Please install Node.js/npm."
    exit 1
fi

# Default values
DEFAULT_AMOUNT=1.5
DEFAULT_DAY=1

# Function to display help
show_help() {
    echo "Quantum Flash Strategy - High-powered flash loan arbitrage strategy"
    echo ""
    echo "Usage:"
    echo "  ./flash-strategy.sh [command] [options]"
    echo ""
    echo "Commands:"
    echo "  daily [day] [amount]   - Run strategy for a single day"
    echo "  weekly [amount]        - Run full 7-day strategy"
    echo "  help                   - Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./flash-strategy.sh daily 1 2.5    - Run Day 1 strategy with 2.5 SOL"
    echo "  ./flash-strategy.sh weekly 2       - Run weekly strategy with 2 SOL"
}

# Process arguments
if [ $# -eq 0 ] || [ "$1" == "help" ]; then
    show_help
    exit 0
fi

command=$1

case $command in
    daily)
        day=${2:-$DEFAULT_DAY}
        amount=${3:-$DEFAULT_AMOUNT}
        echo "Running Day $day strategy with $amount SOL..."
        npx tsx execute-flash-strategy.ts daily $day $amount
        ;;
    weekly)
        amount=${2:-$DEFAULT_AMOUNT}
        echo "Running weekly strategy with $amount SOL..."
        npx tsx execute-flash-strategy.ts weekly $amount
        ;;
    *)
        echo "Unknown command: $command"
        show_help
        exit 1
        ;;
esac