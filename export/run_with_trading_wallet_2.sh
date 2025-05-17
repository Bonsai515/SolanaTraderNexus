
#!/bin/bash

# Shell script for executing transactions with Trading Wallet 2
# Public key: HH2hMVDuw4WT8QoGTBZX2H5BPWubDL9BFemH6UhhDPYR

# Export private key
export PRIVATE_KEY="69995cf93de5220f423e76cd73cbe2eea129d0b42ea00c0322d804745ec6c7bff1d6337eb1eefbc8e5d45d65e51bdcff596aeec7b957f34d2d910dd3da11f6d6"

# Execute the Day 4 strategy with this wallet
npx tsx execute-day4-strategy.ts $@
